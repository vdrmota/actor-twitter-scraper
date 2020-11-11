const Apify = require('apify');

const { log } = Apify.utils;

module.exports = {
    async infiniteScroll(page, maxTimeout = 0, waitForDynamicContent = 6) {
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
            } catch (e) {}
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

        while (!finished) {
            try {
                await page.evaluate(async () => {
                    const delta = document.body.scrollHeight === 0 ? 10000 : document.body.scrollHeight; // in case scrollHeight fixed to 0
                    window.scrollBy(0, delta);
                });
            } catch (e) {
                finished = true;
            }
        }

        log.debug('Stopped scrolling');
    },
};
