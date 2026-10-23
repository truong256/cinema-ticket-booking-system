const http = require('http');
const querystring = require('querystring');

function request(options, postData = null, cookie = null) {
    return new Promise((resolve, reject) => {
        const reqOptions = {
            hostname: 'localhost',
            port: 80,
            path: options.path,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        if (cookie) {
            reqOptions.headers['Cookie'] = cookie;
        }

        if (postData) {
            const body = typeof postData === 'string' ? postData : querystring.stringify(postData);
            reqOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            reqOptions.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const setCookie = res.headers['set-cookie'];
                const newCookie = setCookie ? setCookie.map(c => c.split(';')[0]).join('; ') : cookie;
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data,
                    cookie: newCookie
                });
            });
        });

        req.on('error', reject);

        if (postData) {
            const body = typeof postData === 'string' ? postData : querystring.stringify(postData);
            req.write(body);
        }

        req.end();
    });
}

async function runValidation() {
    console.log('====================================================');
    console.log(' CINEVIBE UI/UX & ROUTE NON-DESTRUCTIVE TEST SUITE  ');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`[PASS] ${message}`);
            passed++;
        } else {
            console.error(`[FAIL] ${message}`);
            failed++;
        }
    }

    // 1. Test Public Routes
    const publicRoutes = [
        { path: '/', name: 'Trang chủ (Home)', titleMatch: 'CineVibe' },
        { path: '/movies', name: 'Danh sách phim (Movies)', titleMatch: 'Danh Sách Phim' },
        { path: '/movies/1', name: 'Chi tiết phim (Movie Detail)', titleMatch: 'Dune: Part Two' },
        { path: '/showtimes', name: 'Lịch chiếu (Showtimes)', titleMatch: 'Lịch chiếu' },
        { path: '/booking/showtime/1', name: 'Sơ đồ ghế (Seats)', titleMatch: 'Chọn ghế' },
        { path: '/about', name: 'Về chúng tôi (About)', titleMatch: 'CINEVIBE' },
        { path: '/auth/login', name: 'Đăng nhập (Login)', titleMatch: 'Đăng nhập' },
        { path: '/auth/register', name: 'Đăng ký (Register)', titleMatch: 'Đăng ký' }
    ];

    console.log('--- 1. TESTING PUBLIC ROUTES (HTTP 200 & TITLE) ---');
    for (const r of publicRoutes) {
        try {
            const res = await request({ path: r.path });
            assert(res.statusCode === 200, `${r.name} returned status 200`);
            assert(res.body.includes(r.titleMatch), `${r.name} contains expected content: "${r.titleMatch}"`);
        } catch (err) {
            assert(false, `${r.name} failed with error: ${err.message}`);
        }
    }

    // 2. Test Admin Authentication & Protected Routes
    console.log('\n--- 2. TESTING ADMIN AUTHENTICATION & MANAGEMENT ROUTES ---');
    let adminCookie = null;
    try {
        const loginRes = await request(
            { path: '/auth/login', method: 'POST' },
            { username: 'admin', password: 'Admin@123456' }
        );
        assert(loginRes.statusCode === 302, 'Admin login returned redirect 302');
        adminCookie = loginRes.cookie;
        assert(adminCookie && adminCookie.includes('connect.sid'), 'Received session cookie for admin');
    } catch (err) {
        assert(false, `Admin login request failed: ${err.message}`);
    }

    const adminRoutes = [
        { path: '/admin', name: 'Bảng điều khiển quản trị (Dashboard)', match: 'Bảng Điều Khiển Quản Trị' },
        { path: '/admin/movies', name: 'Quản lý phim (Movies Admin)', match: 'Quản Lý Danh Sách Phim' },
        { path: '/admin/showtimes', name: 'Quản lý suất chiếu (Showtimes Admin)', match: 'Quản Lý Suất Chiếu' },
        { path: '/admin/bookings', name: 'Quản lý đặt vé (Bookings Admin)', match: 'Danh Sách Đơn Đặt Vé Toàn Hệ Thống' }
    ];

    for (const r of adminRoutes) {
        try {
            const res = await request({ path: r.path }, null, adminCookie);
            assert(res.statusCode === 200, `${r.name} returned status 200`);
            assert(res.body.includes(r.match), `${r.name} contains "${r.match}"`);
        } catch (err) {
            assert(false, `${r.name} failed with error: ${err.message}`);
        }
    }

    // 3. Test Customer Booking History
    console.log('\n--- 3. TESTING CUSTOMER BOOKING HISTORY ---');
    try {
        const histRes = await request({ path: '/booking/history' }, null, adminCookie);
        assert(histRes.statusCode === 200, 'Lịch sử đặt vé returned status 200');
        assert(histRes.body.includes('Lịch Sử Đặt Vé'), 'Booking history contains header');
    } catch (err) {
        assert(false, `Booking history failed: ${err.message}`);
    }

    // 4. Verification of UI/UX Minimalist Icon Cleanup Criteria
    console.log('\n--- 4. VERIFYING MINIMALIST ICON CLEANUP CRITERIA ---');
    try {
        // Navbar
        const homeRes = await request({ path: '/' });
        assert(!homeRes.body.includes('<i class="fas fa-house"></i> Trang chủ'), 'Navbar: Decorative home icon removed');
        assert(!homeRes.body.includes('<i class="fas fa-film"></i> Phim'), 'Navbar: Decorative film icon removed');
        assert(homeRes.body.includes('fa-bars'), 'Navbar: Mobile hamburger toggle icon preserved');

        // Login
        const loginPage = await request({ path: '/auth/login' });
        assert(!loginPage.body.includes('fa-user auth-input-icon'), 'Login: Decorative user input icon removed');
        assert(loginPage.body.includes('auth-password-toggle'), 'Login: Password visibility toggle preserved');

        // Admin Dashboard KPI
        const adminDash = await request({ path: '/admin' }, null, adminCookie);
        assert(!adminDash.body.includes('class="brand-badge gold"><i class="fas fa-shield-halved"></i>'), 'Admin: Badge shield icon removed');
        assert(adminDash.body.includes('Phim Đang Hoạt Động'), 'Admin: KPI typography preserved');
    } catch (err) {
        assert(false, `Cleanup criteria check failed: ${err.message}`);
    }

    console.log('\n====================================================');
    console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED `);
    console.log('====================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runValidation().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
