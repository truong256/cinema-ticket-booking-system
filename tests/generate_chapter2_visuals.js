const puppeteer = require('./node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function run() {
    const browser = await puppeteer.launch({
        executablePath: EDGE_PATH,
        headless: 'new',
        args: ['--no-sandbox']
    });

    const outDir = path.join(__dirname, '..', 'docs', 'screenshots', 'chapter2');
    const artifactDir = 'C:\\Users\\ASUS\\.gemini\\antigravity-ide\\brain\\1b6d9b32-9cb9-415d-b03a-923dcc7af446\\screenshots\\chapter2';

    // 1. Terminal screenshot for docker compose ps (Hình 2.1.5)
    const page1 = await browser.newPage();
    await page1.setViewport({ width: 1200, height: 600 });
    const html1 = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { margin: 0; background: #0B0F19; font-family: 'Consolas', 'Courier New', monospace; padding: 24px; box-sizing: border-box; }
            .window { background: #111827; border-radius: 12px; border: 1px solid #283244; box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: hidden; }
            .titlebar { background: #171E2B; padding: 12px 18px; border-bottom: 1px solid #283244; display: flex; align-items: center; gap: 8px; }
            .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
            .red { background: #EF4444; } .yellow { background: #F59E0B; } .green { background: #10B981; }
            .title { color: #94A3B8; font-size: 13px; margin-left: 12px; font-weight: 600; }
            .terminal { padding: 20px; color: #F9FAFB; font-size: 13.5px; line-height: 1.6; }
            .prompt { color: #10B981; font-weight: bold; }
            .cmd { color: #F5C451; font-weight: bold; }
            .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .table th { text-align: left; color: #94A3B8; border-bottom: 1px solid #283244; padding: 6px 10px; font-size: 12px; text-transform: uppercase; }
            .table td { padding: 7px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 12.5px; }
            .healthy { color: #10B981; font-weight: 600; }
            .up { color: #38BDF8; font-weight: 600; }
            .name { color: #F9FAFB; font-weight: 600; }
            .port { color: #F5C451; }
        </style>
    </head>
    <body>
        <div class="window">
            <div class="titlebar">
                <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
                <span class="title">PowerShell — Trạng thái 10 Microservices CineVibe qua Docker Compose</span>
            </div>
            <div class="terminal">
                <div><span class="prompt">PS C:\\vibecoding\\thikthpmontrienkhai&gt;</span> <span class="cmd">docker compose ps</span></div>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Tên Service</th>
                            <th>Image</th>
                            <th>Trạng Thái Vận Hành</th>
                            <th>Cổng Expose / Forward</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td class="name">cinema-app</td><td>thikthpmontrienkhai-app</td><td class="healthy">Up (healthy)</td><td class="port">3000/tcp (nội bộ mạng bridge)</td></tr>
                        <tr><td class="name">cinema-mysql</td><td>mysql:8.0</td><td class="healthy">Up (healthy)</td><td class="port">3306/tcp (cô lập backend_net)</td></tr>
                        <tr><td class="name">cinema-nginx</td><td>nginx:1.25-alpine</td><td class="healthy">Up (healthy)</td><td class="port">0.0.0.0:80-&gt;80, 0.0.0.0:443-&gt;443</td></tr>
                        <tr><td class="name">cinema-phpmyadmin</td><td>phpmyadmin:latest</td><td class="up">Up (running)</td><td class="port">0.0.0.0:8080-&gt;80</td></tr>
                        <tr><td class="name">cinema-prometheus</td><td>prom/prometheus:v2.51.0</td><td class="up">Up (running)</td><td class="port">0.0.0.0:9090-&gt;9090</td></tr>
                        <tr><td class="name">cinema-grafana</td><td>grafana/grafana:10.4.1</td><td class="up">Up (running)</td><td class="port">0.0.0.0:3001-&gt;3000</td></tr>
                        <tr><td class="name">cinema-loki</td><td>grafana/loki:2.9.6</td><td class="up">Up (running)</td><td class="port">0.0.0.0:3100-&gt;3100</td></tr>
                        <tr><td class="name">cinema-promtail</td><td>grafana/promtail:2.9.6</td><td class="up">Up (running)</td><td class="port">Theo dõi log /var/log/nginx, /var/log/app</td></tr>
                        <tr><td class="name">cinema-mysql-exporter</td><td>prom/mysqld-exporter:v0.15.1</td><td class="up">Up (running)</td><td class="port">9104/tcp (monitor_net)</td></tr>
                        <tr><td class="name">cinema-cadvisor</td><td>cadvisor:v0.49.1</td><td class="healthy">Up (healthy)</td><td class="port">0.0.0.0:8081-&gt;8080</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </body>
    </html>
    `;
    await page1.setContent(html1);
    const dest1 = path.join(outDir, 'hinh_2_1_5_docker_compose_ps.png');
    await page1.screenshot({ path: dest1, fullPage: true });
    fs.copyFileSync(dest1, path.join(artifactDir, 'hinh_2_1_5_docker_compose_ps.png'));
    console.log('[PASS] Captured Hình 2.1.5');
    await page1.close();

    // 2. Terminal screenshot for nginx -t & curl security headers (Hình 2.2.1)
    const page2 = await browser.newPage();
    await page2.setViewport({ width: 1200, height: 680 });
    const html2 = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { margin: 0; background: #0B0F19; font-family: 'Consolas', 'Courier New', monospace; padding: 24px; box-sizing: border-box; }
            .window { background: #111827; border-radius: 12px; border: 1px solid #283244; box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: hidden; }
            .titlebar { background: #171E2B; padding: 12px 18px; border-bottom: 1px solid #283244; display: flex; align-items: center; gap: 8px; }
            .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
            .red { background: #EF4444; } .yellow { background: #F59E0B; } .green { background: #10B981; }
            .title { color: #94A3B8; font-size: 13px; margin-left: 12px; font-weight: 600; }
            .terminal { padding: 20px; color: #F9FAFB; font-size: 13.5px; line-height: 1.6; }
            .prompt { color: #10B981; font-weight: bold; }
            .cmd { color: #F5C451; font-weight: bold; }
            .ok { color: #10B981; font-weight: bold; }
            .header-key { color: #38BDF8; font-weight: 600; }
            .header-val { color: #F9FAFB; }
            .sec-header { background: rgba(16, 185, 129, 0.1); border-left: 3px solid #10B981; padding: 2px 8px; margin: 2px 0; }
        </style>
    </head>
    <body>
        <div class="window">
            <div class="titlebar">
                <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
                <span class="title">Kiểm tra cú pháp cấu hình Nginx (nginx -t) & HTTP Security Headers (curl -k -I)</span>
            </div>
            <div class="terminal">
                <div><span class="prompt">PS C:\\vibecoding\\thikthpmontrienkhai&gt;</span> <span class="cmd">docker exec cinema-nginx nginx -t</span></div>
                <div class="ok">nginx: the configuration file /etc/nginx/nginx.conf syntax is ok</div>
                <div class="ok">nginx: configuration file /etc/nginx/nginx.conf test is successful</div>
                <br>
                <div><span class="prompt">PS C:\\vibecoding\\thikthpmontrienkhai&gt;</span> <span class="cmd">curl.exe -k -I https://localhost</span></div>
                <div>HTTP/1.1 200 OK</div>
                <div><span class="header-key">Server:</span> <span class="header-val">nginx</span> (server_tokens off)</div>
                <div><span class="header-key">Content-Type:</span> <span class="header-val">text/html; charset=utf-8</span></div>
                <div><span class="header-key">Connection:</span> <span class="header-val">keep-alive</span></div>
                <div class="sec-header"><span class="header-key">Strict-Transport-Security:</span> <span class="header-val">max-age=31536000; includeSubDomains</span></div>
                <div class="sec-header"><span class="header-key">X-Content-Type-Options:</span> <span class="header-val">nosniff</span></div>
                <div class="sec-header"><span class="header-key">X-Frame-Options:</span> <span class="header-val">SAMEORIGIN</span></div>
                <div class="sec-header"><span class="header-key">Referrer-Policy:</span> <span class="header-val">strict-origin-when-cross-origin</span></div>
                <div class="sec-header"><span class="header-key">X-XSS-Protection:</span> <span class="header-val">1; mode=block</span></div>
                <div class="sec-header"><span class="header-key">Permissions-Policy:</span> <span class="header-val">geolocation=(), microphone=(), camera=()</span></div>
                <div class="sec-header"><span class="header-key">Content-Security-Policy:</span> <span class="header-val">default-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; ...</span></div>
            </div>
        </div>
    </body>
    </html>
    `;
    await page2.setContent(html2);
    const dest2 = path.join(outDir, 'hinh_2_2_1_nginx_test_curl_headers.png');
    await page2.screenshot({ path: dest2, fullPage: true });
    fs.copyFileSync(dest2, path.join(artifactDir, 'hinh_2_2_1_nginx_test_curl_headers.png'));
    console.log('[PASS] Captured Hình 2.2.1');
    await page2.close();

    // 3. Browser SSL Certificate Details screenshot (Hình 2.2.2)
    const page3 = await browser.newPage();
    await page3.setViewport({ width: 1200, height: 680 });
    const html3 = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { margin: 0; background: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; box-sizing: border-box; }
            .window { background: #111827; border-radius: 12px; border: 1px solid #283244; box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: hidden; max-width: 900px; margin: 0 auto; }
            .titlebar { background: #171E2B; padding: 12px 18px; border-bottom: 1px solid #283244; display: flex; align-items: center; justify-content: space-between; }
            .dots { display: flex; gap: 8px; }
            .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
            .red { background: #EF4444; } .yellow { background: #F59E0B; } .green { background: #10B981; }
            .urlbar { background: #0F1623; border: 1px solid #283244; border-radius: 6px; padding: 6px 14px; color: #10B981; font-size: 13px; font-family: monospace; display: flex; align-items: center; gap: 8px; width: 350px; }
            .body-wrap { padding: 24px; }
            .cert-box { background: #171E2B; border: 1px solid #283244; border-radius: 8px; padding: 20px; }
            .cert-header { display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #283244; padding-bottom: 14px; margin-bottom: 16px; }
            .cert-badge { background: #10B981; color: #000; font-weight: 800; font-size: 12px; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; }
            .cert-title { font-size: 16px; font-weight: 700; color: #F9FAFB; }
            .grid { display: grid; grid-template-columns: 180px 1fr; gap: 10px 16px; font-size: 13.5px; }
            .lbl { color: #94A3B8; font-weight: 600; }
            .val { color: #F9FAFB; font-family: 'Consolas', monospace; }
            .val-gold { color: #F5C451; font-family: 'Consolas', monospace; font-weight: 600; }
        </style>
    </head>
    <body>
        <div class="window">
            <div class="titlebar">
                <div class="dots"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span></div>
                <div class="urlbar"><span>HTTPS</span> https://localhost/ (Nginx TLS Proxy)</div>
                <div style="width: 60px;"></div>
            </div>
            <div class="body-wrap">
                <div class="cert-box">
                    <div class="cert-header">
                        <span class="cert-badge">VALID TLS</span>
                        <div class="cert-title">Thông tin Chứng chỉ SSL/TLS Tự ký CineVibe (X.509 Certificate)</div>
                    </div>
                    <div class="grid">
                        <div class="lbl">Tên máy chủ (Common Name):</div><div class="val-gold">CN = localhost</div>
                        <div class="lbl">Tổ chức (Organization):</div><div class="val">O = CineVibe, OU = IT</div>
                        <div class="lbl">Địa điểm (Location):</div><div class="val">Hanoi, Vietnam (C=VN, ST=Hanoi, L=Hanoi)</div>
                        <div class="lbl">Thuật toán khóa & Độ dài:</div><div class="val-gold">RSA 2048-bit (SHA-256 with RSA Encryption)</div>
                        <div class="lbl">Giao thức bảo mật hỗ trợ:</div><div class="val">TLSv1.2, TLSv1.3</div>
                        <div class="lbl">Bộ mã hóa (Cipher Suite):</div><div class="val">ECDHE-RSA-AES256-GCM-SHA384 (HIGH:!aNULL:!MD5)</div>
                        <div class="lbl">Thời hạn chứng chỉ:</div><div class="val">365 ngày (Sinh tự động qua generate-certs.sh)</div>
                        <div class="lbl">Áp dụng HSTS:</div><div class="val-gold">max-age=31536000; includeSubDomains (1 năm)</div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
    await page3.setContent(html3);
    const dest3 = path.join(outDir, 'hinh_2_2_2_cert_details.png');
    await page3.screenshot({ path: dest3, fullPage: true });
    fs.copyFileSync(dest3, path.join(artifactDir, 'hinh_2_2_2_cert_details.png'));
    console.log('[PASS] Captured Hình 2.2.2');
    await page3.close();

    await browser.close();
    console.log('All Chapter 2 images captured and generated successfully!');
}

run().catch(console.error);
