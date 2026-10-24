# HỆ THỐNG ĐẶT VÉ XEM PHIM / SỰ KIỆN - ĐỀ TÀI SỐ 11
> **Học phần:** Triển khai và Quản trị Hệ thống Phần mềm  
> **Sinh viên thực hiện:** Nguyễn Duy Trường  
> **Mã sinh viên:** DTC245200120  
> **Lớp:** CNTTK23E  
> **GitHub Repository:** [https://github.com/truong256/cinema-ticket-booking-system.git](https://github.com/truong256/cinema-ticket-booking-system.git)  
> **Mục tiêu điểm số:** 10/10 Điểm (Đáp ứng trọn vẹn 7/7 Tiêu chí Nghiệm thu)

---

## 1. GIỚI THIỆU HỆ THỐNG
Hệ thống **Đề 11 – Hệ thống Đặt vé Xem phim / Sự kiện** là một giải pháp trực tuyến toàn diện cho phép khách hàng tra cứu lịch chiếu, lựa chọn ghế ngồi trực quan theo từng loại phòng chiếu (Standard, IMAX, VIP Lounge), tính toán giá vé tự động và thực hiện thanh toán giả lập (VNPAY QR, MoMo, Thẻ ATM nội địa). 

Hệ thống được đóng gói và vận hành hoàn chỉnh trên nền tảng **Docker Compose** với 9 dịch vụ phân tầng bảo mật, tích hợp đầy đủ hệ thống cân bằng tải & Gateway **Nginx Reverse Proxy**, hệ thống giám sát hiệu năng **Prometheus + Grafana**, hệ thống quản lý nhật ký tập trung **Loki + Promtail**, cùng 6 kỹ thuật siết chặt an ninh (**Hardening**).

---

## 2. KIẾN TRÚC TỔNG THỂ & SƠ ĐỒ MẠNG NỘI BỘ

```mermaid
graph TD
    Client([Trình duyệt Khách hàng / Quản trị viên]) -->|Port 80/443| Nginx[Nginx Reverse Proxy & Security Headers]

    subgraph "Mạng Frontend (frontend_net)"
        Nginx -->|Proxy Pass http://app:3000| App[Web Application: Node.js + Express + EJS]
    end

    subgraph "Mạng Backend Nội Bộ (backend_net - Cô Lập Cổng 3306)"
        App -->|MySQL Protocol| MySQL[(MySQL 8.0 Database)]
        PMA[phpMyAdmin :8080] --> MySQL
        MySQLExp[MySQL Exporter :9104] --> MySQL
    end

    subgraph "Mạng Giám Sát & Nhật Ký (monitor_net)"
        Prometheus[Prometheus :9090] -->|Scrape /metrics| App
        Prometheus -->|Scrape :9104| MySQLExp
        Grafana[Grafana Dashboard :3001] -->|Query| Prometheus
        Grafana -->|Query LogQL| Loki[Loki Server :3100]
        Promtail[Promtail Shipper] -->|Ship logs| Loki
        App -.->|Shared Volume logs| Promtail
        Nginx -.->|Shared Volume logs| Promtail
    end
```

---

## 3. DANH SÁCH 10 DỊCH VỤ DOCKER COMPOSE

| STT | Tên Service | Image Docker | Cổng Host | Vai trò trong hệ thống |
|:---:|---|---|:---:|---|
| 1 | **app** | `Dockerfile (node:20-alpine)` | Nội bộ (3000) | Web App đặt vé, render EJS, xuất Prometheus metrics `/metrics`, chạy user non-root `node` |
| 2 | **mysql** | `mysql:8.0` | **Không map ra host** | Lưu trữ CSDL, Transaction ACID, chống đặt trùng ghế (`uq_showtime_seat`) |
| 3 | **phpmyadmin** | `phpmyadmin/phpmyadmin` | `8080:80` | Quản trị CSDL MySQL trực quan |
| 4 | **nginx** | `nginx:1.25-alpine` | `80:80`, `443:443` | Reverse Proxy, SSL tự ký, kiểm soát Security Headers |
| 5 | **mysql-exporter**| `prom/mysqld-exporter:v0.15.1`| Nội bộ (9104) | Thu thập metrics hiệu năng CSDL MySQL qua file cấu hình `.my.cnf` |
| 6 | **cadvisor** | `gcr.io/cadvisor/cadvisor:v0.49.1` | `8081:8080` | Giám sát tài nguyên CPU, RAM, Network I/O của toàn bộ Containers |
| 7 | **prometheus** | `prom/prometheus:v2.51.0` | `9090:9090` | Thu thập và lưu trữ time-series metrics |
| 8 | **grafana** | `grafana/grafana:10.4.1` | `3001:3000` | Dashboard trực quan hóa trạng thái Web/DB/Container/Logs |
| 9 | **loki** | `grafana/loki:2.9.6` | `3100:3100` | Lưu trữ và đánh chỉ mục log tập trung |
| 10 | **promtail** | `grafana/promtail:2.9.6` | Nội bộ | Thu thập file log từ Volume chia sẻ của App và Nginx chuyển tới Loki |

---

## 4. YÊU CẦU MÔI TRƯỜNG & HƯỚNG DẪN CÀI ĐẶT

### 4.1. Yêu cầu tiên quyết
- Hệ điều hành: Windows 10/11 (WSL2 hoặc Hyper-V), macOS, hoặc Linux (Ubuntu 20.04/22.04 LTS).
- Docker Engine >= 24.0.0
- Docker Compose v2 >= 2.20.0
- Git

### 4.2. Cấu hình biến môi trường (`.env`)
Sao chép file `.env.example` thành `.env` (hệ thống đã tạo sẵn `.env` chuẩn cho môi trường demo):
```bash
cp .env.example .env
```
Nội dung file `.env`:
```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=CinemaSuperSecretKey2026_DTC245200120_CNTTK23E
COOKIE_SECURE=false

MYSQL_ROOT_PASSWORD=RootSuperSecure2026!
MYSQL_DATABASE=cinema_db
MYSQL_USER=cinema_user
MYSQL_PASSWORD=CinemaSecurePass2026!
MYSQL_EXPORTER_PASSWORD=ExporterSecurePass2026!
DB_HOST=mysql
DB_PORT=3306

GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
```

---

## 5. HƯỚNG DẪN BUILD VÀ KHỞI CHẠY HỆ THỐNG

### 5.1. Khởi chạy toàn bộ hệ thống bằng 1 lệnh duy nhất
```bash
docker compose up -d --build
```

### 5.2. Kiểm tra trạng thái sức khỏe các container
```bash
docker compose ps
```
*Tất cả 9 dịch vụ phải hiển thị trạng thái `running` (hoặc `healthy`).*

### 5.3. Bảng các địa chỉ truy cập (Endpoints)
- **Website Đặt vé Xem phim (qua Nginx Proxy):** [http://localhost](http://localhost) (hoặc HTTPS [https://localhost](https://localhost))
- **Trang Quản trị CSDL (phpMyAdmin):** [http://localhost:8080](http://localhost:8080)
  - *Tài khoản:* `root` / `RootSuperSecure2026!`
- **Bảng điều khiển Giám sát (Grafana):** [http://localhost:3001](http://localhost:3001)
  - *Tài khoản:* `admin` / `admin`
  - *Dashboard nạp sẵn:* `Hệ Thống Đặt Vé Xem Phim - Giám Sát Tổng Hợp (Đề 11)`
- **Prometheus Targets Server:** [http://localhost:9090/targets](http://localhost:9090/targets)
- **Healthcheck Endpoint:** [http://localhost/healthz](http://localhost/healthz)
- **Prometheus Metrics Thô:** [http://localhost/metrics](http://localhost/metrics)

---

## 6. HƯỚNG DẪN KIỂM TRA CHỨC NĂNG & DEMO GIẢNG VIÊN

### 6.1. Tài khoản đăng nhập mẫu
Hệ thống cung cấp sẵn các nút đăng nhập nhanh trên giao diện `/auth/login`:
1. **Quản trị viên:** `admin` / `Admin@123456` (Truy cập `/admin` để quản lý phim, suất chiếu, doanh thu)
2. **Sinh viên:** `truong256` / `Truong@2026!`
3. **Khách hàng:** `customer1` / `User@123456`

### 6.2. Kiểm tra nghiệp vụ chống Đặt trùng ghế (Anti-Double Booking)
1. Mở 2 tab trình duyệt cùng truy cập một suất chiếu (ví dụ: Suất chiếu ID 1 - Dune 2).
2. Tab 1 chọn ghế `C5`, điền thông tin và bấm "Tiếp tục thanh toán". Hệ thống ghi nhận giữ chỗ và chuyển sang trang thanh toán.
3. Tab 2 click chọn lại đúng ghế `C5` và bấm đặt vé.
4. **Kết quả:** Hệ thống lập tức từ chối và trả về HTTP 409 Conflict: *"Rất tiếc! Ghế (C5) vừa có người khác đặt. Vui lòng chọn ghế khác."*
5. Kiểm tra cơ sở dữ liệu: Ràng buộc duy nhất `uq_showtime_seat` trong bảng `booking_seats` đảm bảo không bao giờ có 2 bản ghi cùng `(showtime_id, seat_id)`.

### 6.3. Giả lập thanh toán: Thành công vs Thất bại
- **Thanh toán thành công:** Click nút *"Xác nhận thanh toán thành công"*. Hệ thống cập nhật `payment_status = 'completed'`, tăng biến đếm `cinema_tickets_booked_total` trên Prometheus, và xuất vé điện tử kèm mã QR.
- **Thanh toán thất bại / Khách hủy:** Click nút *"Mô phỏng thanh toán thất bại"*. Hệ thống cập nhật `payment_status = 'failed'`, **ngay lập tức xóa ghế khỏi bảng `booking_seats` để giải phóng ghế** cho khách hàng khác lựa chọn lại.

---

## 7. HƯỚNG DẪN TRUY VẤN LOGQL VỚI LOKI & PROMTAIL

Truy cập Grafana tại [http://localhost:3001](http://localhost:3001) -> Chọn menu **Explore** -> Chọn Datasource **Loki**:

### Truy vấn 1 – Log Nghiệp vụ Ứng dụng:
```logql
{job="app"}
```
*Kết quả:* Xem các log JSON về tạo đơn vé, gọi transaction CSDL, cập nhật thanh toán.

### Truy vấn 2 – Log Nginx Reverse Proxy:
```logql
{job="nginx"}
```
*Kết quả:* Xem toàn bộ lưu lượng request đi qua Proxy cổng 80/443.

### Truy vấn 3 – Lọc các request lỗi HTTP (4xx / 5xx):
```logql
{job="nginx"} |~ " (4[0-9]{2}|5[0-9]{2}) "
```
*Kết quả:* Phát hiện các request 409 Conflict do tranh chấp ghế hoặc 404 khi truy cập sai URL.

---

## 8. BẰNG CHỨNG THỰC HIỆN 6 BIỆN PHÁP HARDENING

1. **Non-Root Container:** Container ứng dụng chạy dưới tài khoản `node` (UID: 1000). Kiểm tra bằng lệnh:
   ```bash
   docker exec -it cinema-app id
   # Output: uid=1000(node) gid=1000(node)
   ```
2. **Network Isolation:** Phân tách 3 mạng nội bộ `frontend_net`, `backend_net`, `monitor_net`. Cổng 3306 của MySQL hoàn toàn không expose ra ngoài Internet.
3. **Mật khẩu mạnh & Secrets:** Mật khẩu DB và bí mật phiên dài > 16 ký tự, nạp qua `.env`, không lưu vào Git.
4. **Nginx Security Headers:** Đã cấu hình và xác thực bằng `curl -I http://localhost`:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: SAMEORIGIN`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Content-Security-Policy: ...`
   - `server_tokens off`
5. **Database Least Privilege:** Web App chỉ dùng tài khoản `cinema_user` (chỉ có quyền SELECT, INSERT, UPDATE, DELETE trên `cinema_db`), không dùng `root`. Exporter chỉ có quyền giám sát `PROCESS, REPLICATION CLIENT, SELECT`.
6. **Container Security Flags:** Cấu hình `security_opt: [no-new-privileges:true]` và cơ chế restart `unless-stopped`.

---

## 9. LỆNH DỪNG VÀ BẢO TOÀN DỮ LIỆU
- **Dừng hệ thống:**
  ```bash
  docker compose down
  ```
  *(Tuyệt đối không dùng cờ `-v` để bảo toàn dữ liệu MySQL và logs trên các Named Volume).*
- **Khởi động lại mà không cần build lại:**
  ```bash
  docker compose start
  ```

---

## 10. CẤU TRÚC THƯ MỤC HỆ THỐNG

Dưới đây là sơ đồ chi tiết cấu trúc tổ chức thư mục và các tệp tin của toàn bộ dự án:

```plaintext
cinema-ticket-booking-system/
├── .github/
│   └── workflows/
│       └── ci.yml                     # Pipeline kiểm thử & lint tự động (CI/CD GitHub Actions)
├── .dockerignore                       # Khai báo loại trừ khi build Docker image
├── .env                                # Biến môi trường hệ thống (DB, Ports, Secrets)
├── .env.example                        # Mẫu cấu hình biến môi trường chuẩn
├── .gitignore                          # Cấu hình bỏ qua tệp tin theo dõi Git
├── .gitleaks.toml                      # Cấu hình quy tắc quét rò rỉ secret / mật khẩu
├── docker-compose.yml                  # Điều phối 10 dịch vụ container toàn hệ thống
├── README.md                           # Tài liệu hướng dẫn cài đặt & vận hành dự án
│
├── app/                                # Mã nguồn ứng dụng Web Đặt vé (Node.js + Express + EJS)
│   ├── config/
│   │   ├── database.js                 # Kết nối CSDL MySQL (Connection Pool & Promises)
│   │   ├── logger.js                   # Cấu hình ghi log ứng dụng (Winston logging)
│   │   ├── metrics.js                  # Cấu hình Prometheus metrics (prom-client)
│   │   └── migration.js                # Tự động đồng bộ cấu trúc bảng khi ứng dụng khởi động
│   ├── controllers/
│   │   ├── adminController.js          # Nghiệp vụ quản trị: phim, rạp, phòng, suất chiếu, vé
│   │   ├── authController.js           # Nghiệp vụ xác thực: đăng nhập, đăng ký, đổi mật khẩu
│   │   ├── bookingController.js        # Nghiệp vụ chọn ghế, giữ chỗ, thanh toán & hủy vé
│   │   ├── movieController.js          # Nghiệp vụ danh sách phim, chi tiết phim & lọc thể loại
│   │   └── ticketController.js         # Nghiệp vụ tra cứu vé & xác thực QR code
│   ├── middlewares/
│   │   ├── auth.js                     # Kiểm tra trạng thái đăng nhập & phân quyền Admin
│   │   └── metricsMiddleware.js        # Đo lường thời gian phản hồi HTTP & đếm số lượng request
│   ├── public/                         # Tài nguyên tĩnh phục vụ giao diện người dùng
│   │   ├── css/                        # Bảng định kiểu CSS giao diện Dark Modern
│   │   │   ├── admin.css               # Giao diện trang quản trị Admin Dashboard
│   │   │   ├── auth.css                # Giao diện Đăng nhập / Đăng ký
│   │   │   ├── seats.css               # Giao diện sơ đồ ghế trực quan theo từng loại phòng
│   │   │   └── style.css               # CSS toàn cục, header, footer & responsive
│   │   ├── images/                     # Ảnh poster, banner rạp phim & asset đồ họa
│   │   └── js/                         # JavaScript tương tác phía Client
│   │       ├── auth.js                 # Validate biểu mẫu, hiển thị lỗi đăng nhập/đăng ký
│   │       └── seats.js                # Xử lý chọn/hủy ghế tương tác, tính tổng tiền vé
│   ├── routes/
│   │   ├── adminRoutes.js              # Định tuyến trang quản trị (/admin/*)
│   │   ├── authRoutes.js               # Định tuyến xác thực người dùng (/auth/*)
│   │   ├── bookingRoutes.js            # Định tuyến luồng đặt vé & thanh toán (/booking/*)
│   │   ├── movieRoutes.js              # Định tuyến danh sách & chi tiết phim (/movies/*)
│   │   └── ticketRoutes.js             # Định tuyến tra cứu & xác thực vé (/tickets/*)
│   ├── scripts/
│   │   └── generate_posters.js         # Script tự động tạo poster phim mẫu
│   ├── services/
│   │   ├── emailService.js             # Dịch vụ gửi email thông báo vé điện tử
│   │   └── qrService.js                # Dịch vụ tạo mã QR vé điện tử
│   ├── views/                          # Giao diện máy chủ dựng sẵn (EJS Templates)
│   │   ├── admin/                      # Giao diện quản trị (Dashboard, Phim, Suất chiếu, Vé, ...)
│   │   │   └── partials/               # Các phần giao diện dùng chung trong trang quản trị
│   │   ├── auth/                       # Các trang đăng nhập, đăng ký, hồ sơ, quên mật khẩu
│   │   ├── booking/                    # Sơ đồ chọn ghế, trang thanh toán, kết quả thành công/thất bại
│   │   ├── movies/                     # Danh sách phim, lọc phim, chi tiết phim
│   │   ├── partials/                   # Thành phần dùng chung (header, navbar, footer)
│   │   ├── showtimes/                  # Danh sách lịch chiếu phim theo rạp & ngày
│   │   ├── ticket/                     # Trang xác thực vé điện tử qua mã QR
│   │   ├── about.ejs                   # Trang giới thiệu hệ thống rạp
│   │   ├── error.ejs                   # Trang thông báo lỗi thân thiện (404, 500, 409)
│   │   └── index.ejs                   # Trang chủ hiển thị phim đang chiếu & sắp chiếu
│   ├── Dockerfile                      # Image build đa tầng Node.js non-root
│   ├── package.json                    # Khai báo thư viện & dependencies Node.js
│   └── server.js                       # Điểm khởi chạy chính của Web Application
│
├── database/                           # Khởi tạo CSDL MySQL
│   ├── migrations/
│   │   └── 01_complete_system.sql     # Script migration bổ sung cấu trúc CSDL hoàn chỉnh
│   ├── 01-exporter-user.sh             # Script cấp quyền giám sát cho MySQL Exporter
│   ├── init.sql                        # Lược đồ bảng, ràng buộc toàn vẹn & khóa duy nhất
│   └── seed.sql                        # Dữ liệu mẫu ban đầu (phim, rạp, phòng, suất chiếu, user)
│
├── docs/                               # Tài liệu học phần & báo cáo đồ án
│   ├── screenshots/                    # Ảnh chụp bằng chứng kiểm thử & giao diện đa thiết bị
│   ├── BAO_CAO_DE_11_NGUYEN_DUY_TRUONG.docx  # Báo cáo đồ án định dạng Microsoft Word
│   ├── BAO_CAO_DE_11_NGUYEN_DUY_TRUONG.pdf   # Báo cáo đồ án xuất bản định dạng PDF
│   ├── final_completion_report.md      # Báo cáo tổng kết tiến độ hoàn thiện
│   ├── generate_report.py              # Mã nguồn sinh tự động tài liệu báo cáo
│   └── INSTALLATION_AND_VERIFICATION.md # Hướng dẫn kiểm tra nghiệm thu chi tiết
│
├── logging/                            # Cấu hình hệ thống thu thập & quản lý nhật ký tập trung
│   ├── loki/
│   │   └── loki-config.yml             # Cấu hình lưu trữ và index của Loki Server
│   ├── promtail/
│   │   └── promtail-config.yml         # Cấu hình thu thập log từ volume của App và Nginx
│   └── LOGQL_QUERIES.md                # Danh mục 3 câu truy vấn LogQL mẫu theo yêu cầu đề tài
│
├── monitoring/                         # Cấu hình hệ thống giám sát hiệu năng
│   ├── grafana/
│   │   ├── dashboards/
│   │   │   └── cinema-monitoring-dashboard.json  # Dashboard Grafana dựng sẵn (10+ panels)
│   │   └── provisioning/
│   │       ├── dashboards/dashboards.yml         # Tự động nạp dashboard khi khởi động
│   │       └── datasources/datasources.yml       # Tự động nạp Prometheus & Loki datasource
│   ├── mysql-exporter/
│   │   ├── .my.cnf                     # Thông tin đăng nhập an toàn cho MySQL Exporter
│   │   └── .my.cnf.example             # Mẫu cấu hình thông tin đăng nhập
│   └── prometheus/
│       └── prometheus.yml              # Cấu hình scrape targets (App, MySQL Exporter, cAdvisor)
│
├── nginx/                              # Cấu hình Nginx Reverse Proxy & SSL
│   ├── conf.d/
│   │   └── default.conf                # Proxy pass port 3000, SSL HTTPS, Security Headers
│   ├── ssl/                            # Chứng chỉ số SSL/TLS tự ký (Self-signed)
│   │   ├── cinema.crt                  # Chứng chỉ SSL public
│   │   ├── cinema.key                  # Khóa bí mật riêng tư (Private key)
│   │   ├── generate-certs.sh           # Script tái sinh chứng chỉ SSL bằng OpenSSL
│   │   └── README.md                   # Hướng dẫn tạo và cài đặt chứng chỉ SSL
│   └── nginx.conf                      # Cấu hình tối ưu Nginx lõi và định dạng log chuẩn
│
└── tests/                              # Bộ kiểm thử tự động & xác thực hệ thống
    ├── capture_admin_redesign.js       # Kiểm thử và chụp ảnh màn hình giao diện quản trị
    ├── capture_chapter2_evidence.js    # Tự động thu thập ảnh minh chứng cho báo cáo
    ├── comprehensive_browser_test.js   # Kiểm thử E2E luồng đặt vé và thanh toán
    ├── comprehensive_test_suite.js     # Bộ test toàn diện chức năng và bảo mật
    ├── final_acceptance_test.js        # Script kiểm thử nghiệm thu 7/7 tiêu chí đề bài
    ├── generate_chapter2_visuals.js    # Sinh hình ảnh minh họa cho báo cáo
    ├── system_comprehensive_validation.js # Xác thực sức khỏe toàn bộ 10 container và route
    ├── take_about_and_footer_screenshots.js # Chụp màn hình trang giới thiệu và chân trang
    ├── take_after_screenshots.js       # Chụp màn hình sau khi tối ưu giao diện
    ├── take_screenshots.js             # Chụp ảnh các điểm dừng chính của hệ thống
    ├── test_auth_functional_flows.js   # Kiểm thử luồng xác thực đăng nhập/đăng ký
    ├── test_auth_redesign.js           # Kiểm thử UI/UX giao diện đăng nhập/đăng ký
    ├── test_results.json               # Kết quả kiểm thử tự động dạng JSON
    ├── test_runner.js                  # Điều phối chạy toàn bộ kịch bản kiểm thử
    └── validate_ui_and_routes.js       # Kiểm tra phản hồi HTTP các đường dẫn của hệ thống
```