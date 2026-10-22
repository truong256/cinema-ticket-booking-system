const puppeteer = require('./node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testLaunch() {
    console.log('Testing Edge launch via puppeteer-core...');
    const browser = await puppeteer.launch({
        executablePath: EDGE_PATH,
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1440,900'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost', { waitUntil: 'networkidle2' });
    const title = await page.title();
    console.log('Page Title:', title);

    const outDir = path.join(__dirname, '..', 'docs', 'screenshots');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    
    await page.screenshot({ path: path.join(outDir, 'test_home.png') });
    console.log('Test screenshot saved to docs/screenshots/test_home.png');

    await browser.close();
    console.log('Browser closed successfully.');
}

testLaunch().catch(err => {
    console.error('Launch test failed:', err);
    process.exit(1);
});
