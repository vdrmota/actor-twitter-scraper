const Apify = require('apify');
const http = require('http');

const {
    pleaseOpen,
    liveView,
    localhost
} = require('./messages');
const {
    getInput,
    success
} = require('./static')

module.exports = {

    preparePage: async function(page) {
        await page.waitForNavigation({
            waitUntil: 'networkidle2'
        });
        await Apify.utils.puppeteer.injectJQuery(page);
    },

    login: async function(page, input) {
        await page.type('[autocomplete=username]', input.username);
        await page.type('[autocomplete=current-password]', input.password);

        await Promise.all([
            page.waitForNavigation({
                waitUntil: 'domcontentloaded'
            }),
            page.click('[value="Log in"]'),
          ]);
    },

    verificationCheck: async function(page) {
        await Apify.utils.puppeteer.injectJQuery(page);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await page.evaluate(() => {
            return !$("body").hasClass("logged-in");
        })
    },

    promptVerification: async function() {
        // identify local or cloud run
        const port = Apify.isAtHome() ? process.env.APIFY_CONTAINER_PORT : 3000
        const promptLocation = Apify.isAtHome() ? liveView : localhost

        let code = undefined;

        // get user input of email/text verification code
        const server = http.createServer((req, res) => {

            if (req.url.includes('/input')) {
                let data = ''
                req.on('data', body => {
                    if (body) data += body
                })
                req.on('end', () => {
                    code = decodeURIComponent(data.replace('code=', ''))
                    res.end(success())
                })
            } else {
                res.end(getInput())
            }
        })

        await server.listen(port, () => console.log('server is listening on port', port))

        // prompt user in console
        console.log(pleaseOpen)
        console.log(promptLocation)

        // await code input from user
        while (code === undefined) {
            await new Promise(resolve => setTimeout(resolve, 1000))
        }

        return code;
    },

    infiniteScroll: async function(page, maxTimeout = 0, waitForDynamicContent = 4) {

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

        new Promise((resolve, reject) => {

            page.on('request', (msg) => {
                if (maybeResourceTypesInfiniteScroll.includes(msg.resourceType())) {
                    resourcesStats.newRequested++;
                }
            });

            const scrollDown = setInterval(() => {
                //console.log(resourcesStats)
                if (resourcesStats.oldRequested === resourcesStats.newRequested) {
                    resourcesStats.matchNumber++;
                    if (resourcesStats.matchNumber >= WAIT_FOR_DYNAMIC_CONTENT) {
                        clearInterval(scrollDown)
                        resolve(finished = true);
                    }
                } else {
                    resourcesStats.matchNumber = 0;
                    resourcesStats.oldRequested = resourcesStats.newRequested;
                }
                // check if timeout has been reached
                if (MAX_TIMEOUT != 0 && (Date.now() - startTime) / 1000 > MAX_TIMEOUT) {
                    //console.log("Timeout limit reached, exiting infinite scroll.")
                    clearInterval(scrollDown)
                    resolve(finished = true);
                }
            }, 1000)
        })

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