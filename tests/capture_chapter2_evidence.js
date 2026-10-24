const puppeteer = require('./node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function run() {
    console.log('Launching browser to capture Chapter 2 evidence...');
    const browser = await puppeteer.launch({
        executablePath: EDGE_PATH,
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--ignore-certificate-errors'
        ]
    });

    const outDir = path.join(__dirname, '..', 'docs', 'screenshots', 'chapter2');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const artifactDir = 'C:\\Users\\ASUS\\.gemini\\antigravity-ide\\brain\\1b6d9b32-9cb9-415d-b03a-923dcc7af446\\screenshots\\chapter2';
    if (!fs.existsSync(artifactDir)) {
        fs.mkdirSync(artifactDir, { recursive: true });
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // 1. Capture phpMyAdmin
    console.log('Navigating to phpMyAdmin http://localhost:8080 ...');
    try {
        await page.goto('http://localhost:8080/index.php?route=/database/structure&db=cinema_db', { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(r => setTimeout(r, 1000));
        const pmaPath = path.join(outDir, 'hinh_2_1_4_phpmyadmin_cinema_db.png');
        await page.screenshot({ path: pmaPath });
        fs.copyFileSync(pmaPath, path.join(artifactDir, 'hinh_2_1_4_phpmyadmin_cinema_db.png'));
        console.log('[PASS] Captured phpMyAdmin:', pmaPath);
    } catch (e) {
        console.error('phpMyAdmin direct route error, trying base URL:', e.message);
        await page.goto('http://localhost:8080', { waitUntil: 'networkidle2', timeout: 15000 });
        const pmaPath = path.join(outDir, 'hinh_2_1_4_phpmyadmin_cinema_db.png');
        await page.screenshot({ path: pmaPath });
        fs.copyFileSync(pmaPath, path.join(artifactDir, 'hinh_2_1_4_phpmyadmin_cinema_db.png'));
        console.log('[PASS] Captured phpMyAdmin base URL:', pmaPath);
    }

    // 2. Capture HTTPS homepage via Nginx
    console.log('Navigating to HTTPS https://localhost ...');
    try {
        await page.goto('https://localhost', { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(r => setTimeout(r, 1000));
        const httpsPath = path.join(outDir, 'hinh_2_2_2_https_nginx_browser.png');
        await page.screenshot({ path: httpsPath });
        fs.copyFileSync(httpsPath, path.join(artifactDir, 'hinh_2_2_2_https_nginx_browser.png'));
        console.log('[PASS] Captured HTTPS home:', httpsPath);
    } catch (e) {
        console.error('Error capturing HTTPS home:', e.message);
    }

    await browser.close();
    console.log('Chapter 2 evidence capture completed!');
}

run().catch(console.error);
