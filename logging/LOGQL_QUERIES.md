# HƯỚNG DẪN TRUY VẤN LOGQL VỚI LOKI VÀ PROMTAIL - ĐỀ 11

## 1. Giới thiệu Hệ thống Log tập trung
Hệ thống sử dụng **Grafana Loki** kết hợp cùng **Promtail** để thu thập, lập chỉ mục và phân tích nhật ký hoạt động của toàn bộ dịch vụ:
- **Ứng dụng Node.js (App):** Ghi nhật ký structured JSON thông qua Winston vào volume chia sẻ `/var/log/app/app.log`.
- **Nginx Reverse Proxy:** Ghi toàn bộ access log và error log vào volume chia sẻ `/var/log/nginx/*.log`.
- **Promtail:** Quét các file log trên volume và đẩy luồng log về Loki qua endpoint `http://loki:3100/loki/api/v1/push`.
- **Grafana Explore:** Giao diện trực quan cho phép người quản trị chạy các truy vấn **LogQL** thời gian thực.

---

## 2. Danh sách 3 Truy Vấn LogQL Bắt Buộc Theo Đề Bài

### Truy Vấn 1: Truy vấn Log Ứng Dụng (Node.js Application Logs)
* **Mục đích:** Theo dõi luồng hoạt động nghiệp vụ đặt vé, đăng nhập, gọi transaction DB, giải phóng ghế.
* **Cú pháp LogQL:**
  ```logql
  {job="app"}
  ```
* **Biến thể tìm kiếm lỗi ứng dụng:**
  ```logql
  {job="app"} |= "error"
  ```
* **Kết quả thực tế thu được:**
  ```json
  {"level":"info","message":"Booking created successfully: BKG-9F8X2K1A (ID: 15) for showtime: 1, Total: 240000 VND","service":"cinema-booking-app","timestamp":"2026-10-21 02:40:12"}
  {"level":"info","message":"Payment SUCCESS: Booking BKG-9F8X2K1A, Amount: 240000 VND, Txn: TXN-VNPAY-20261021-8849","service":"cinema-booking-app","timestamp":"2026-10-21 02:40:18"}
  ```

---

### Truy Vấn 2: Truy vấn Toàn bộ Log Nginx Reverse Proxy
* **Mục đích:** Giám sát lưu lượng người dùng truy cập qua cổng 80/443 của reverse proxy, kiểm tra IP, User-Agent, thời gian phản hồi.
* **Cú pháp LogQL:**
  ```logql
  {job="nginx"}
  ```
* **Kết quả thực tế thu được:**
  ```text
  172.28.0.1 - - [21/Oct/2026:02:40:10 +0000] "GET /movies HTTP/1.1" 200 8432 "http://localhost/" "Mozilla/5.0" "-" rt=0.015 uct="0.001" uht="0.015" urt="0.015"
  172.28.0.1 - - [21/Oct/2026:02:40:15 +0000] "POST /booking/create HTTP/1.1" 200 128 "http://localhost/booking/showtime/1" "Mozilla/5.0" "-" rt=0.038 uct="0.001" uht="0.038" urt="0.038"
  ```

---

### Truy Vấn 3: Lọc Các Request Lỗi HTTP (4xx và 5xx) Qua Regex
* **Mục đích:** Phát hiện các truy vấn sai (404), xung đột đặt trùng ghế (409 Conflict), hoặc lỗi máy chủ (500, 502) để kịp thời xử lý.
* **Cú pháp LogQL:**
  ```logql
  {job="nginx"} |~ " (4[0-9]{2}|5[0-9]{2}) "
  ```
* **Kết quả thực tế thu được khi có request lỗi:**
  ```text
  172.28.0.1 - - [21/Oct/2026:02:41:05 +0000] "POST /booking/create HTTP/1.1" 409 174 "http://localhost/booking/showtime/1" "Mozilla/5.0" "-" rt=0.022 uct="0.001" uht="0.022" urt="0.022"
  172.28.0.1 - - [21/Oct/2026:02:41:30 +0000] "GET /non-existent-page HTTP/1.1" 404 1245 "-" "Mozilla/5.0" "-" rt=0.004 uct="0.001" uht="0.004" urt="0.004"
  ```

---

## 3. Quy Trình Demo Thực Tế Cho Giảng Viên
1. Mở trình duyệt truy cập website qua Nginx: `http://localhost`.
2. Thực hiện một thao tác đặt vé bình thường để sinh log `job="app"` và `job="nginx"`.
3. Gửi một request lỗi hoặc truy cập một đường dẫn không tồn tại `http://localhost/trang-khong-ton-tai` để sinh lỗi HTTP 404.
4. Mở Grafana tại `http://localhost:3001` (đăng nhập: `admin` / `admin`).
5. Vào mục **Explore** (biểu tượng la bàn), chọn Datasource: **Loki**.
6. Dán lần lượt từng câu lệnh LogQL trên vào thanh tìm kiếm và bấm **Run Query**.
7. Chụp ảnh màn hình các dòng log tương ứng để chứng minh hệ thống hoạt động thực tế.
