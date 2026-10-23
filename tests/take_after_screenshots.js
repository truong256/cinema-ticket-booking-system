const puppeteer = require('./node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function run() {
    console.log('Launching browser to capture AFTER screenshots...');
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

    const outDir = path.join(__dirname, '..', 'docs', 'screenshots', 'after_optimization');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const pagesToCapture = [
        { name: 'home', url: 'http://localhost/' },
        { name: 'movies', url: 'http://localhost/movies' },
        { name: 'movie_detail', url: 'http://localhost/movies/1' },
        { name: 'seats', url: 'http://localhost/booking/showtime/1' },
        { name: 'about', url: 'http://localhost/about' },
        { name: 'login', url: 'http://localhost/auth/login' },
        { name: 'register', url: 'http://localhost/auth/register' },
        { name: 'history', url: 'http://localhost/booking/history' }
    ];

    const viewports = [
        { suffix: 'desktop', width: 1440, height: 900 },
        { suffix: 'mobile', width: 375, height: 812 }
    ];

    // 1. Capture public and customer pages
    for (const vp of viewports) {
        console.log(`\nCapturing in viewport: ${vp.suffix} (${vp.width}x${vp.height})`);
        const page = await browser.newPage();
        await page.setViewport({ width: vp.width, height: vp.height });

        for (const item of pagesToCapture) {
            try {
                await page.goto(item.url, { waitUntil: 'networkidle2', timeout: 15000 });
                // brief pause for transitions
                await new Promise(r => setTimeout(r, 600));
                const dest = path.join(outDir, `${item.name}_${vp.suffix}.png`);
                await page.screenshot({ path: dest, fullPage: false });
                console.log(`Saved: ${item.name}_${vp.suffix}.png`);
            } catch (err) {
                console.error(`Failed ${item.name} on ${vp.suffix}:`, err.message);
            }
        }
        await page.close();
    }

    // 2. Capture Admin pages with login session
    console.log('\nLogging into Admin to capture admin pages...');
    const adminPage = await browser.newPage();
    await adminPage.setViewport({ width: 1440, height: 900 });
    await adminPage.goto('http://localhost/auth/login', { waitUntil: 'networkidle2' });
    await adminPage.type('input[name="username"]', 'admin');
    await adminPage.type('input[name="password"]', 'Admin@123456');
    await Promise.all([
        adminPage.waitForNavigation({ waitUntil: 'networkidle2' }),
        adminPage.click('button[type="submit"]')
    ]);

    const adminUrls = [
        { name: 'admin_dashboard', url: 'http://localhost/admin' },
        { name: 'admin_movies', url: 'http://localhost/admin/movies' },
        { name: 'admin_showtimes', url: 'http://localhost/admin/showtimes' },
        { name: 'admin_bookings', url: 'http://localhost/admin/bookings' }
    ];

    for (const vp of viewports) {
        await adminPage.setViewport({ width: vp.width, height: vp.height });
        for (const item of adminUrls) {
            try {
                await adminPage.goto(item.url, { waitUntil: 'networkidle2', timeout: 15000 });
                await new Promise(r => setTimeout(r, 600));
                const dest = path.join(outDir, `${item.name}_${vp.suffix}.png`);
                await adminPage.screenshot({ path: dest, fullPage: false });
                console.log(`Saved: ${item.name}_${vp.suffix}.png`);
            } catch (err) {
                console.error(`Failed ${item.name} on ${vp.suffix}:`, err.message);
            }
        }
    }
    await adminPage.close();

    await browser.close();
    console.log('\nAll AFTER screenshots captured successfully into docs/screenshots/after_optimization/!');
}

run().catch(err => {
    console.error('Execution error:', err);
    process.exit(1);
});
