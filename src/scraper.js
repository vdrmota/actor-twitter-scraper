module.exports = {
    async getProfile({ page, handle }) {
        const page = await browser.newPage();
        await page.goto(`https://twitter.com/${handle}`);

        const userProfile = await new Promise((resolve) => {
            page.on('response', async (response) => {
                if (response.url().includes('/timeline/profile/')) {
                    try {
                        const data = await response.json();
                        Object.keys(data.globalObjects.users).forEach((key) => {
                            const user = data.globalObjects.users[key];
                            if (user.screen_name === handle) {
                                resolve({
                                    name: user.name,
                                    description: user.description,
                                    location: user.location,
                                    joined: user.created_at,
                                    username: handle,
                                });
                            }
                        });
                    } catch (err) {
                        // reject(err);
                    }
                }
            });
        });

        console.log(`[FINISHED] Scraping ${handle}'s profile.`);
        return userProfile;
    },
};
