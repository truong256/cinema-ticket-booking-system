#!/bin/sh
# Script tự động sinh SSL certificate tự ký cho môi trường demo
mkdir -p /etc/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/cinema.key \
    -out /etc/nginx/ssl/cinema.crt \
    -subj "/C=VN/ST=Hanoi/L=Hanoi/O=CineVibe/OU=IT/CN=localhost"
echo "SSL Certificates generated successfully!"
