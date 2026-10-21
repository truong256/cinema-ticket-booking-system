# Hướng dẫn Cấu hình Chứng chỉ SSL / TLS (CineVibe)

Để tuân thủ các tiêu chuẩn bảo mật, các file chứng chỉ (`.crt`) và khóa riêng (`.key`) **tuyệt đối không được lưu vào Git repository** và đã được khai báo trong `.gitignore`.

---

## 1. Môi trường phát triển cục bộ (Local Development)

Để chạy môi trường Nginx HTTPS tự ký cục bộ:

### Trên Linux / macOS / Git Bash:
```bash
cd nginx/ssl
sh generate-certs.sh
```

### Trên Windows PowerShell (nếu có OpenSSL):
```powershell
openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
    -keyout nginx/ssl/cinema.key `
    -out nginx/ssl/cinema.crt `
    -subj "/C=VN/ST=Hanoi/L=Hanoi/O=CineVibe/OU=IT/CN=localhost"
```

Script sẽ tạo 2 file cục bộ:
- `cinema.key`: Private key (RSA 2048-bit)
- `cinema.crt`: Public self-signed certificate

Hai file này sẽ được mount tự động vào Nginx container qua Docker Compose:
```yaml
volumes:
  - ./nginx/ssl:/etc/nginx/ssl:ro
```

---

## 2. Môi trường Production

Trong môi trường triển khai thực tế (Production có domain công khai):
1. **Sử dụng Let's Encrypt / Certbot** hoặc chứng chỉ CA thương mại.
2. Nạp chứng chỉ và private key qua Docker Secrets, HashiCorp Vault, hoặc file mount trên host an toàn với quyền hạn `chmod 600`.
3. Tuyệt đối không commit private key của domain Production lên bất kỳ nhánh Git nào.
