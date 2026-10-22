const puppeteer = require('./node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE_URL = 'http://localhost';
const ARTIFACT_DIR = 'C:\\Users\\ASUS\\.gemini\\antigravity-ide\\brain\\4db15f33-d79b-497b-9ba4-f9e01b2e52e0';
const DOCS_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

const VIEWPORTS = {
    desktop: { width: 1440, height: 900, name: 'desktop_1440px' },
    tablet: { width: 768, height: 1024, name: 'tablet_768px' },
    mobile: { width: 375, height: 812, name: 'mobile_375px' }
};

// Đảm bảo thư mục lưu screenshot
for (const vp of Object.values(VIEWPORTS)) {
    fs.mkdirSync(path.join(DOCS_DIR, vp.name), { recursive: true });
}
fs.mkdirSync(path.join(DOCS_DIR, 'interactions'), { recursive: true });

function copyToArtifact(sourcePath, filename) {
    try {
        const destPath = path.join(ARTIFACT_DIR, filename);
        fs.copyFileSync(sourcePath, destPath);
    } catch (e) {
        console.error(`Failed to copy to artifact: ${filename}`, e.message);
    }
}

async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 400;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    window.scrollTo(0, 0);
                    resolve();
                }
            }, 60);
        });
    });
    await new Promise(r => setTimeout(r, 250));
}

