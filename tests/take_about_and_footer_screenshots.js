const puppeteer = require('./node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const viewports = [
    { name: 'desktop_1440px', width: 1440, height: 900 },
    { name: 'tablet_768px', width: 768, height: 1024 },
    { name: 'mobile_375px', width: 375, height: 812 }
];

async function runCapture() {
    console.log('Launching browser to capture redesigned About page & Footer...');
    const browser = await puppeteer.launch({
        executablePath: EDGE_PATH,
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });

    const outDir = path.join(__dirname, '..', 'docs', 'screenshots', 'about_redesign');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });

    for (const vp of viewports) {
        await page.setViewport({ width: vp.width, height: vp.height });

        // 1. Capture About Page
        console.log(`Capturing /about on ${vp.name}...`);
        await page.goto('http://localhost/about', { waitUntil: 'networkidle2' });
        await page.screenshot({
            path: path.join(outDir, `about_${vp.name}.png`),
            fullPage: true
        });

        // 2. Capture Home Page (verifying removal of Đề 11 section)
        console.log(`Capturing / (Home) on ${vp.name}...`);
        await page.goto('http://localhost/', { waitUntil: 'networkidle2' });
        await page.screenshot({
            path: path.join(outDir, `home_${vp.name}.png`),
            fullPage: true
        });
    }

    // Capture focused footer screenshot
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost/about', { waitUntil: 'networkidle2' });
    const footerElem = await page.$('.footer');
    if (footerElem) {
        await footerElem.screenshot({ path: path.join(outDir, 'footer_desktop_1440px.png') });
        console.log('Captured footer_desktop_1440px.png');
    }

    await page.setViewport({ width: 375, height: 812 });
    await page.goto('http://localhost/about', { waitUntil: 'networkidle2' });
    const footerElemMob = await page.$('.footer');
    if (footerElemMob) {
        await footerElemMob.screenshot({ path: path.join(outDir, 'footer_mobile_375px.png') });
        console.log('Captured footer_mobile_375px.png');
    }

    await browser.close();

    console.log('\n=== Screenshots Summary ===');
    console.log('Console Errors detected:', consoleErrors.length);
    if (consoleErrors.length > 0) {
        console.log('Errors:', consoleErrors);
    } else {
        console.log('[PASS] 0 console errors detected!');
    }
}

runCapture().catch(err => {
    console.error('Capture failed:', err);
    process.exit(1);
});
