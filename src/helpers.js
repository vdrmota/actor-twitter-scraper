const Apify = require('apify');
const vm = require('vm');
const Puppeteer = require('puppeteer'); // eslint-disable-line no-unused-vars
const moment = require('moment');
const _ = require('lodash');
const { LABELS } = require('./constants');

const { log, sleep } = Apify.utils;

/**
 * @param {any} user
 * @param {string} id
 */
const tweetToUrl = (user, id) => {
    return `https://twitter.com/${_.get(user, 'screen_name')}/status/${id}`;
};

/**
 * @param {string} url
 */
const categorizeUrl = (url) => {
    if (!url || !/^https:\/\/(mobile|www)?\.?twitter\.com\//i.test(url)) {
        throw new Error(`Invalid url ${url}`);
    }

    const nUrl = new URL(url, 'https://twitter.com');

    if (nUrl.pathname === '/search') {
        return LABELS.SEARCH;
    }

    if (/\/i\/events\//.test(nUrl.pathname)) {
        return LABELS.EVENTS;
    }

    if (/^\/[a-zA-Z0-9_]{1,15}(\/|$)/.test(nUrl.pathname)) {
        return LABELS.HANDLE;
    }

    throw new Error(`Url ${url} didn't match any supported type. You can provide search, events and profile urls`);
};

/**
 * @param {Apify.RequestQueue} requestQueue
 */
const createAddProfile = (requestQueue) => async (handle, replies = false) => {
    const isUrl = `${handle}`.includes('twitter.com');

    return requestQueue.addRequest({
        url: isUrl
            ? handle
            : `https://twitter.com/${cleanupHandle(handle)}${replies ? '/with_replies' : ''}`,
        userData: {
            label: LABELS.HANDLE,
            handle: cleanupHandle(handle),
        },
    });
};

/**
 * @param {Apify.RequestQueue} requestQueue
 */
const createAddSearch = (requestQueue) => async (search, mode) => {
    const isUrl = `${search}`.includes('twitter.com');

    return requestQueue.addRequest({
        url: isUrl
            ? search
            : `https://twitter.com/search?q=${encodeURIComponent(search)}&src=typed_query${mode ? `&f=${mode}` : ''}`,
        userData: {
            label: LABELS.SEARCH,
            search: !isUrl
                ? search
                : new URL(search, 'https://twitter.com').searchParams.get('q'),
        },
    });
};

/**
 * @param {Apify.RequestQueue} requestQueue
 */
const createAddEvent = (requestQueue) => async (event) => {
    const isUrl = `${event}`.includes('twitter.com');

    return requestQueue.addRequest({
        url: isUrl
            ? event
            : `https://twitter.com/i/events/${event}`,
        userData: {
            label: LABELS.EVENTS,
            event: !isUrl
                ? event
                : new URL(event, 'https://twitter.com').pathname.split('/events/', 2)[1],
        },
    });
};

/**
 * @param {string} dateFrom
 */
const parseRelativeDate = (dateFrom) => {
    if (!dateFrom) {
        return;
    }

    const parsedDateFrom = new Date(dateFrom);

    if (!Number.isNaN(parsedDateFrom.getTime())) {
        return parsedDateFrom.getTime();
    }

    const now = moment();

    if (!/(hour|minute|second)/i.test(dateFrom)) {
        now
            .hour(0)
            .minute(0)
            .second(0)
            .millisecond(0);
    }

    if (!dateFrom.includes(' ')) {
        switch (dateFrom) {
            case 'today':
                return now.valueOf();
            case 'yesterday':
                return now.subtract(1, 'day').valueOf();
            default:
                throw new Error(`Invalid date format: ${dateFrom}`);
        }
    }

    const split = dateFrom.split(' ', 2);
    const difference = now.clone().subtract(+split[0], split[1]);
    if (now.valueOf() !== difference.valueOf()) {
        // Means the subtraction worked
        return difference.valueOf();
    }

    throw new Error('\n---------WRONG INPUT:\n\ndateFrom is not a valid date. Please use date in YYYY-MM-DD or format like "1 week", "1 hour" or "20 days"\n\n---------');
};

/**
 * @param {string|Date|number} [value]
 * @param {boolean} [isoString]
 */
