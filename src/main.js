const Apify = require('apify');
const scraper = require('./scraper')

Apify.main(async () => {

    const input = await Apify.getValue('INPUT');
    const launchPuppeteerOptions = input.proxyConfig || {};
    const browser = await Apify.launchPuppeteer(launchPuppeteerOptions);
    const page = await browser.newPage();
    await page.setCookie(...input.initialCookies);

    for (var i = 0, n = input.handle.length; i < n; i++) {

        const handle = input.handle[i];
        await page.goto(`https://twitter.com/${handle}`);

        const scraperOpts = {
            browser,
            handle,
            tweetCount: input.tweetsDesired,
        }

        const [
            tweetHistory,
            userProfile,
        ] = await Promise.all([scraper.getActivity(scraperOpts), scraper.getProfile(scraperOpts)])

        await Apify.pushData({
            userProfile: userProfile,
            tweetHistory: tweetHistory
        });
    }
})