async function runComprehensiveTests() {
    console.log('===============================================================');
    console.log('   BẮT ĐẦU KIỂM THỬ GIAO DIỆN DARK CINEMA VỚI TRÌNH DUYỆT THẬT   ');
    console.log('===============================================================\n');

    const testResults = [];

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
    // Tắt HTTP cache để đảm bảo mỗi viewport tải fresh HTML (tránh HTTP 304 ETag)
    await page.setCacheEnabled(false);

    // 1. Chụp ảnh 3 kích thước cho các trang công khai
    const publicPages = [
        { name: '01_home', url: '/' },
        { name: '02_movies_catalog', url: '/movies' },
        { name: '03_movie_detail', url: '/movies/1' },
        { name: '04_showtimes_list', url: '/showtimes' },
        { name: '05_seat_selection', url: '/booking/showtime/1' },
        { name: '06_login', url: '/auth/login' },
        { name: '07_register', url: '/auth/register' }
    ];

    for (const p of publicPages) {
        console.log(`[TEST PAGE] Kiểm tra trang: ${p.name} (${p.url})`);
        for (const [vpKey, vp] of Object.entries(VIEWPORTS)) {
            await page.setViewport({ width: vp.width, height: vp.height });
            const response = await page.goto(`${BASE_URL}${p.url}`, { waitUntil: 'networkidle2' });
            const status = response ? response.status() : 200;
            
            // Scroll to trigger any lazy-loaded elements and animations
            await autoScroll(page);

            // Full page screenshot
            const shotFilename = `${p.name}_${vp.width}px.png`;
            const shotPath = path.join(DOCS_DIR, vp.name, shotFilename);
            await page.screenshot({ path: shotPath, fullPage: true });
            copyToArtifact(shotPath, shotFilename);

            const passed = (status === 200 || status === 304);
            testResults.push({
                suite: 'Responsive Visual Verification',
                test: `${p.name} @ ${vp.width}px (${vpKey})`,
                status: passed ? 'PASS' : 'FAIL',
                details: `HTTP ${status}, Viewport ${vp.width}x${vp.height}, Screenshot: ${shotFilename}`
            });
        }
    }

    // 2. Kiểm tra tương tác: Lọc thể loại trên Trang chủ (Desktop)
    console.log('\n[TEST INTERACTION] Kiểm tra Lọc thể loại trên Trang chủ...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    
    // Click tab Hành động
    const actionTab = await page.$('button[data-genre="Hành động"]');
    if (actionTab) {
        await actionTab.click();
        await new Promise(r => setTimeout(r, 400));
        const filteredCount = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('#homeMoviesGrid .movie-card'));
            return cards.filter(c => c.style.display !== 'none').length;
        });
        const shotPath = path.join(DOCS_DIR, 'interactions', '08_home_genre_filter_action.png');
        await page.screenshot({ path: shotPath });
        copyToArtifact(shotPath, '08_home_genre_filter_action.png');
        
        testResults.push({
            suite: 'Interactive UX',
            test: 'Lọc thể loại "Hành động" trên Trang chủ',
            status: filteredCount > 0 ? 'PASS' : 'FAIL',
            details: `Lọc thành công: ${filteredCount} phim hiển thị`
        });
    }

    // 3. Kiểm tra tương tác: Tìm kiếm phim theo tên trên /movies
    console.log('\n[TEST INTERACTION] Kiểm tra Tìm kiếm phim theo tên trên /movies...');
    await page.goto(`${BASE_URL}/movies`, { waitUntil: 'networkidle2' });
    await page.type('#movieSearchInput', 'Dune', { delay: 100 });
    await new Promise(r => setTimeout(r, 400));
    const searchMatchCount = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('#moviesCatalogGrid .movie-card'));
        return cards.filter(c => c.style.display !== 'none').length;
    });
    const searchShotPath = path.join(DOCS_DIR, 'interactions', '09_movies_search_dune.png');
    await page.screenshot({ path: searchShotPath });
    copyToArtifact(searchShotPath, '09_movies_search_dune.png');

    testResults.push({
        suite: 'Interactive UX',
        test: 'Tìm kiếm phim "Dune" thời gian thực',
        status: searchMatchCount === 1 ? 'PASS' : 'FAIL',
        details: `Hiển thị chính xác ${searchMatchCount} phim khớp từ khóa`
    });

    // 4. Kiểm tra tương tác: Đặt ghế, tính tổng tiền, thanh toán giả lập và xem vé điện tử
    console.log('\n[TEST INTERACTION] Kiểm tra Chọn ghế, Tính tổng tiền, Đặt vé & Thanh toán...');
    await page.goto(`${BASE_URL}/booking/showtime/1`, { waitUntil: 'networkidle2' });
    
    // Tìm các ghế trống chưa đặt
    const availableSeatIds = await page.evaluate(() => {
        const seats = Array.from(document.querySelectorAll('.seat:not(.booked)'));
        return seats.slice(0, 2).map(s => s.getAttribute('data-id'));
    });

    if (availableSeatIds.length >= 2) {
        // Click 2 ghế
        await page.click(`.seat[data-id="${availableSeatIds[0]}"]`);
        await page.click(`.seat[data-id="${availableSeatIds[1]}"]`);
        await new Promise(r => setTimeout(r, 300));

        // Kiểm tra số lượng và tổng tiền cập nhật
        const summaryState = await page.evaluate(() => {
            const badge = document.getElementById('selectedCountBadge')?.textContent;
            const price = document.getElementById('totalPrice')?.textContent;
            const btnDisabled = document.getElementById('btnSubmitBooking')?.disabled;
            return { badge, price, btnDisabled };
        });

        const seatShotPath = path.join(DOCS_DIR, 'interactions', '10_seats_selected_calculated.png');
        await page.screenshot({ path: seatShotPath });
        copyToArtifact(seatShotPath, '10_seats_selected_calculated.png');

        testResults.push({
            suite: 'Interactive UX',
            test: 'Chọn ghế & Tính tổng tiền động',
            status: (!summaryState.btnDisabled && summaryState.badge.includes('2 ghế')) ? 'PASS' : 'FAIL',
            details: `Badge: ${summaryState.badge}, Tổng tiền: ${summaryState.price}, Nút tiếp tục enabled`
        });

        // Điền thông tin khách hàng và submit
        await page.$eval('#customerName', el => el.value = 'Nguyễn Duy Trường - Test Browser');
        await page.$eval('#customerEmail', el => el.value = 'truong.test@cinevibe.local');
        await page.$eval('#customerPhone', el => el.value = '0988776655');

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('#btnSubmitBooking')
        ]);

        const paymentUrl = page.url();
        console.log(`Đã chuyển hướng đến: ${paymentUrl}`);

        const paymentShotPath = path.join(DOCS_DIR, 'interactions', '11_checkout_payment_page.png');
        await page.screenshot({ path: paymentShotPath, fullPage: true });
        copyToArtifact(paymentShotPath, '11_checkout_payment_page.png');

        testResults.push({
            suite: 'Interactive UX',
            test: 'Đặt vé thành công & Điều hướng thanh toán',
            status: paymentUrl.includes('/booking/payment/') ? 'PASS' : 'FAIL',
            details: `URL: ${paymentUrl}`
        });

        // Chọn phương thức VNPAY_MOCK và hoàn tất thanh toán qua #btnPaySuccess
        const btnPaySuccess = await page.$('#btnPaySuccess');
        if (btnPaySuccess) {
            console.log('Nhấn nút xác nhận thanh toán giả lập (#btnPaySuccess)...');
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2' }),
                btnPaySuccess.click()
            ]);

            const successUrl = page.url();
            console.log(`Đã hoàn tất thanh toán, chuyển hướng đến: ${successUrl}`);

            const ticketShotPath = path.join(DOCS_DIR, 'interactions', '12_eticket_confirmation_success.png');
            await page.screenshot({ path: ticketShotPath, fullPage: true });
            copyToArtifact(ticketShotPath, '12_eticket_confirmation_success.png');

            testResults.push({
                suite: 'Interactive UX',
                test: 'Thanh toán giả lập & Xuất vé điện tử E-Ticket',
                status: successUrl.includes('/booking/success/') ? 'PASS' : 'FAIL',
                details: `Xác nhận vé thành công: ${successUrl}`
            });
        }
    }

    // 5. Kiểm tra Mobile Hamburger Menu trên 375px
    console.log('\n[TEST INTERACTION] Kiểm tra Mobile Hamburger Menu trên 375px...');
    await page.setViewport({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await page.click('#mobileMenuBtn');
    await new Promise(r => setTimeout(r, 400));
    
    const isMenuShow = await page.evaluate(() => {
        return document.getElementById('navLinks')?.classList.contains('show');
    });

    const mobileMenuShotPath = path.join(DOCS_DIR, 'interactions', '13_mobile_hamburger_menu_open.png');
    await page.screenshot({ path: mobileMenuShotPath });
    copyToArtifact(mobileMenuShotPath, '13_mobile_hamburger_menu_open.png');

    testResults.push({
        suite: 'Responsive UX',
        test: 'Mobile Hamburger Menu toggle (375px)',
        status: isMenuShow ? 'PASS' : 'FAIL',
        details: 'Menu hiển thị điều hướng và nút Đăng nhập / Đăng ký di động'
    });

    // 6. Đăng nhập Admin & Kiểm tra toàn bộ Giao diện Quản trị
    console.log('\n[TEST ADMIN] Đăng nhập quản trị viên & kiểm tra giao diện Admin...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle2' });
    await page.type('#username', 'admin');
    await page.type('#password', 'Admin@123456');

    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.click('button[type="submit"]')
    ]);

    const adminPages = [
        { name: '14_admin_dashboard', url: '/admin' },
        { name: '15_admin_movies', url: '/admin/movies' },
        { name: '16_admin_showtimes', url: '/admin/showtimes' },
        { name: '17_admin_bookings', url: '/admin/bookings' }
    ];

    for (const ap of adminPages) {
        console.log(`[TEST ADMIN] Kiểm tra trang quản trị: ${ap.name} (${ap.url})`);
        for (const [vpKey, vp] of Object.entries(VIEWPORTS)) {
            await page.setViewport({ width: vp.width, height: vp.height });
            const response = await page.goto(`${BASE_URL}${ap.url}`, { waitUntil: 'networkidle2' });
            const status = response ? response.status() : 200;

            await autoScroll(page);

            const shotFilename = `${ap.name}_${vp.width}px.png`;
            const shotPath = path.join(DOCS_DIR, vp.name, shotFilename);
            await page.screenshot({ path: shotPath, fullPage: true });
            copyToArtifact(shotPath, shotFilename);

            const passed = (status === 200 || status === 304);
            testResults.push({
                suite: 'Admin Dark Cinema Design',
                test: `${ap.name} @ ${vp.width}px (${vpKey})`,
                status: passed ? 'PASS' : 'FAIL',
                details: `HTTP ${status}, Viewport ${vp.width}x${vp.height}, Screenshot: ${shotFilename}`
            });
        }
    }

    await browser.close();

    console.log('\n===============================================================');
    console.log('                 BẢNG KẾT QUẢ KIỂM THỬ PASS/FAIL                ');
    console.log('===============================================================');
    let passCount = 0;
    let failCount = 0;
    for (const r of testResults) {
        if (r.status === 'PASS') passCount++;
        else failCount++;
        console.log(`[${r.status}] [${r.suite}] ${r.test} -> ${r.details}`);
    }
    console.log(`\nTổng kết: ${passCount} PASS / ${failCount} FAIL (Tổng số: ${testResults.length} bài kiểm thử).`);

    // Lưu kết quả JSON ra tests/test_results.json
    fs.writeFileSync(
        path.join(__dirname, 'test_results.json'),
        JSON.stringify({ timestamp: new Date().toISOString(), passCount, failCount, results: testResults }, null, 2)
    );
}

runComprehensiveTests().catch(err => {
    console.error('Test script crashed:', err);
    process.exit(1);
});
