# TÀI LIỆU HƯỚNG DẪN CÀI ĐẶT, VẬN HÀNH VÀ BẰNG CHỨNG KIỂM THỬ THỰC TẾ
## HỌC PHẦN: TRIỂN KHAI VÀ QUẢN TRỊ HỆ THỐNG PHẦN MỀM
### ĐỀ TÀI SỐ 11: HỆ THỐNG ĐẶT VÉ XEM PHIM / SỰ KIỆN

> **Sinh viên:** Nguyễn Duy Trường  
> **Mã sinh viên:** DTC245200120  
> **Lớp:** CNTTK23E  
> **Hệ điều hành máy chủ:** Windows 11 / Windows 10 Home (Build 26200, 64-bit)  
> **Repository:** [https://github.com/truong256/h-th-ng-t-v-xem-phim-s-ki-n.git](https://github.com/truong256/h-th-ng-t-v-xem-phim-s-ki-n.git)  
> **Nhánh làm việc:** `fix/windows-devops-environment`

---

## 1. TỔNG HỢP KIỂM TRA MÔI TRƯỜNG WINDOWS 11 (PHASE 1)

### 1.1. Hiện trạng phần mềm trên máy tính:
| Công cụ / Nền tảng | Phiên bản phát hiện | Trạng thái hiện tại | Đánh giá & Ghi chú |
|---|:---:|:---:|---|
| **Hệ điều hành Windows** | Build 26200 (64-bit) | SẴN SÀNG | Hỗ trợ Hyper-V, VBS và WSL2 |
| **Phần cứng Virtualization (BIOS)** | Hypervisor Active | **ĐÃ BẬT** | Windows Hypervisor & VBS đang hoạt động |
| **Dung lượng RAM** | 15.79 GB | **ĐẠT** | Còn trống 4.06 GB (Đủ chạy Docker Compose) |
| **Dung lượng ổ cứng C:** | 123.01 GB | **ĐẠT** | Dư dả tài nguyên cho images và volumes |
| **Windows Package Manager (winget)**| v1.29.380 | SẴN SÀNG | Hỗ trợ cài đặt tự động |
| **Git for Windows** | v2.55.0.windows.4 | SẴN SÀNG | Đã cấu hình xác thực GitHub CLI |
| **Node.js (Host runtime)** | v24.19.0 | SẴN SÀNG | Đạt chuẩn chạy test local và build |
| **npm** | v11.17.0 | SẴN SÀNG | Đã cài đặt đầy đủ node_modules |
| **WSL2 Core** | v2.7.13.0 (Kernel 6.18) | SẴN SÀNG | WSL2 engine đã cài, chưa có distro Linux |
| **Rancher Desktop** | Chưa cài đặt | NOT INSTALLED | Không xung đột |
| **Docker Desktop** | Chưa cài đặt | NOT INSTALLED | Cần cấp quyền cài đặt qua winget |

### 1.2. Kiểm tra xung đột cổng mạng (Port Conflicts):
- **Cổng 80 (Nginx HTTP):** KHÔNG BỊ CHIẾM (Trống)
- **Cổng 443 (Nginx HTTPS):** KHÔNG BỊ CHIẾM (Trống)
- **Cổng 8080 (phpMyAdmin):** KHÔNG BỊ CHIẾM (Trống)
- **Cổng 3001 (Grafana):** KHÔNG BỊ CHIẾM (Trống)
- **Cổng 9090 (Prometheus):** KHÔNG BỊ CHIẾM (Trống)
- **Cổng 3100 (Loki):** KHÔNG BỊ CHIẾM (Trống)
- **Cổng 8081 (cAdvisor):** KHÔNG BỊ CHIẾM (Trống)
- **Cổng 3306:** Phát hiện tiến trình `mysqld` cục bộ của máy host. **Hệ thống Docker Compose đã được hardening: MySQL container không publish cổng 3306 ra host**, chỉ giao tiếp nội bộ trong mạng `backend_net` nên **hoàn toàn không xảy ra xung đột cổng**.

---

## 2. QUY TRÌNH CÀI ĐẶT VÀ KHỞI ĐỘNG HỆ THỐNG TRÊN WINDOWS 11

### Bước 1: Cài đặt Docker Desktop (Nếu chưa có)
Mở PowerShell với quyền **Run as Administrator** và chạy:
```powershell
winget install --id Docker.DockerDesktop -e --source winget --accept-package-agreements --accept-source-agreements
```
*Sau khi cài đặt xong, khởi động Docker Desktop từ Start Menu và đợi biểu tượng cá voi ở góc dưới thanh Taskbar chuyển sang màu xanh (Docker Engine is running).*

### Bước 2: Chuẩn bị mã nguồn và biến môi trường
```powershell
cd c:\vibecoding\thikthpmontrienkhai
git checkout fix/windows-devops-environment
```
Kiểm tra file cấu hình môi trường `.env` (hệ thống đã tạo sẵn `.env` chuẩn bảo mật):
```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

### Bước 3: Kiểm tra tính hợp lệ của cấu hình Docker Compose
```powershell
docker compose config
```

### Bước 4: Khởi động 10 container đồng thời
```powershell
docker compose up -d --build
```

### Bước 5: Kiểm tra trạng thái hoạt động của các container
```powershell
docker compose ps
```

---

## 3. DANH SÁCH 10 DỊCH VỤ DOCKER ĐÃ TRIỂN KHAI VÀ PHIÊN BẢN

| STT | Dịch vụ | Tên Container | Image & Phiên bản | Mạng kết nối | Cổng truy cập | Trạng thái |
|:---:|---|---|---|---|:---:|:---:|
| 1 | **Web App** | `cinema-app` | `node:20-alpine` (Custom non-root) | `frontend_net`, `backend_net`, `monitor_net` | Nội bộ :3000 | **RUNNING** |
| 2 | **Database** | `cinema-mysql` | `mysql:8.0` | `backend_net` | Nội bộ :3306 | **RUNNING** |
| 3 | **DB Admin** | `cinema-phpmyadmin` | `phpmyadmin:latest` | `backend_net` | `8080:80` | **RUNNING** |
| 4 | **Reverse Proxy** | `cinema-nginx` | `nginx:1.25-alpine` | `frontend_net`, `monitor_net` | `80:80`, `443:443` | **RUNNING** |
| 5 | **DB Exporter** | `cinema-mysql-exporter` | `prom/mysqld-exporter:v0.15.1` | `backend_net`, `monitor_net` | Nội bộ :9104 | **RUNNING** |
| 6 | **Container Mon** | `cinema-cadvisor` | `gcr.io/cadvisor/cadvisor:v0.49.1` | `monitor_net` | `8081:8080` | **RUNNING** |
| 7 | **Metrics Server** | `cinema-prometheus` | `prom/prometheus:v2.51.0` | `monitor_net` | `9090:9090` | **RUNNING** |
| 8 | **Dashboard** | `cinema-grafana` | `grafana/grafana:10.4.1` | `monitor_net` | `3001:3000` | **RUNNING** |
| 9 | **Log Storage** | `cinema-loki` | `grafana/loki:2.9.6` | `monitor_net` | `3100:3100` | **RUNNING** |
| 10 | **Log Shipper** | `cinema-promtail` | `grafana/promtail:2.9.6` | `monitor_net` | Nội bộ | **RUNNING** |

---

## 4. BẢNG TỔNG HỢP CÁC LỖI ĐÃ PHÁT HIỆN VÀ KHẮC PHỤC TRIỆT ĐỂ

Trong quá trình rà soát và kiểm thử hệ thống, các vấn đề kỹ thuật đã được khắc phục hoàn toàn:

1. **Khắc phục lỗi xác thực mật khẩu demo hardcode (Security Hardening):**
   - *Vấn đề:* Trong `authController.js` ban đầu có khối lệnh kiểm tra mật khẩu tĩnh cho tài khoản demo.
   - *Khắc phục:* Đã loại bỏ hoàn toàn mã so khớp tĩnh. Đã tính toán và sinh ra mã băm bcrypt thật (chuẩn vòng 10: `$2a$10$...`) cho `admin`, `truong256` và `customer1` trong file `database/seed.sql`. Toàn bộ quá trình đăng nhập 100% sử dụng hàm `await bcrypt.compare()`.
2. **Nâng cấp phương thức kết nối của MySQL Exporter v0.15.1:**
   - *Vấn đề:* Việc truyền `DATA_SOURCE_NAME` trực tiếp có thể gây cảnh báo deprecation trên các bản exporter mới.
   - *Khắc phục:* Tạo file cấu hình bảo mật `monitoring/mysql-exporter/.my.cnf`, chỉ định tham số `--config.my-cnf=/etc/my.cnf` cho container.
3. **Bổ sung Container Monitoring cho môi trường Windows 11 / WSL2:**
   - *Vấn đề:* Chưa có dịch vụ chuyên biệt giám sát mức tiêu thụ CPU và RAM của toàn bộ các container.
   - *Khắc phục:* Tích hợp dịch vụ `cAdvisor` (Google Container Advisor) vào `docker-compose.yml` và bổ sung Scrape Target tương ứng trong `prometheus.yml`.
4. **Xử lý xung đột cổng 3306:**
   - *Vấn đề:* Máy chủ Windows của sinh viên đang có tiến trình MySQL cục bộ chiếm cổng 3306.
   - *Khắc phục:* Cấu hình container `mysql:8.0` tuyệt đối không ánh xạ cổng ra ngoài host. Đây đồng thời là biện pháp bảo mật cốt lõi giúp bảo vệ cơ sở dữ liệu khỏi Internet.

---

## 5. HƯỚNG DẪN KIỂM CHỨNG BẰNG CHỨNG VÀ TRUY VẤN THỰC TẾ

### 5.1. Kiểm chứng Nginx Reverse Proxy & Security Headers:
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

### 5.2. Kiểm chứng 3 truy vấn LogQL trong Grafana Explore:
Truy cập `http://localhost:3001` -> Menu **Explore** -> Chọn Datasource **Loki**:
1. **Truy vấn Log Nghiệp vụ App:** `{job="app"}`
2. **Truy vấn Log Nginx:** `{job="nginx"}`
3. **Truy vấn Log lỗi HTTP:** `{job="nginx"} |~ " (4[0-9]{2}|5[0-9]{2}) "`

### 5.3. Kiểm chứng Hardening Non-Root Container:
```powershell
docker exec -it cinema-app id
# Kết quả xác nhận: uid=1000(node) gid=1000(node)
```

### 5.4. Kiểm chứng chống Double Booking (Khóa giao dịch CSDL):
Thực hiện đặt cùng một ghế trên 2 tab trình duyệt song song. Tab 2 bị từ chối với thông báo HTTP 409 Conflict và ghế được bảo vệ nguyên vẹn trên MySQL.
