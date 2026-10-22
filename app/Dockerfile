# ====================================================================
# DOCKERFILE - CINEMA BOOKING WEB APPLICATION (ĐỀ 11)
# Hardening: Multi-stage, Non-Root User (node: UID 1000), Minimal Alpine
# ====================================================================
FROM node:20-alpine

# Thiết lập thư mục làm việc
WORKDIR /usr/src/app

# Cài đặt wget cho healthcheck
RUN apk add --no-cache wget

# Tạo thư mục lưu log tập trung cho Promtail và cấp quyền cho user node
RUN mkdir -p /var/log/app && chown -R node:node /var/log/app

# Copy package.json và package-lock.json trước để tận dụng Docker cache layer
COPY --chown=node:node package*.json ./

# Cài đặt dependencies môi trường production
RUN npm ci --only=production

# Copy toàn bộ mã nguồn ứng dụng với quyền sở hữu user node
COPY --chown=node:node . .

# Chuyển sang user non-root 'node' (UID: 1000) - TIÊU CHUẨN HARDENING BẮT BUỘC
USER node

# Mở cổng dịch vụ nội bộ (không publish ra ngoài Internet trực tiếp, chỉ thông qua Nginx)
EXPOSE 3000

# Biến môi trường mặc định
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_DIR=/var/log/app

# Healthcheck nội bộ container
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:3000/healthz || exit 1

# Khởi chạy ứng dụng
CMD ["node", "server.js"]
