const puppeteer = require('./node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function run() {
    console.log('Launching browser to capture Admin Redesign screenshots...');
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

    const outDir = path.join(__dirname, '..', 'docs', 'screenshots', 'admin_redesign');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const artifactDir = 'C:\\Users\\ASUS\\.gemini\\antigravity-ide\\brain\\1b6d9b32-9cb9-415d-b03a-923dcc7af446\\screenshots\\admin_redesign';
    if (!fs.existsSync(artifactDir)) {
        fs.mkdirSync(artifactDir, { recursive: true });
    }

    const adminPage = await browser.newPage();
    await adminPage.setViewport({ width: 1440, height: 900 });

    console.log('Logging in as admin...');
    await adminPage.goto('http://localhost/auth/login', { waitUntil: 'networkidle2' });
    await adminPage.type('input[name="username"]', 'admin');
    await adminPage.type('input[name="password"]', 'Admin@123456');
    await Promise.all([
        adminPage.waitForNavigation({ waitUntil: 'networkidle2' }),
        adminPage.click('button[type="submit"]')
    ]);

    const adminPages = [
        { name: '01_dashboard', url: 'http://localhost/admin' },
        { name: '02_movies', url: 'http://localhost/admin/movies' },
        { name: '03_showtimes', url: 'http://localhost/admin/showtimes' },
        { name: '04_cinemas', url: 'http://localhost/admin/cinemas' },
        { name: '05_rooms', url: 'http://localhost/admin/rooms' },
        { name: '06_room_seats', url: 'http://localhost/admin/rooms/1/seats' },
        { name: '07_bookings', url: 'http://localhost/admin/bookings' },
        { name: '08_users', url: 'http://localhost/admin/users' }
    ];

    const viewports = [
        { suffix: 'desktop', width: 1440, height: 900 },
        { suffix: 'tablet', width: 768, height: 1024 },
        { suffix: 'mobile', width: 375, height: 812 }
    ];

    for (const vp of viewports) {
        console.log(`\n--- Capturing viewport: ${vp.suffix} (${vp.width}x${vp.height}) ---`);
        await adminPage.setViewport({ width: vp.width, height: vp.height });

        for (const item of adminPages) {
            try {
                await adminPage.goto(item.url, { waitUntil: 'networkidle2', timeout: 15000 });
                await new Promise(r => setTimeout(r, 600));

                const filename = `${item.name}_${vp.suffix}.png`;
                const destDocs = path.join(outDir, filename);
                const destArtifact = path.join(artifactDir, filename);

                await adminPage.screenshot({ path: destDocs, fullPage: false });
                fs.copyFileSync(destDocs, destArtifact);
                console.log(`[PASS] Captured: ${filename}`);
            } catch (err) {
                console.error(`[FAIL] Error capturing ${item.name} on ${vp.suffix}:`, err.message);
            }
        }
    }

    await adminPage.close();
    await browser.close();
    console.log('\nAll Admin screenshots captured successfully!');
}

run().catch(console.error);
