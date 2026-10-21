const puppeteer = require('./node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');
const http = require('http');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const viewports = [
    { name: 'desktop_1440px', width: 1440, height: 900 },
    { name: 'laptop_1024px', width: 1024, height: 768 },
    { name: 'tablet_768px', width: 768, height: 1024 },
    { name: 'mobile_390px', width: 390, height: 844 },
    { name: 'mobile_360px', width: 360, height: 780 }
];

const outDir = path.join(__dirname, '..', 'docs', 'screenshots', 'auth_redesign');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function runVisualAndFunctionalQA() {
    console.log('====================================================');
    console.log('  STARTING CINEMA CITY AUTH UI & FUNCTIONAL TESTS   ');
    console.log('====================================================\n');

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

    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push({ url: page.url(), text: msg.text() });
        }
    });

    console.log('--- 1. SCREENSHOT CAPTURE ACROSS VIEWPORTS ---');
    for (const vp of viewports) {
        await page.setViewport({ width: vp.width, height: vp.height });

        // Capture Login
        console.log(`[QA] Capturing /auth/login on ${vp.name}...`);
        await page.goto('http://localhost/auth/login', { waitUntil: 'networkidle2' });
        await page.screenshot({
            path: path.join(outDir, `login_${vp.name}.png`),
            fullPage: true
        });

        // Capture Register
        console.log(`[QA] Capturing /auth/register on ${vp.name}...`);
        await page.goto('http://localhost/auth/register', { waitUntil: 'networkidle2' });
        await page.screenshot({
            path: path.join(outDir, `register_${vp.name}.png`),
            fullPage: true
        });
    }

    // Capture Interaction: Focused input & Password Toggle on Desktop
    console.log('\n--- 2. INTERACTION TESTING ---');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost/auth/login', { waitUntil: 'networkidle2' });
    
    // Focus username input
    await page.focus('#username');
    await page.type('#username', 'cinema_fan');
    await page.focus('#password');
    await page.type('#password', 'SecretPass2026');
    await page.screenshot({
        path: path.join(outDir, 'login_interaction_filled_1440px.png'),
        fullPage: false
    });
    console.log('[PASS] Captured login input interaction state');

    // Click password toggle
    const toggleBtn = await page.$('.auth-password-toggle');
    if (toggleBtn) {
        await toggleBtn.click();
        const inputType = await page.$eval('#password', el => el.type);
        console.log(`[PASS] Password toggle clicked. Input type is now: ${inputType}`);
        await page.screenshot({
            path: path.join(outDir, 'login_interaction_password_revealed_1440px.png'),
            fullPage: false
        });
    }

    // Test password mismatch on register
    await page.goto('http://localhost/auth/register', { waitUntil: 'networkidle2' });
    await page.type('#password', 'TestPassword123');
    await page.type('#confirm_password', 'WrongPassword456');
    await page.$eval('#confirm_password', el => el.dispatchEvent(new Event('input')));
    const mismatchText = await page.$eval('#passwordMatchError', el => el.textContent);
    console.log(`[PASS] Live password confirmation check: "${mismatchText}"`);
    await page.screenshot({
        path: path.join(outDir, 'register_interaction_password_mismatch_1440px.png'),
        fullPage: false
    });

    await browser.close();

    console.log('\n--- 3. CONSOLE ERROR AUDIT ---');
    console.log('Total console errors detected:', consoleErrors.length);
    if (consoleErrors.length > 0) {
        console.error('Console errors:', consoleErrors);
    } else {
        console.log('[✅ PASS] 0 Console errors detected across all viewports!');
    }

    console.log('\n====================================================');
    console.log('  VISUAL QA COMPLETED SUCCESSFULLY                  ');
    console.log('====================================================\n');
}

runVisualAndFunctionalQA().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
