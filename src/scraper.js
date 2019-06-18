const {
    preparePage,
    infiniteScroll
} = require('./helpers')

module.exports = {

    scrapeTimeline: async function(page, output, handle) {
        return await page.evaluate((existing, handle) => {

            var res = []
            var counter = 0;

            // iterate through each tweet
            $(".js-stream-item").each(function() {

                // skip already scraped tweets
                if (counter < existing) {
                    counter++;
                    return true
                }

                var type = "unknown";
                var replyingTo = null;

                // check tweet type
                if ($(".content .ReplyingToContextBelowAuthor", this).length) {
                    type = "reply";
                    replyingTo = $(".content .ReplyingToContextBelowAuthor", this).text().replace(/^\s+|\s+$/g, '').replace('Replying to ', '')
                } else if ($(".tweet-context", this).length) {
                    type = "retweet";
                } else {
                    type = "tweet";
                }

                // retrieve any links in tweet
                if ($(".twitter-timeline-link", this).length) {
                    var link = $(".twitter-timeline-link", this).attr('href');
                } else {
                    var link = null;
                }
                const attachments = {
                    link: link
                }

                // scrape tweet data
                const likes = $(".js-actionFavorite .ProfileTweet-actionCount .ProfileTweet-actionCountForPresentation", this).html();
                const retweets = $(".js-toggleRt .ProfileTweet-actionCount .ProfileTweet-actionCountForPresentation", this).html();
                const comments = $(".js-actionReply .ProfileTweet-actionCount .ProfileTweet-actionCountForPresentation", this).html();
                const tweetLink = `https://twitter.com/${handle}/status/${$(this).attr('data-item-id')}`;
                const contentText = $(".js-tweet-text-container p", this).text().replace(/^\s+|\s+$/g, '')
                const contentHtml = $(".js-tweet-text-container p", this).html()
                const dateTime = $(".stream-item-header .tweet-timestamp", this).attr("title");
                const timeStamp = $(".stream-item-header .tweet-timestamp ._timestamp", this).attr("data-time-ms");

                res.push({
                    type: type,
                    replyingTo: replyingTo,
                    contentHtml: contentHtml,
                    contentText: contentText,
                    attachments: attachments,
                    comments: comments,
                    retweets: retweets,
                    likes: likes,
                    dateTime: dateTime,
                    timeStamp: timeStamp,
                    tweetLink: tweetLink
                })
            })

            return res

        }, output.length, handle)

    },

    getActivity: async function(browser, handle, tweetCount) {

        const SCROLL_DURATION = 1

        const page = await browser.newPage();
        await page.goto(`https://twitter.com/${handle}/with_replies`);
        await preparePage(page);

        var output = [];

        // scraped desired number of tweets
        do {
            var activity = await module.exports.scrapeTimeline(page, output, handle);
            var oldOutput = output;
            output = [...output, ...activity];
            await infiniteScroll(page, SCROLL_DURATION);
        } while (output.length < tweetCount && oldOutput.length < output.length)

        // truncate overflow output due to high SCROLL_DURATION
        if (output.length > tweetCount) output.length = tweetCount;

        console.log("[FINISHED] Scraping tweets.")
        return output;
    },

    getProfile: async function(browser, handle) {

        var userProfile = {
            username: handle
        }

        const page = await browser.newPage();
        await page.goto(`https://twitter.com/${handle}`);
        await preparePage(page)

        // get profile information
        const profileDescription = await page.evaluate(() => {
            return {
                name: $(".ProfileHeaderCard-name").text().replace(/^\s+|\s+$/g, '').replace('Verified account', ' [Verified account]'),
                description: $(".ProfileHeaderCard-bio").text().replace(/^\s+|\s+$/g, ''),
                location: $(".ProfileHeaderCard-location").text().replace(/^\s+|\s+$/g, ''),
                website: $(".ProfileHeaderCard-url").text().replace(/^\s+|\s+$/g, ''),
                joined: $(".ProfileHeaderCard-joinDate").text().replace(/^\s+|\s+$/g, '')
            }
        })

        userProfile = Object.assign(userProfile, profileDescription);

        console.log("[FINISHED] Scraping profile.")
        return userProfile;
    },

    scrapeFollowers: async function(page, output) {

        return await page.evaluate((existing) => {

            var followers = [];
            var counter = 0;

            $(".ProfileCard-avatarLink").each(function() {

                // skip already collected followers
                if (counter < existing) {
                    counter++;
                    return true
                }

                followers.push($(this).attr('href').replace('/', ''));

            })

            return followers;

        }, output.length)

    },

    getFollowers: async function(browser, handle, desired, type) {

        const SCROLL_DURATION = 1

        const page = await browser.newPage();
        await page.goto(`https://twitter.com/${handle}/${type}`);
        await preparePage(page)

        var output = []

        // scrape desired number of following/followers
        do {
            var activity = await module.exports.scrapeFollowers(page, output)
            var oldOutput = output;
            output = [...output, ...activity];
            await infiniteScroll(page, SCROLL_DURATION);
        } while (output.length < desired && oldOutput.length < output.length)

        // truncate overflow output due to high SCROLL_DURATION
        if (output.length > desired) output.length = desired;

        console.log(`[FINISHED] Scraping ${type}.`)
        return output;
    }
}