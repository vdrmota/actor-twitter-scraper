const Apify = require('apify');
const scraper = require('./scraper')

Apify.main(async () => {

    const input = await Apify.getValue('INPUT');
    const launchPuppeteerOptions = input.proxyConfig || {};
    const browser = await Apify.launchPuppeteer(launchPuppeteerOptions);
    const page = await browser.newPage();
    await page.setCookie(...input.initialCookies);
    let requestQueue = [];

    for (var i = 0, n = input.handle.length; i < n; i++) {
        const handle = input.handle[i];
        const scraperOpts = {
            browser,
            handle,
            tweetCount: input.tweetsDesired,
        }
        requestQueue.push(scraper.getActivity(scraperOpts));
    }

    console.log("Starting scraping jobs...")
    return await Promise.all(requestQueue)
    
})