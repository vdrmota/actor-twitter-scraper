const Apify = require('apify');
const { infiniteScroll } = require('./helpers');

const { log, sleep } = Apify.utils;

Apify.main(async () => {
    const input = await Apify.getValue('INPUT');

    const proxyConfiguration = await Apify.createProxyConfiguration(input.proxyConfig);
    const { tweetsDesired, mode = 'replies' } = input;

    const requestList = await Apify.openRequestList('HANDLES', input.handle.map((handle) => ({
        url: `https://twitter.com/${handle}${mode === 'replies' ? '/with_replies' : ''}`,
        userData: {
            handle,
        },
    })));

    const isLoggingIn = input.initialCookies && input.initialCookies.length > 0;

    const crawler = new Apify.PuppeteerCrawler({
        handlePageTimeoutSecs: 3600,
        requestList,
        proxyConfiguration,
        maxConcurrency: isLoggingIn ? 1 : undefined,
        sessionPoolOptions: {
            createSessionFunction: (sessionPool) => {
                const session = new Apify.Session({
                    sessionPool,
                    maxUsageCount: isLoggingIn ? 2000 : 50,
                    maxErrorScore: 1,
                });

                if (isLoggingIn) {
                    session.setPuppeteerCookies(input.initialCookies, 'https://twitter.com');
                }

                return session;
            },
        },
        useSessionPool: true,
        persistCookiesPerSession: true,
        gotoFunction: async ({ page, request, puppeteerPool, session }) => {
            await Apify.utils.puppeteer.blockRequests(page, {
                urlPatterns: [
                    '.jpg',
                    '.jpeg',
                    '.gif',
                    '.svg',
                    '.png',
                    'pbs.twimg.com/semantic_core_img',
                    'pbs.twimg.com/profile_banners',
                    'pbs.twimg.com/media',
                    'pbs.twimg.com/card_img',
                    'www.google-analytics.com',
                ],
            });

            try {
                return page.goto(request.url, {
                    waitUntil: 'domcontentloaded',
                });
            } catch (e) {
                session.retire();
                await puppeteerPool.retire(page.browser());

                throw new Error('Failed to load page, retrying');
            }
        },
        handlePageFunction: async ({ request, page }) => {
            const { handle } = request.userData;

            const output = {
                user: {},
                tweets: [],
            };

            const getResponse = async (response) => {
                try {
                    if (response.url().includes('/timeline/profile/')) {
                        const data = await response.json();

                        Object.entries(data.globalObjects.tweets).forEach(([tweetId, tweet]) => {
                            log.debug('Tweet data', tweet);

                            output.tweets.push({
                                contentText: tweet.full_text,
                                conversationId: tweet.conversation_id_str,
                                replies: tweet.reply_count,
                                retweets: tweet.retweet_count,
                                favorites: tweet.favorite_count,
                                dateTime: new Date(tweet.created_at).toISOString(),
                                tweetId,
                            });
                        });

                        Object.values(data.globalObjects.users).forEach((user) => {
                            if (user.screen_name === handle) {
                                output.user.name = user.name;
                                output.user.description = user.description;
                                output.user.location = user.location;
                                output.user.joined = new Date(user.created_at).toISOString();
                                output.user.username = handle;
                            }
                        });
                    }
                } catch (err) {
                    log.debug(err.message, { handle });
                }
            };

            page.on('response', getResponse);

            infiniteScroll(page, 0);

            // scraped desired number of tweets
            let oldOutputLength = 0;
            do {
                oldOutputLength = output.tweets.length;

                if (oldOutputLength > 0) {
                    log.info(`Scraped ${oldOutputLength} ${handle}'s tweets...`);
                }

                await sleep(20000);
            } while (output.tweets.length < tweetsDesired && output.tweets.length > oldOutputLength);

            // truncate overflow output due to high SCROLL_DURATION
            if (output.tweets.length > tweetsDesired) {
                output.tweets.length = tweetsDesired;
            }

            log.info(`Scraped ${output.tweets.length} ${handle}'s tweets...`);

            await Apify.pushData(output);

            output.tweets.length = 0;

            log.info(`[FINISHED] Scraping ${handle}'s profile.`);
        },
    });

    log.info('Starting scraper');

    await crawler.run();

    log.info('All finished');
});
