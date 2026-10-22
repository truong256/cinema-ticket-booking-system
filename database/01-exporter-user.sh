#!/bin/bash
# ====================================================================
# KHỞI TẠO TÀI KHOẢN PROMETHEUS MYSQLD-EXPORTER (ĐỀ 11)
# Script này được tự động kích hoạt bởi MySQL entrypoint khi init container.
# Mật khẩu được nạp động từ biến môi trường MYSQL_EXPORTER_PASSWORD (.env).
# Tuyệt đối không lưu trữ mật khẩu tĩnh trong file SQL.
# ====================================================================

set -e

if [ -n "$MYSQL_EXPORTER_PASSWORD" ]; then
    echo "Configuring prometheus exporter user with dynamic credentials from environment..."
    mysql -u root -p"${MYSQL_ROOT_PASSWORD}" <<EOSQL
CREATE USER IF NOT EXISTS 'exporter'@'%' IDENTIFIED BY '${MYSQL_EXPORTER_PASSWORD}';
ALTER USER 'exporter'@'%' IDENTIFIED BY '${MYSQL_EXPORTER_PASSWORD}';
GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'exporter'@'%';
FLUSH PRIVILEGES;
EOSQL
    echo "Prometheus exporter user configured successfully."
fi
