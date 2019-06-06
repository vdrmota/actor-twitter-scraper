const Apify = require('apify');
const http = require('http');

const { pleaseOpen, liveView, localhost } = require('./messages.js');

Apify.main(async () => {

        //const input = await Apify.getValue('INPUT');
        const username = 'vojta@navtalent.com'
        const password = 'Apifier!?23'
        const input = {username, password}
    
        const browser = await Apify.launchPuppeteer();
        const page = await browser.newPage();
        await page.goto('https://twitter.com');
    
        // Login
        await page.type('[autocomplete=username]', input.username);
        await page.type('[autocomplete=current-password]', input.password);
        await page.click('[value="Log in"]');
        //await page.waitForNavigation();

        console.log('please submit verification code')
        
    
        //await browser.close();

    const verificationCode = await promptVerification()

})

async function promptVerification() {
    const port = Apify.isAtHome() ? process.env.APIFY_CONTAINER_PORT : 3000
    const promptLocation = Apify.isAtHome() ? liveView : localhost

    const server = http.createServer((req, res)=>{
        res.end("hey there")
    })

    await server.listen(port, () => console.log('server is listening on port', port))

    console.log(pleaseOpen)
    console.log(promptLocation)
    
    let code;

    while(!code){
       console.log("chekcin...")
        await new Promise(resolve => setTimeout(resolve, 10000))
    }

}