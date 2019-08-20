module.exports = {

    infiniteScroll: async function(page, maxTimeout = 0, waitForDynamicContent = 6) {

        var finished;
        const MAX_TIMEOUT = maxTimeout; // seconds
        const WAIT_FOR_DYNAMIC_CONTENT = waitForDynamicContent; // how many seconds to wait for nothing to load before exit
        const startTime = Date.now()


        const maybeResourceTypesInfiniteScroll = ['xhr', 'fetch', 'websocket', 'other'];
        const resourcesStats = {
            newRequested: 0,
            oldRequested: 0,
            matchNumber: 0
        };

        page.on('request', (msg) => {
            if (maybeResourceTypesInfiniteScroll.includes(msg.resourceType())) {
                resourcesStats.newRequested++;
            }
        });

        const scrollDown = setInterval(() => {
            if (resourcesStats.oldRequested === resourcesStats.newRequested) {
                resourcesStats.matchNumber++;
                if (resourcesStats.matchNumber >= WAIT_FOR_DYNAMIC_CONTENT) {
                    clearInterval(scrollDown);
                    finished = true;
                }
            } else {
                resourcesStats.matchNumber = 0;
                resourcesStats.oldRequested = resourcesStats.newRequested;
            }
            // check if timeout has been reached
            if (MAX_TIMEOUT != 0 && (Date.now() - startTime) / 1000 > MAX_TIMEOUT) {
                clearInterval(scrollDown)
                finished = true;
            }
        }, 2000)

        while (true) {
            await page.evaluate(async () => {
                let delta = document.body.scrollHeight === 0 ? 10000 : document.body.scrollHeight // in case scrollHeight fixed to 0
                window.scrollBy(0, delta);
            });
            if (finished) {
                break;
            }
        }
    }
}