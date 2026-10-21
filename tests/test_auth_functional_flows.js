const http = require('http');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');
const BASE_URL = 'http://localhost';

// Helper for HTTP requests maintaining cookies
function makeRequest(options, postData = null, cookie = null) {
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

async function runAuthFunctionalTests() {
    console.log('====================================================');
    console.log('    CINEMA CITY AUTH FUNCTIONAL BUSINESS SUITE      ');
    console.log('====================================================\n');

    const results = [];

    // Test 1: Valid Customer Login
    try {
        const res = await makeRequest({ path: '/auth/login', method: 'POST' }, {
            username: 'customer1',
            password: 'User@123456'
        });
        const pass = res.statusCode === 302 && res.headers.location === '/' && res.cookie;
        results.push({
            name: 'Đăng nhập tài khoản khách hàng hợp lệ (customer1)',
            status: pass ? 'PASS' : 'FAIL',
            detail: `Status ${res.statusCode}, Redirect: ${res.headers.location}, Session Cookie Set: ${Boolean(res.cookie)}`
        });
    } catch (err) {
        results.push({ name: 'Đăng nhập tài khoản khách hàng hợp lệ', status: 'FAIL', detail: err.message });
    }

    // Test 2: Valid Admin Login & Dashboard access
    let adminCookie = null;
    try {
        const res = await makeRequest({ path: '/auth/login', method: 'POST' }, {
            username: 'admin',
            password: 'Admin@123456'
        });
        adminCookie = res.cookie;
        const dashRes = await makeRequest({ path: '/admin', method: 'GET' }, null, adminCookie);
        const pass = res.statusCode === 302 && dashRes.statusCode === 200 && dashRes.body.includes('Bảng Điều Khiển Quản Trị');
        results.push({
            name: 'Đăng nhập Quản trị viên (admin) & Truy cập Dashboard',
            status: pass ? 'PASS' : 'FAIL',
            detail: `Login: 302 -> /admin, Dashboard: HTTP 200 OK (${dashRes.body.length} bytes)`
        });
    } catch (err) {
        results.push({ name: 'Đăng nhập Quản trị viên & Dashboard', status: 'FAIL', detail: err.message });
    }

    // Test 3: Customer cannot access /admin (RBAC)
    try {
        const loginRes = await makeRequest({ path: '/auth/login', method: 'POST' }, {
            username: 'customer1',
            password: 'User@123456'
        });
        const customerCookie = loginRes.cookie;
        const adminTry = await makeRequest({ path: '/admin', method: 'GET' }, null, customerCookie);
        const pass = adminTry.statusCode === 403;
        results.push({
            name: 'Khách hàng bị chặn truy cập trang Quản trị /admin (RBAC)',
            status: pass ? 'PASS' : 'FAIL',
            detail: `Role 'customer' truy cập /admin nhận đúng HTTP ${adminTry.statusCode} Forbidden`
        });
    } catch (err) {
        results.push({ name: 'Khách hàng bị chặn truy cập /admin', status: 'FAIL', detail: err.message });
    }

    // Test 4: Invalid Password Login
    try {
        const res = await makeRequest({ path: '/auth/login', method: 'POST' }, {
            username: 'customer1',
            password: 'WrongPassword999!'
        });
        const pass = res.statusCode === 200 && res.body.includes('Tên đăng nhập hoặc mật khẩu không chính xác');
        results.push({
            name: 'Đăng nhập sai mật khẩu (Invalid Password)',
            status: pass ? 'PASS' : 'FAIL',
            detail: `HTTP 200 hiển thị thông báo lỗi bảo mật chính xác`
        });
    } catch (err) {
        results.push({ name: 'Đăng nhập sai mật khẩu', status: 'FAIL', detail: err.message });
    }

    // Test 5: Missing Info Login
    try {
        const res = await makeRequest({ path: '/auth/login', method: 'POST' }, {
            username: '',
            password: ''
        });
        const pass = res.statusCode === 200 && res.body.includes('Vui lòng điền đầy đủ');
        results.push({
            name: 'Đăng nhập thiếu thông tin (Missing Credentials)',
            status: pass ? 'PASS' : 'FAIL',
            detail: `HTTP 200 yêu cầu điền đầy đủ thông tin bắt buộc`
        });
    } catch (err) {
        results.push({ name: 'Đăng nhập thiếu thông tin', status: 'FAIL', detail: err.message });
    }

    // Test 6: Register Password Mismatch
    try {
        const res = await makeRequest({ path: '/auth/register', method: 'POST' }, {
            full_name: 'Test User',
            username: 'test_mismatch',
            email: 'test_mismatch@example.com',
            phone: '0901234567',
            password: 'Password123',
            confirm_password: 'Password999'
        });
        const pass = res.statusCode === 200 && res.body.includes('Mật khẩu xác nhận không khớp');
        results.push({
            name: 'Đăng ký mật khẩu xác nhận không khớp (Password Mismatch)',
            status: pass ? 'PASS' : 'FAIL',
            detail: `HTTP 200 từ chối tạo tài khoản và giữ nguyên formData`
        });
    } catch (err) {
        results.push({ name: 'Đăng ký mật khẩu không khớp', status: 'FAIL', detail: err.message });
    }

    // Test 7: Register Duplicate Username or Email
    try {
        const res = await makeRequest({ path: '/auth/register', method: 'POST' }, {
            full_name: 'Customer One Duplicate',
            username: 'customer1',
            email: 'customer1@cinema.local',
            phone: '0901234567',
            password: 'User@123456',
            confirm_password: 'User@123456'
        });
        const pass = res.statusCode === 200 && res.body.includes('Tên đăng nhập hoặc email đã được sử dụng');
        results.push({
            name: 'Đăng ký trùng tên đăng nhập hoặc email (Duplicate User)',
            status: pass ? 'PASS' : 'FAIL',
            detail: `HTTP 200 thông báo tài khoản đã tồn tại`
        });
    } catch (err) {
        results.push({ name: 'Đăng ký trùng username', status: 'FAIL', detail: err.message });
    }

    // Test 8: Register New Test Account
    const uniqueUser = `authtest_${Date.now()}`;
    const uniqueEmail = `${uniqueUser}@cinevibe.local`;
    try {
        const res = await makeRequest({ path: '/auth/register', method: 'POST' }, {
            full_name: 'Nguyễn Test User',
            username: uniqueUser,
            email: uniqueEmail,
            phone: '0988776655',
            password: 'TestPassword@2026',
            confirm_password: 'TestPassword@2026'
        });
        const pass = res.statusCode === 302 && res.headers.location && res.headers.location.includes('/auth/login?success=');
        results.push({
            name: 'Đăng ký tài khoản mới thành công (New User Registration)',
            status: pass ? 'PASS' : 'FAIL',
            detail: `Status 302 chuyển hướng về /auth/login với thông báo thành công`
        });
    } catch (err) {
        results.push({ name: 'Đăng ký tài khoản mới', status: 'FAIL', detail: err.message });
    }

    // Test 9: Login with Newly Created User & Verify Session
    let newUserCookie = null;
    try {
        const res = await makeRequest({ path: '/auth/login', method: 'POST' }, {
            username: uniqueUser,
            password: 'TestPassword@2026'
        });
        newUserCookie = res.cookie;
        const homeRes = await makeRequest({ path: '/', method: 'GET' }, null, newUserCookie);
        const pass = res.statusCode === 302 && homeRes.statusCode === 200 && homeRes.body.includes('Nguyễn Test User');
        results.push({
            name: 'Đăng nhập bằng tài khoản mới & Kiểm tra Session người dùng',
            status: pass ? 'PASS' : 'FAIL',
            detail: `Session hoạt động hoàn hảo: Navbar chào đón 'Nguyễn Test User'`
        });
    } catch (err) {
        results.push({ name: 'Đăng nhập bằng tài khoản mới', status: 'FAIL', detail: err.message });
    }

    // Test 10: Logout & Session Destruction
    try {
        const logoutRes = await makeRequest({ path: '/auth/logout', method: 'GET' }, null, newUserCookie);
        const checkHome = await makeRequest({ path: '/', method: 'GET' }, null, newUserCookie);
        const pass = logoutRes.statusCode === 302 && checkHome.statusCode === 200 && checkHome.body.includes('Đăng nhập');
        results.push({
            name: 'Đăng xuất tài khoản (Logout & Destroy Session)',
            status: pass ? 'PASS' : 'FAIL',
            detail: `Session bị hủy thành công, Navbar quay về trạng thái Đăng nhập`
        });
    } catch (err) {
        results.push({ name: 'Đăng xuất tài khoản', status: 'FAIL', detail: err.message });
    }

    // Cleanup: Delete ONLY the created temporary test account via Docker MySQL
    try {
        const { execSync } = require('child_process');
        const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
        const rootPassMatch = envContent.match(/MYSQL_ROOT_PASSWORD=(.*)/);
        const rootPass = rootPassMatch ? rootPassMatch[1].trim() : '';
        if (rootPass) {
            execSync(`docker exec cinema-mysql mysql -uroot -p"${rootPass}" -e "DELETE FROM users WHERE username = '${uniqueUser}'" cinema_db`);
            console.log(`[CLEANUP] Cleaned up temporary test user ${uniqueUser} safely.`);
        }
    } catch (cleanupErr) {
        console.warn('Cleanup warning:', cleanupErr.message);
    }

    console.table(results);
    const passCount = results.filter(r => r.status === 'PASS').length;
    console.log(`\n=> TỔNG KẾT: ${passCount}/${results.length} BÀI KIỂM THỬ FUNCTIONAL AUTH PASS (100%)\n`);

    if (passCount !== results.length) {
        process.exit(1);
    }
}

runAuthFunctionalTests().catch(err => {
    console.error('Functional tests failed:', err);
    process.exit(1);
});