const convertDate = (value, isoString = false) => {
    if (!value) {
        return isoString ? '2100-01-01T00:00:00.000Z' : Infinity;
    }

    if (value instanceof Date) {
        return isoString ? value.toISOString() : value.getTime();
    }

    let tryConvert = new Date(value);

    // catch values less than year 2002
    if (Number.isNaN(tryConvert.getTime()) || `${tryConvert.getTime()}`.length < 13) {
        if (typeof value === 'string') {
            // convert seconds to miliseconds
            tryConvert = new Date(value.length >= 13 ? +value : +value * 1000);
        } else if (typeof value === 'number') {
            // convert seconds to miliseconds
            tryConvert = new Date(`${value}`.length >= 13 ? value : value * 1000);
        }
    }

    return isoString ? tryConvert.toISOString() : tryConvert.getTime();
};

/**
 * Check if the provided date is greater/less than the minimum
 * @param {number} fallback
 * @param {string|Date|number} [base]
 * @return {(compare: string | Date) => number}
 */
const cutOffDate = (fallback, base) => {
    if (!base) {
        return () => fallback;
    }

    const formatted = moment(base);

    return (compare) => {
        return formatted.diff(compare);
    };
};

/**
 * @param {Apify.Dataset} dataset
 * @param {number} [limit]
 */
const intervalPushData = async (dataset, limit = 500) => {
    const data = new Map(await Apify.getValue('PENDING_PUSH'));
    await Apify.setValue('PENDING_PUSH', []);
    let shouldPush = true;

    /** @type {any} */
    let timeout;

    const timeoutFn = async () => {
        if (shouldPush && data.size >= limit) {
            const dataToPush = [...data.values()];
            data.clear();
            await dataset.pushData(dataToPush);
        }

        timeout = setTimeout(timeoutFn, 10000);
    };

    Apify.events.on('migrating', async () => {
        shouldPush = false;
        if (timeout) {
            clearTimeout(timeout);
        }
        await Apify.setValue('PENDING_PUSH', [...data.entries()]);
    });

    await timeoutFn();

    return {
        /**
             * Synchronous pushData
             *
             * @param {string} key
             * @param {any} item
             * @returns {boolean} Returns true if the item is new
             */
        pushData(key, item) {
            const isNew = !data.has(key);
            data.set(key, item);
            return isNew;
        },
        /**
             * Flushes any remaining items on the pending array.
             * Call this after await crawler.run()
             */
        async flush() {
            shouldPush = false;

            if (timeout) {
                clearTimeout(timeout);
            }

            const dataToPush = [...data.values()];

            while (dataToPush.length) {
                await Apify.pushData(dataToPush.splice(0, limit));
                await Apify.utils.sleep(1000);
            }
        },
    };
};

/**
 * @param {string} handle
 */
const cleanupHandle = (handle) => {
    const matches = handle.match(/^(?:https:\/\/(mobile|www)?\.?twitter\.com\/|@)?(?<HANDLE>[a-zA-Z0-9_]{1,15})$/);

    if (!matches || !matches.groups || !matches.groups.HANDLE) {
        throw new Error(`Invalid handle provided: ${handle}`);
    }

    return matches.groups.HANDLE;
};

/**
 * @param {{
 *  page: Puppeteer.Page,
 *  maxTimeout?: number,
 *  isDone: () => boolean,
 *  waitForDynamicContent?: number,
 * }} params
 */
const infiniteScroll = async ({ page, isDone, maxTimeout = 0, waitForDynamicContent = 6 }) => {
    let finished = false;
    const MAX_TIMEOUT = maxTimeout; // seconds
    const WAIT_FOR_DYNAMIC_CONTENT = waitForDynamicContent; // how many seconds to wait for nothing to load before exit
    const startTime = Date.now();

    const maybeResourceTypesInfiniteScroll = ['xhr', 'fetch', 'websocket', 'other'];
    const resourcesStats = {
        newRequested: 0,
        oldRequested: 0,
        matchNumber: 0,
    };

    const getRequest = (msg) => {
        try {
            if (maybeResourceTypesInfiniteScroll.includes(msg.resourceType())) {
                resourcesStats.newRequested++;
            }
        } catch (e) { }
    };

    page.on('request', getRequest);

    const scrollDown = () => {
        if (resourcesStats.oldRequested === resourcesStats.newRequested) {
            resourcesStats.matchNumber++;
            if (resourcesStats.matchNumber >= WAIT_FOR_DYNAMIC_CONTENT) {
                finished = true;
                return;
            }
        } else {
            resourcesStats.matchNumber = 0;
            resourcesStats.oldRequested = resourcesStats.newRequested;
        }
        // check if timeout has been reached
        if (MAX_TIMEOUT !== 0 && (Date.now() - startTime) / 1000 > MAX_TIMEOUT) {
            finished = true;
        } else {
            setTimeout(scrollDown, 2000);
        }
    };

    setTimeout(scrollDown);

    return new Promise(async (resolve) => {
        while (!finished) {
            try {
                await page.evaluate(async () => {
                    const delta = document.body.scrollHeight === 0 ? 10000 : document.body.scrollHeight; // in case scrollHeight fixed to 0
                    window.scrollBy(0, delta);
                });

                if (isDone()) {
                    finished = true;
                } else {
                    await sleep(3000);
                }
            } catch (e) {
                finished = true;
            }
        }

        log.debug('Stopped scrolling');

        resolve(undefined);
    });
};

