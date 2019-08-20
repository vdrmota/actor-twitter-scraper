const {
    infiniteScroll
} = require('./helpers')
const Apify = require('apify');

module.exports = {

    getActivity: async function({browser, handle, tweetCount}) {

        const SCROLL_DURATION = 0;
        const page = await browser.newPage();
        await page.goto(`https://twitter.com/${handle}/with_replies`);

        var output = {user: {}, tweets: []};

        page.on('response', async (response) => {
            if (response.url().includes('/timeline/profile/')) {         
                try {     
                    const data = await response.json();
                    Object.keys(data.globalObjects.tweets).forEach((key) => {
                        const tweet = data.globalObjects.tweets[key];
                        output.tweets.push({
                            contentText: tweet.full_text,
                            conversationId: tweet.conversation_id_str,
                            replies: tweet.reply_count,
                            retweets: tweet.retweet_count,
                            favorites: tweet.favorite_count,
                            dateTime: tweet.created_at,
                            tweetId: key,
                        })
                    })
                    Object.keys(data.globalObjects.users).forEach((key) => {
                        const user = data.globalObjects.users[key];
                        if (user.screen_name == handle) {
                            output.user.name = user.name;
                            output.user.description = user.description;
                            output.user.location = user.location;
                            output.user.joined = user.created_at;
                            output.user.username = handle;
                        }
                    })
                } catch(err) {
                    //console.log(err)
                }
            }
        });

        infiniteScroll(page, SCROLL_DURATION);

        // scraped desired number of tweets
        do {
            var oldOutputLength = output.tweets.length;
            if (oldOutputLength > 0) {
                console.log(`Scraped ${oldOutputLength} ${handle}'s tweets...`)
            }
            await new Promise(resolve => setTimeout(resolve, 10000))
        } while (output.tweets.length < tweetCount && output.tweets.length > oldOutputLength)

        // truncate overflow output due to high SCROLL_DURATION
        if (output.tweets.length > tweetCount) output.tweets.length = tweetCount;

        console.log(`Scraped ${output.tweets.length} ${handle}'s tweets...`)
        console.log(`[FINISHED] Scraping ${handle}'s tweets.`)
        return await Apify.pushData(output);
    },

    getProfile: async function({browser, handle}) {

        const page = await browser.newPage();
        await page.goto(`https://twitter.com/${handle}`);

        const userProfile = await new Promise((resolve, reject) => {
            page.on('response', async (response) => {
                if (response.url().includes('/timeline/profile/')) { 
                    try {     
                        const data = await response.json();
                        Object.keys(data.globalObjects.users).forEach((key) => {
                            const user = data.globalObjects.users[key];
                            if (user.screen_name == handle) {
                                resolve({
                                    name: user.name,
                                    description:user.description,
                                    location: user.location,
                                    joined:user.created_at,
                                    username: handle,
                                });
                            }
                        })
                    } catch(err) {
                        //reject(err);
                    }
    
                }
            });
        })       

        console.log(`[FINISHED] Scraping ${handle}'s profile.`)
        return userProfile;
    },
}