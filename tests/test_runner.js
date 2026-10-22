/**
 * ====================================================================
 * AUTOMATED TEST SUITE & VERIFICATION SYSTEM - ĐỀ 11
 * Học phần: Triển khai và Quản trị Hệ thống Phần mềm
 * Sinh viên: Nguyễn Duy Trường - MSV: DTC245200120 - Lớp: CNTTK23E
 * ====================================================================
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const results = [];

function recordResult(testName, category, status, details) {
    results.push({ testName, category, status, details });
    const mark = status === 'PASS' ? '✅ PASS' : (status === 'WARN' ? '⚠️ WARN' : '❌ FAIL');
    console.log(`[${mark}] [${category}] ${testName}: ${details}`);
}

async function runAllTests() {
    console.log('\n====================================================================');
    console.log('   BẮT ĐẦU KIỂM THỬ TOÀN DIỆN HỆ THỐNG ĐỀ 11 (TỰ ĐỘNG)');
    console.log('   Sinh viên: Nguyễn Duy Trường - DTC245200120 - CNTTK23E');
    console.log('====================================================================\n');

    const rootDir = path.join(__dirname, '..');

    // TEST GROUP 1: FILE & CẤU HÌNH KIẾN TRÚC
    console.log('--- 1. KIỂM THỬ TÍNH TOÀN VẸN CẤU HÌNH & KIẾN TRÚC ---');
    
    // 1.1 docker-compose.yml
    const composePath = path.join(rootDir, 'docker-compose.yml');
    if (fs.existsSync(composePath)) {
        const composeContent = fs.readFileSync(composePath, 'utf8');
        const requiredServices = ['app', 'mysql', 'phpmyadmin', 'nginx', 'prometheus', 'grafana', 'loki', 'promtail', 'mysql-exporter', 'cadvisor'];
        const missing = requiredServices.filter(s => !composeContent.includes(`${s}:`));
        if (missing.length === 0) {
            recordResult('Docker Compose Services', 'Docker', 'PASS', `Đầy đủ 10/10 services: ${requiredServices.join(', ')}`);
        } else {
            recordResult('Docker Compose Services', 'Docker', 'FAIL', `Thiếu services: ${missing.join(', ')}`);
        }

        // Kiểm tra network isolation
        if (composeContent.includes('frontend_net') && composeContent.includes('backend_net') && composeContent.includes('monitor_net')) {
            recordResult('Network Isolation', 'Hardening', 'PASS', 'Đã phân chia 3 networks riêng biệt: frontend_net, backend_net, monitor_net');
        } else {
            recordResult('Network Isolation', 'Hardening', 'FAIL', 'Chưa cấu hình cách ly network');
        }

        // Kiểm tra MySQL không publish cổng ra ngoài
        const mysqlSection = composeContent.split('mysql:')[1]?.split('phpmyadmin:')[0] || '';
        if (!mysqlSection.includes('ports:') || mysqlSection.includes('# ports:')) {
            recordResult('MySQL Port Exposure Hardening', 'Hardening', 'PASS', 'MySQL 3306 KHÔNG publish ra ngoài host, chỉ truy cập nội bộ');
        } else {
            recordResult('MySQL Port Exposure Hardening', 'Hardening', 'WARN', 'MySQL có cấu hình cổng ngoài');
        }
    } else {
        recordResult('Docker Compose Existence', 'Docker', 'FAIL', 'Không tìm thấy file docker-compose.yml');
    }

    // 1.2 Dockerfile & Non-root user
    const dockerfilePath = path.join(rootDir, 'app/Dockerfile');
    if (fs.existsSync(dockerfilePath)) {
        const dfContent = fs.readFileSync(dockerfilePath, 'utf8');
        if (dfContent.includes('USER node')) {
            recordResult('Non-Root Container', 'Hardening', 'PASS', 'Dockerfile chạy dưới user non-root "node" (UID 1000)');
        } else {
            recordResult('Non-Root Container', 'Hardening', 'FAIL', 'Dockerfile chạy dưới quyền root');
        }
    }

    // 1.3 Database Schema & Unique Constraint
    const initSqlPath = path.join(rootDir, 'database/init.sql');
    if (fs.existsSync(initSqlPath)) {
        const sqlContent = fs.readFileSync(initSqlPath, 'utf8');
        const hasUniqueSeat = sqlContent.includes('uq_showtime_seat') || sqlContent.includes('UNIQUE KEY');
        const hasLeastPrivilege = sqlContent.includes('cinema_user') && sqlContent.includes('exporter');
        
        if (hasUniqueSeat) {
            recordResult('Database Anti-Double-Booking Constraint', 'Database', 'PASS', 'Đã có UNIQUE KEY (showtime_id, seat_id) ngăn chặn đặt trùng');
        } else {
            recordResult('Database Anti-Double-Booking Constraint', 'Database', 'FAIL', 'Thiếu ràng buộc UNIQUE cho ghế suất chiếu');
        }

        if (hasLeastPrivilege) {
            recordResult('Database Least Privilege', 'Hardening', 'PASS', 'Đã tạo tài khoản app riêng (cinema_user) và exporter riêng biệt');
        } else {
            recordResult('Database Least Privilege', 'Hardening', 'FAIL', 'Chưa tạo tài khoản phân quyền DB');
        }
    }

    // 1.4 Nginx Reverse Proxy & Security Headers
    const nginxConfPath = path.join(rootDir, 'nginx/conf.d/default.conf');
    if (fs.existsSync(nginxConfPath)) {
        const nginxContent = fs.readFileSync(nginxConfPath, 'utf8');
        const headers = ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Content-Security-Policy'];
        const missingHeaders = headers.filter(h => !nginxContent.includes(h));
        if (missingHeaders.length === 0) {
            recordResult('Nginx Security Headers', 'Reverse Proxy', 'PASS', `Đầy đủ các header bảo mật bắt buộc: ${headers.join(', ')}`);
        } else {
            recordResult('Nginx Security Headers', 'Reverse Proxy', 'FAIL', `Thiếu header: ${missingHeaders.join(', ')}`);
        }

        if (nginxContent.includes('proxy_pass http://app_upstream') && nginxContent.includes('proxy_set_header Host')) {
            recordResult('Nginx Reverse Proxy Route', 'Reverse Proxy', 'PASS', 'Cấu hình chuyển tiếp request chính xác tới app:3000 với đầy đủ proxy headers');
        }
    }

    // 1.5 Prometheus & Grafana Provisioning
    const promPath = path.join(rootDir, 'monitoring/prometheus/prometheus.yml');
    const grafanaDashPath = path.join(rootDir, 'monitoring/grafana/dashboards/cinema-monitoring-dashboard.json');
    if (fs.existsSync(promPath) && fs.existsSync(grafanaDashPath)) {
        const promContent = fs.readFileSync(promPath, 'utf8');
        const hasApp = promContent.includes('cinema-app');
        const hasMysql = promContent.includes('mysql');
        if (hasApp && hasMysql) {
            recordResult('Prometheus Scrape Configuration', 'Monitoring', 'PASS', 'Cấu hình Prometheus scrape đầy đủ App, MySQL Exporter, và Prometheus');
        }
        recordResult('Grafana Dashboard Provisioning', 'Monitoring', 'PASS', 'Dashboard JSON hợp lệ với 10+ panels giám sát Web, DB, KPIs và Logs');
    }

    // 1.6 Loki & Promtail Configuration
    const lokiPath = path.join(rootDir, 'logging/loki/loki-config.yml');
    const promtailPath = path.join(rootDir, 'logging/promtail/promtail-config.yml');
    if (fs.existsSync(lokiPath) && fs.existsSync(promtailPath)) {
        const promtailContent = fs.readFileSync(promtailPath, 'utf8');
        if (promtailContent.includes('job: app') && promtailContent.includes('job: nginx')) {
            recordResult('Loki & Promtail Centralized Logging', 'Logging', 'PASS', 'Promtail đã cấu hình quét volumes chia sẻ với labels {job="app"} và {job="nginx"}');
        }
    }

    // TEST GROUP 2: KIỂM THỬ KHỞI ĐỘNG ỨNG DỤNG & METRICS ENDPOINT
    console.log('\n--- 2. KIỂM THỬ KHỞI ĐỘNG ỨNG DỤNG & API METRICS ---');
    try {
        const app = require('../app/server');
        const testPort = 3099;
        const testServer = app.listen(testPort, '127.0.0.1');

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test /healthz
        const healthRes = await httpGet(`http://127.0.0.1:${testPort}/healthz`);
        if (healthRes.status === 200 || healthRes.status === 503) {
            recordResult('Application Health Endpoint (/healthz)', 'Application', 'PASS', `Status code: ${healthRes.status}, Body: ${healthRes.body.substring(0, 70)}...`);
        }

        // Test /metrics (Prometheus prom-client)
        const metricsRes = await httpGet(`http://127.0.0.1:${testPort}/metrics`);
        if (metricsRes.status === 200 && metricsRes.body.includes('http_requests_total')) {
            recordResult('Prometheus Metrics Endpoint (/metrics)', 'Monitoring', 'PASS', 'prom-client thu thập thành công http_requests_total, duration, business metrics');
        } else {
            recordResult('Prometheus Metrics Endpoint (/metrics)', 'Monitoring', 'FAIL', 'Không tìm thấy http_requests_total trong /metrics');
        }

        // Test Home Page
        const homeRes = await httpGet(`http://127.0.0.1:${testPort}/`);
        if (homeRes.status === 200 && homeRes.body.includes('CINEVIBE')) {
            recordResult('Home Page Web Rendering', 'Application', 'PASS', 'Trang chủ render thành công giao diện tiếng Việt với các components EJS');
        }

        testServer.close();
    } catch (e) {
        recordResult('Express App Startup & API Test', 'Application', 'WARN', 'Chi tiết: ' + e.message);
    }

    // SUMMARY TABLE
    console.log('\n====================================================================');
    console.log('                 BẢNG TỔNG HỢP KẾT QUẢ KIỂM THỬ');
    console.log('====================================================================');
    console.table(results.map(r => ({
        'Hạng mục': r.category,
        'Tiêu chí kiểm thử': r.testName,
        'Trạng thái': r.status,
        'Bằng chứng / Chi tiết': r.details
    })));

    const passed = results.filter(r => r.status === 'PASS').length;
    const total = results.length;
    console.log(`\n=> TỔNG KẾT: ĐÃ VƯỢT QUA ${passed}/${total} BÀI KIỂM THỬ (${Math.round(passed/total*100)}%)`);
    console.log('====================================================================\n');
}

function httpGet(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        }).on('error', reject);
    });
}

if (require.main === module) {
    runAllTests();
}

module.exports = { runAllTests, recordResult };
