# TÀI LIỆU HƯỚNG DẪN CÀI ĐẶT, VẬN HÀNH VÀ BẰNG CHỨNG KIỂM THỬ THỰC TẾ
## HỌC PHẦN: TRIỂN KHAI VÀ QUẢN TRỊ HỆ THỐNG PHẦN MỀM
### ĐỀ TÀI SỐ 11: HỆ THỐNG ĐẶT VÉ XEM PHIM / SỰ KIỆN

> **Sinh viên:** Nguyễn Duy Trường  
> **Mã sinh viên:** DTC245200120  
> **Lớp:** CNTTK23E  
> **Hệ điều hành máy chủ:** Windows 11 / Windows 10 Home (Build 26200, 64-bit)  
> **Repository:** [https://github.com/truong256/cinema-ticket-booking-system.git](https://github.com/truong256/cinema-ticket-booking-system.git)  
> **Nhánh làm việc:** `fix/windows-devops-environment`

---

## 1. TỔNG HỢP KIỂM TRA MÔI TRƯỜNG WINDOWS 11 (PHASE 1)

### 1.1. Hiện trạng phần mềm trên máy tính:
| Công cụ / Nền tảng | Phiên bản phát hiện | Trạng thái hiện tại | Đánh giá & Ghi chú |
|---|:---:|:---:|---|
| **Hệ điều hành Windows** | Windows 11 Home (Build 26200, 64-bit) | SẴN SÀNG | Hỗ trợ Hyper-V, VBS và WSL2 |
| **Phần cứng Virtualization (BIOS)** | Hypervisor Active | **ĐÃ BẬT** | Windows Hypervisor & VBS đang hoạt động |
| **Dung lượng RAM** | 15.79 GB | **ĐẠT** | Đủ chạy mượt mà 10 containers đồng thời |
| **Dung lượng ổ cứng C:** | 123.01 GB | **ĐẠT** | Dư dả tài nguyên cho Docker images và named volumes |
| **Windows Package Manager (winget)**| v1.29.380 | SẴN SÀNG | Hỗ trợ tự động hóa |
| **Git for Windows** | v2.55.0.windows.4 | SẴN SÀNG | Đã cấu hình xác thực GitHub |
| **Node.js (Host runtime)** | v24.19.0 | SẴN SÀNG | Đạt chuẩn chạy test local và build |
| **npm** | v11.17.0 | SẴN SÀNG | Đã cài đặt đầy đủ node_modules |
| **WSL2 Core** | v2.7.13.0 (Kernel 6.18) | SẴN SÀNG | WSL2 backend hoạt động ổn định |
| **Docker Desktop** | **v4.96.0 (Engine 29.9.1, Compose v5.6.0)** | **HOẠT ĐỘNG (UP)** | **Cài đặt thành công, kết nối pipe Docker Desktop Linux Engine** |

### 1.2. Kiểm tra xung đột cổng mạng (Port Conflicts):
- **Cổng 80 (Nginx HTTP):** KHÔNG BỊ CHIẾM (Trống)
- **Cổng 443 (Nginx HTTPS):** KHÔNG BỊ CHIẾM (Trống)
- **Cổng 8080 (phpMyAdmin):** KHÔNG BỊ CHIẾM (Trống)
- **Cổng 3001 (Grafana):** KHÔNG BỊ CHIẾM (Trống)
- **Cổng 9090 (Prometheus):** KHÔNG BỊ CHIẾM (Trống)
- **Cổng 3100 (Loki):** KHÔNG BỊ CHIẾM (Trống)
- **Cổng 8081 (cAdvisor):** KHÔNG BỊ CHIẾM (Trống)
- **Cổng 3306 (MySQL):** Không expose ra host! Hệ thống đã được hardening: MySQL container chỉ mở cổng 3306 trong mạng nội bộ `backend_net`, hoàn toàn không gây xung đột với MySQL cục bộ của máy host.

---

## 2. QUY TRÌNH CÀI ĐẶT VÀ KHỞI ĐỘNG HỆ THỐNG TRÊN WINDOWS 11

### Bước 1: Khởi động Docker Desktop
Docker Desktop 4.96.0 đã được cài đặt tại `C:\Program Files\Docker\Docker\Docker Desktop.exe`.
Đảm bảo tiến trình `com.docker.service` đang chạy và Docker Desktop đã khởi tạo Docker Engine:
```powershell
docker --version
docker compose version
docker info
```

### Bước 2: Chuẩn bị mã nguồn và biến môi trường
```powershell
cd c:\vibecoding\thikthpmontrienkhai
git checkout fix/windows-devops-environment
```

### Bước 3: Khởi động 10 container đồng thời
```powershell
docker compose up -d --build
```

### Bước 4: Kiểm tra trạng thái hoạt động của các container
```powershell
docker compose ps
```

---

## 3. DANH SÁCH 10 DỊCH VỤ DOCKER ĐÃ TRIỂN KHAI VÀ PHIÊN BẢN

| STT | Dịch vụ | Tên Container | Image & Phiên bản | Mạng kết nối | Cổng truy cập | Trạng thái |
|:---:|---|---|---|---|:---:|:---:|
| 1 | **Web App** | `cinema-app` | `node:20-alpine` (Custom non-root `node`) | `frontend_net`, `backend_net`, `monitor_net` | Nội bộ :3000 | **Up (healthy)** |
| 2 | **Database** | `cinema-mysql` | `mysql:8.0` | `backend_net` | Nội bộ :3306 | **Up (healthy)** |
| 3 | **DB Admin** | `cinema-phpmyadmin` | `phpmyadmin:latest` | `backend_net` | `8080:80` | **Up** |
| 4 | **Reverse Proxy** | `cinema-nginx` | `nginx:1.25-alpine` | `frontend_net`, `monitor_net` | `80:80`, `443:443` | **Up (healthy)** |
| 5 | **DB Exporter** | `cinema-mysql-exporter` | `prom/mysqld-exporter:v0.15.1` | `backend_net`, `monitor_net` | Nội bộ :9104 | **Up** |
| 6 | **Container Mon** | `cinema-cadvisor` | `gcr.io/cadvisor/cadvisor:v0.49.1` | `monitor_net` | `8081:8080` | **Up (healthy)** |
| 7 | **Metrics Server** | `cinema-prometheus` | `prom/prometheus:v2.51.0` | `monitor_net` | `9090:9090` | **Up** |
| 8 | **Dashboard** | `cinema-grafana` | `grafana/grafana:10.4.1` | `monitor_net` | `3001:3000` | **Up** |
| 9 | **Log Storage** | `cinema-loki` | `grafana/loki:2.9.6` | `monitor_net` | `3100:3100` | **Up** |
| 10 | **Log Shipper** | `cinema-promtail` | `grafana/promtail:2.9.6` | `monitor_net` | Nội bộ | **Up** |

---

## 4. BẢNG TỔNG HỢP CÁC LỖI ĐÃ PHÁT HIỆN VÀ KHẮC PHỤC TRIỆT ĐỂ

Trong quá trình triển khai và kiểm thử hệ thống, 8 lỗi kỹ thuật đã được phân tích nguyên nhân gốc rễ và xử lý triệt để:

1. **Khắc phục cài đặt Docker Desktop không tương tác (Session 0 vs User Session):**
   - *Nguyên nhân:* Bộ cài Docker Desktop gọi `ProcessEnvironmentDetector` để xin cấp quyền UAC. Khi chạy trong console nền, lệnh bị chặn ngầm.
   - *Khắc phục:* Chạy bộ cài bằng lệnh `install --quiet --accept-license --backend=wsl-2`, kích hoạt `com.docker.service` và khởi chạy GUI Docker Desktop trong User Session 2.

2. **Khắc phục cú pháp MySQL 8.0 compound interval trong `database/seed.sql`:**
   - *Nguyên nhân:* MySQL không chấp nhận biểu thức `DATE_ADD(NOW(), INTERVAL 4 HOUR + INTERVAL 46 MINUTE)`.
   - *Khắc phục:* Tách thành lồng hàm chuẩn SQL: `DATE_ADD(DATE_ADD(NOW(), INTERVAL 4 HOUR), INTERVAL 46 MINUTE)`. CSDL nạp thành công 3 người dùng, 2 rạp, 3 phòng chiếu, 160 ghế, 6 phim, 7 suất chiếu.

3. **Khắc phục lỗi quyền ghi thư mục của Loki non-root container (`mkdir /tmp/loki/rules: permission denied`):**
   - *Nguyên nhân:* Image `grafana/loki:2.9.6` chạy dưới UID 10001 (`loki`). Khi mount volume vào `/tmp/loki`, Docker cấp quyền root cho mount point khiến Loki bị crash vòng lặp.
   - *Khắc phục:* Cập nhật `logging/loki/loki-config.yml` và `docker-compose.yml` lưu trữ tại thư mục `/loki` (thư mục có sẵn trong image, đã chown cho `loki:loki`). Loki đạt trạng thái `ready`.

4. **Khắc phục lỗi Nginx phân giải IPv6 trên Alpine Linux:**
   - *Nguyên nhân:* `nginx.conf` mặc định chỉ lắng nghe `listen 80;` (IPv4). Khi container khác hoặc curl truy cập qua `localhost` phân giải `::1`, kết nối bị từ chối.
   - *Khắc phục:* Bổ sung `listen [::]:80;` và `listen [::]:443 ssl;` trong `nginx/conf.d/default.conf`.

5. **Khắc phục lỗi Promtail không đọc được log Nginx do symlink `/dev/stdout`:**
   - *Nguyên nhân:* Nginx Alpine symlink sẵn `/var/log/nginx/access.log` tới `/dev/stdout`. Promtail đọc qua volume gặp lỗi `lstat /proc/1/fd/pipe: no such file or directory`.
   - *Khắc phục:* Cập nhật `nginx/nginx.conf` ghi log vào file thực `/var/log/nginx/nginx_access.log` và `/var/log/nginx/nginx_error.log`. Promtail đọc log và gửi lên Loki hoàn hảo.

6. **Bổ sung nghiệp vụ kiểm tra phòng chiếu và bảo mật thanh toán:**
   - *Khắc phục:* 
     * Kiểm tra ghế phải thuộc đúng `room_id` của suất chiếu (chặn đặt ghế phòng khác).
     * Kiểm tra không cho phép đặt ghế không tồn tại.
     * Chặn thanh toán lặp lại cho đơn đã hoàn tất (Idempotency).
     * Chặn thanh toán chéo tài khoản người dùng khác (RBAC & Session verification).

7. **Xử lý xung đột Deadlock song song khi 2 người đặt cùng 1 ghế:**
   - *Nguyên nhân:* Khi 2 giao dịch tranh chấp ghế thực hiện `SELECT ... FOR UPDATE` đồng thời, InnoDB phát hiện deadlock và huỷ giao dịch thứ hai với mã lỗi `ER_LOCK_DEADLOCK` (1213). Mã nguồn ban đầu chỉ bắt `ER_DUP_ENTRY` nên vô tình trả về 500.
   - *Khắc phục:* Bổ sung xử lý `ER_LOCK_DEADLOCK` và `ER_LOCK_WAIT_TIMEOUT` trong `bookingController.js`, trả về chuẩn `HTTP 409 Conflict`.

8. **Đảm bảo mật khẩu lưu trữ trong CSDL băm bằng bcrypt rounds 10:**
   - *Khắc phục:* Bỏ hoàn toàn cơ chế bypass tĩnh, dùng bcrypt salt rounds 10 cho toàn bộ người dùng trong hệ thống.

---

## 5. HƯỚNG DẪN KIỂM CHỨNG BẰNG CHỨNG VÀ TRUY VẤN THỰC TẾ

### 5.1. Chạy Bộ Kiểm Thử Tự Động Toàn Diện (End-to-End Test Suite)
Chạy trực tiếp từ thư mục gốc của dự án:
```powershell
node tests/comprehensive_test_suite.js
```
**Kết quả kiểm thử thực tế: 36/36 TIÊU CHÍ PASS (100%)**
- 19 tiêu chí Chức năng & Nghiệp vụ Website (Phase 5): PASS
- 3 tiêu chí Nginx & phpMyAdmin (Phase 6): PASS
- 4 tiêu chí Prometheus & Grafana (Phase 7): PASS (4/4 targets UP, Metrics thu thập đầy đủ)
- 4 tiêu chí Loki & Promtail (Phase 8): PASS (Ready, Log App, Log Nginx, LogQL 4xx filter)
- 6 tiêu chí Hardening (Phase 9): PASS (Non-root, Network Isolation, Least Privilege, Closed 3306, No-new-privileges, Bcrypt rounds 10)

### 5.2. Kiểm chứng Nginx Reverse Proxy & Security Headers:
Chạy lệnh curl trên PowerShell:
```powershell
curl.exe -I http://localhost
```
**Kết quả thực tế thu được:**
```http
HTTP/1.1 200 OK
Server: nginx
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self' 'unsafe-inline' https:; ...
```

### 5.3. Kiểm chứng 3 truy vấn LogQL trong Grafana Explore:
Truy cập `http://localhost:3001` -> Menu **Explore** -> Chọn Datasource **Loki**:
1. **Truy vấn Log Nghiệp vụ App:** `{job="app"}`
2. **Truy vấn Log Nginx:** `{job="nginx"}`
3. **Truy vấn Log lỗi HTTP:** `{job="nginx"} |~ " (4[0-9]{2}|5[0-9]{2}) "`

### 5.4. Kiểm chứng Hardening Non-Root Container:
```powershell
docker exec cinema-app whoami
# Kết quả xác nhận: node (UID 1000)

docker exec cinema-loki whoami
# Kết quả xác nhận: loki (UID 10001)
```

### 5.5. Kiểm chứng chống Double Booking (Khóa giao dịch CSDL):
Thực hiện đặt cùng một ghế trên 2 tab trình duyệt song song. Tab 2 bị từ chối với thông báo HTTP 409 Conflict và ghế được bảo vệ nguyên vẹn trên MySQL nhờ `SELECT ... FOR UPDATE` và ràng buộc duy nhất `uq_showtime_seat`.
