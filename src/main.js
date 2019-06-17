const Apify = require('apify');
const scraper = require('./scraper')
const {
    login,
    verificationCheck,
    promptVerification,
    preparePage
} = require('./helpers')

Apify.main(async () => {

    // open fresh twitter
    const input = await Apify.getValue('INPUT');
    const launchPuppeteerOptions = Object.assign(input.proxyConfig || {}, { liveView: true });
    const browser = await Apify.launchPuppeteer(launchPuppeteerOptions);
    const page = await browser.newPage();
    await page.goto('https://twitter.com');

    // login
    await login(page, input)

    // check for human verification requirement
    const requiredVerification = await verificationCheck(page)

    // prompt for human verification, if needed
    if (requiredVerification) {
        const verificationCode = await promptVerification()

        // enter login verification
        await page.type('#challenge_response', verificationCode);
        await page.click('#email_challenge_submit');
    }

    var tweetHistory, userProfile, followers, following;

    // request queue
    await Promise.all([

        // get tweet history
        new Promise (async (resolve, reject) => {
            try {
                console.log("Scraping tweets...")
                tweetHistory = await scraper.getActivity(page, input.handle, input.tweetsDesired)
                return resolve(console.log("[FINISHED] Scraping tweets."))
            } catch (err) {
                return reject(err)
            }
        }),

        // get user profile
        new Promise (async (resolve, reject) => {
            try {
                console.log("Scraping profile...")
                userProfile = await scraper.getProfile(page, input.handle)
                return resolve(console.log("[FINISHED] Scraping profile."))
            } catch (err) {
                return reject(err)
            }
        }),

        // get followers
        new Promise (async (resolve, reject) => {
            try {
                console.log("Scraping followers...")
                followers = await scraper.getFollowers(page, input.handle, input.followersDesired, 'followers')
                return resolve(console.log("[FINISHED] Scraping followers."))
            } catch (err) {
                return reject(err)
            }
        }),

        // get following
        new Promise (async (resolve, reject) => {
            try {
                console.log("Scraping following...")
                following = await scraper.getFollowers(page, input.handle, input.followersDesired, 'following')
                return resolve(console.log("[FINISHED] Scraping following."))
            } catch (err) {
                return reject(err)
            }
        })

    ])

    // store data
    await Apify.pushData({
        userProfile: userProfile,
        followers: followers,
        following: following,
        tweetHistory: tweetHistory
    });
})