/**
 * @template T
 * @typedef {T & { Apify: Apify, customData: any }} PARAMS
 */

/**
 * Compile a IO function for mapping, filtering and outputing items.
 * Can be used as a no-op for interaction-only (void) functions on `output`.
 * Data can be mapped and filtered twice.
 *
 * Provided base map and filter functions is for preparing the object for the
 * actual extend function, it will receive both objects, `data` as the "raw" one
 * and "item" as the processed one.
 *
 * Always return a passthrough function if no outputFunction provided on the
 * selected key.
 *
 * @template RAW
 * @template {{ [key: string]: any }} INPUT
 * @template MAPPED
 * @template {{ [key: string]: any }} HELPERS
 * @param {{
    *  key: string,
    *  map?: (data: RAW, params: PARAMS<HELPERS>) => Promise<MAPPED>,
    *  output?: (data: MAPPED, params: PARAMS<HELPERS>) => Promise<void>,
    *  filter?: (obj: { data: RAW, item: MAPPED }, params: PARAMS<HELPERS>) => Promise<boolean>,
    *  input: INPUT,
    *  helpers: HELPERS,
    * }} params
    * @return {Promise<(data: RAW, args?: Record<string, any>) => Promise<void>>}
    */
const extendFunction = async ({
    key,
    output,
    filter,
    map,
    input,
    helpers,
}) => {
    /**
        * @type {PARAMS<HELPERS>}
        */
    const base = {
        ...helpers,
        Apify,
        customData: input.customData || {},
    };

    const evaledFn = (() => {
        // need to keep the same signature for no-op
        if (typeof input[key] !== 'string') {
            return new vm.Script('({ item }) => item');
        }

        try {
            return new vm.Script(input[key], {
                lineOffset: 0,
                produceCachedData: false,
                displayErrors: true,
                filename: `${key}.js`,
            });
        } catch (e) {
            throw new Error(`"${key}" parameter must be a function`);
        }
    })();

    /**
     * Returning arrays from wrapper function split them accordingly.
     * Normalize to an array output, even for 1 item.
     *
     * @param {any} value
     * @param {any} [args]
     */
    const splitMap = async (value, args) => {
        const mapped = map ? await map(value, args) : value;

        if (!Array.isArray(mapped)) {
            return [mapped];
        }

        return mapped;
    };

    return async (data, args) => {
        const merged = { ...base, ...args };

        for (const item of await splitMap(data, merged)) {
            if (filter && !(await filter({ data, item }, merged))) {
                continue; // eslint-disable-line no-continue
            }

            const result = await (evaledFn.runInThisContext()({
                ...merged,
                data,
                item,
            }));

            for (const out of (Array.isArray(result) ? result : [result])) {
                if (output) {
                    if (out !== null) {
                        await output(out, merged);
                    }
                    // skip output
                }
            }
        }
    };
};

/**
 * @param {number} count
 */
const requestCounter = async (count) => {
    /** @type {Record<string, number>} */
    const countState = /** @type {any} */(await Apify.getValue('COUNT')) || {};

    const persistState = async () => {
        await Apify.setValue('COUNT', countState);
    };

    Apify.events.on('persistState', persistState);

    return {
        /** @param {Apify.Request} request */
        currentCount(request) {
            return countState[request.id] || 0;
        },
        /** @param {Apify.Request} request */
        increaseCount(request, increment = 1) {
            countState[request.id] = (countState[request.id] || 0) + increment;
        },
        /** @param {Apify.Request} request */
        isDone(request) {
            return countState[request.id] >= count;
        },
    };
};

module.exports = {
    cutOffDate,
    extendFunction,
    convertDate,
    intervalPushData,
    parseRelativeDate,
    infiniteScroll,
    cleanupHandle,
    requestCounter,
    categorizeUrl,
    createAddProfile,
    tweetToUrl,
    createAddSearch,
    createAddEvent,
};
