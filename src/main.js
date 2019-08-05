const Apify = require('apify');
const scraper = require('./scraper')

Apify.main(async () => {

    // open fresh twitter
    const input = await Apify.getValue('INPUT');
    const launchPuppeteerOptions = input.proxyConfig || {};
    const browser = await Apify.launchPuppeteer(launchPuppeteerOptions);
    const page = await browser.newPage();
    await page.setCookie(...input.initialCookies)
    await page.goto('https://twitter.com');

    // get tweet history
    const tweetHistory = await scraper.getActivity(browser, input.handle, input.tweetsDesired)

    // get user profile
    const userProfile = await scraper.getProfile(browser, input.handle)

    // get followers
    const followers = await scraper.getFollowers(browser, input.handle, input.followersDesired, 'followers')

    // get following
    const following = await scraper.getFollowers(browser, input.handle, input.followersDesired, 'following')

    // store data
    await Apify.pushData({
        userProfile: await userProfile,
        followers: await followers,
        following: await following,
        tweetHistory: await tweetHistory
    });
})