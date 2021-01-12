const Apify = require('apify');
const _ = require('lodash');
const {
    infiniteScroll,
    intervalPushData,
    parseRelativeDate,
    requestCounter,
    cutOffDate,
    createAddEvent,
    createAddProfile,
    createAddSearch,
    extendFunction,
    categorizeUrl,
    tweetToUrl,
} = require('./helpers');
const { LABELS, USER_OMIT_FIELDS } = require('./constants');
const { clearInterval } = require('timers')

const { log } = Apify.utils;

Apify.main(async () => {
    /** @type {any} */
    const input = await Apify.getValue('INPUT');

    const proxyConfiguration = await Apify.createProxyConfiguration(input.proxyConfig);

    if (Apify.isAtHome() && (!proxyConfiguration || proxyConfiguration.groups.includes('GOOGLE_SERP'))) {
        throw new Error('You need to provide a valid proxy group when running on the platform');
    }

    const {
        tweetsDesired,
        mode = 'replies',
    } = input;

    const requestQueue = await Apify.openRequestQueue();
    const requestCounts = await requestCounter(tweetsDesired);

    const { flush, pushData } = await intervalPushData(await Apify.openDataset(), 50);

    const addProfile = createAddProfile(requestQueue);
    const addSearch = createAddSearch(requestQueue);
    const addEvent = createAddEvent(requestQueue);

    const toDate = cutOffDate(-Infinity, input.toDate ? parseRelativeDate(input.toDate) : undefined);
    const fromDate = cutOffDate(Infinity, input.fromDate ? parseRelativeDate(input.fromDate) : undefined);

    const extendOutputFunction = await extendFunction({
        map: async (data) => {
            return Object.values(data.tweets).reduce((/** @type {any[]} */out, tweet) => {
                log.debug('Tweet data', tweet);

                const user = data.users[
                    _.get(
                        tweet,
                        ['user_id_str'],
                        _.get(tweet, ['user', 'id_str']),
                    )
                ];

                out.push({
                    user: {
                        ..._.omit(user, USER_OMIT_FIELDS),
                        created_at: new Date(user.created_at).toISOString(),
                    },
                    id: tweet.id_str,
                    conversation_id: tweet.conversation_id_str,
                    ..._.pick(tweet, [
                        'full_text',
                        'reply_count',
                        'retweet_count',
                        'favorite_count',
                    ]),
                    url: tweetToUrl(user, tweet.id_str),
                    created_at: new Date(tweet.created_at).toISOString(),
                });

                return out;
            }, []);
        },
        filter: async ({ item }) => {
            return toDate(item.created_at) <= 0 && fromDate(item.created_at) >= 0;
        },
        output: async (item, { request }) => {
            if (!requestCounts.isDone(request)) {
                requestCounts.increaseCount(request);

                pushData(item.id, item);
            }
        },
        input,
        key: 'extendOutputFunction',
        helpers: {
            _,
        },
    });

    const extendScraperFunction = await extendFunction({
        output: async () => {}, // no-op
        input,
        key: 'extendScraperFunction',
        helpers: {
            addProfile,
            addSearch,
            addEvent,
            requestQueue,
            _,
        },
    });

    if (input.startUrls && input.startUrls.length) {
        // parse requestsFromUrl
        const requestList = await Apify.openRequestList('STARTURLS', input.startUrls || []);

        let req;

        while (req = await requestList.fetchNextRequest()) { // eslint-disable-line no-cond-assign
            const categorized = categorizeUrl(req.url);

            switch (categorized) {
                case LABELS.EVENTS:
                    await addEvent(req.url);
                    break;
                case LABELS.HANDLE:
                    await addProfile(req.url, mode === 'replies');
                    break;
                case LABELS.SEARCH:
                    await addSearch(req.url, input.searchMode);
                    break;
                default:
                    throw new Error(`Unknown format ${categorized}`);
            }
        }
    }

    if (input.handle && input.handle.length) {
        for (const handle of input.handle) {
            await addProfile(handle, mode === 'replies');
        }
    }

    if (input.searchTerms && input.searchTerms.length) {
        for (const searchTerm of input.searchTerms) {
            await addSearch(searchTerm, input.searchMode);
        }
    }

    const isLoggingIn = input.initialCookies && input.initialCookies.length > 0;

    const crawler = new Apify.PuppeteerCrawler({
        handlePageTimeoutSecs: 3600,
        requestQueue,
        proxyConfiguration,
        maxConcurrency: isLoggingIn ? 1 : undefined,
        launchPuppeteerOptions: {
            stealth: false,
        },
        puppeteerPoolOptions: {
            useIncognitoPages: true,
            maxOpenPagesPerInstance: 1,
        },
        sessionPoolOptions: {
            createSessionFunction: (sessionPool) => {
                const session = new Apify.Session({
                    sessionPool,
                    maxUsageCount: isLoggingIn ? 5000 : 50,
                    maxErrorScore: 1,
                });

                if (isLoggingIn) {
                    session.setPuppeteerCookies(input.initialCookies, 'https://twitter.com');
                }

                return session;
            },
        },
        useSessionPool: true,
        persistCookiesPerSession: true,
        gotoFunction: async ({ page, request, puppeteerPool, session }) => {
            await Apify.utils.puppeteer.blockRequests(page, {
                urlPatterns: [
                    '.jpg',
                    '.ico',
                    '.jpeg',
                    '.gif',
                    '.svg',
                    '.png',
                    'pbs.twimg.com/semantic_core_img',
                    'pbs.twimg.com/profile_banners',
                    'pbs.twimg.com/media',
                    'pbs.twimg.com/card_img',
                    'www.google-analytics.com',
                    'branch.io',
                    '/guide.json',
                    '/client_event.json',
                ],
            });

            if (input.extendOutputFunction || input.extendScraperFunction) {
                // insert jQuery only when the user have an output function
                await Apify.utils.puppeteer.injectJQuery(page);
            }

            try {
                return page.goto(request.url, {
                    waitUntil: 'domcontentloaded',
                });
            } catch (e) {
                session.retire();
                await puppeteerPool.retire(page.browser());

                throw new Error('Failed to load page, retrying');
            }
        },
        handlePageFunction: async ({ request, page }) => {
            await extendScraperFunction(undefined, {
                page,
                request,
            });

            page.on('response', async (response) => {
                try {
                    const contentType = response.headers()['content-type'];

                    if (!contentType || !`${contentType}`.includes('application/json')) {
                        return;
                    }

                    const url = response.url();

                    if (!url) {
                        return;
                    }

                    /** @type {any} */
                    const data = (await response.json());

                    if (!data) {
                        return;
                    }

                    if (
                        (url.includes('/search/adaptive')
                        || url.includes('/timeline/profile')
                        || url.includes('/live_event/timeline'))
                        && data.globalObjects
                    ) {
                        await extendOutputFunction(data.globalObjects, {
                            request,
                            page,
                        });
                    }

                    if (url.includes('/live_event/') && data.twitter_objects) {
                        await extendOutputFunction(data.twitter_objects, {
                            request,
                            page,
                        });
                    }
                } catch (err) {
                    log.debug(err.message, { request: request.userData });
                }
            });

            let lastCount = requestCounts.currentCount(request);

            const displayStatus = setInterval(() => {
                if (lastCount !== requestCounts.currentCount(request)) {
                    lastCount = requestCounts.currentCount(request);
                    log.info(`Extracted ${lastCount} tweets from ${request.url}`);
                }
            }, 5000);

            await infiniteScroll({
                page,
                isDone: () => requestCounts.isDone(request),
            });

            clearInterval(displayStatus);

            page.removeAllListeners('response');
        },
    });

    log.info('Starting scraper');

    await crawler.run();
    await flush();

    log.info('All finished');
});
