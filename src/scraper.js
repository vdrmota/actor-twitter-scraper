const {
    infiniteScroll
} = require('./helpers')

module.exports = {

    getActivity: async function({browser, handle, tweetCount}) {

        const SCROLL_DURATION = 10;
        const page = await browser.newPage();
        await page.goto(`https://twitter.com/${handle}/with_replies`);

        var output = [];

        page.on('response', async (response) => {
            if (response.url().includes('/timeline/profile/')) {         
                try {     
                    const data = await response.json();
                    Object.keys(data.globalObjects.tweets).forEach((key) => {
                        const tweet = data.globalObjects.tweets[key];
                        output.push({
                            contentText: tweet.full_text,
                            conversationId: tweet.conversation_id_str,
                            replies: tweet.reply_count,
                            retweets: tweet.retweet_count,
                            favorites: tweet.favorite_count,
                            dateTime: tweet.created_at,
                            tweetId: key,
                        })
                    })
                } catch(err) {
                    //console.log(err)
                }
            }
        });

        // scraped desired number of tweets
        do {
            var oldOutputLength = output.length;
            if (oldOutputLength > 0) {
                console.log("Scraped " + oldOutputLength + " tweets")
            }
            await infiniteScroll(page, SCROLL_DURATION);
        } while (output.length < tweetCount && output.length > oldOutputLength)

        // truncate overflow output due to high SCROLL_DURATION
        if (output.length > tweetCount) output.length = tweetCount;

        console.log("Scraped " + output.length + " tweets")
        console.log("[FINISHED] Scraping tweets.")
        return output;
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
                        reject(err);
                    }
    
                }
            });
        })       

        console.log("[FINISHED] Scraping profile.")
        return userProfile;
    },
}