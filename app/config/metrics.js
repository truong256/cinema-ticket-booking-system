const client = require('prom-client');

// Khởi tạo Prometheus Register
const register = new client.Registry();

// Bật các metrics mặc định (Node.js runtime, CPU, RAM, Event Loop)
client.collectDefaultMetrics({
    register,
    prefix: 'nodejs_'
});

// 1. Thống kê tổng số HTTP requests
const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests processed by Cinema Booking App',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register]
});

// 2. Thống kê thời gian xử lý HTTP request (Histogram)
const httpRequestDurationSeconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [register]
});

// 3. Thống kê tổng số vé đã bán
const ticketsBookedTotal = new client.Counter({
    name: 'cinema_tickets_booked_total',
    help: 'Total number of movie tickets successfully booked',
    labelNames: ['seat_type'],
    registers: [register]
});

// 4. Thống kê tổng doanh thu (VND)
const revenueTotal = new client.Counter({
    name: 'cinema_revenue_total_vnd',
    help: 'Total revenue generated from ticket sales in VND',
    labelNames: ['payment_method'],
    registers: [register]
});

// 5. Thống kê số lượng ghế đang được đặt đồng thời / Active connections
const activeBookingsGauge = new client.Gauge({
    name: 'cinema_active_bookings',
    help: 'Current active booking sessions in progress',
    registers: [register]
});

// 6. Thông tin ứng dụng (App metadata)
const appInfoGauge = new client.Gauge({
    name: 'cinema_app_info',
    help: 'Application metadata information',
    labelNames: ['version', 'author', 'topic'],
    registers: [register]
});
appInfoGauge.set({ version: '1.0.0', author: 'Nguyen Duy Truong - DTC245200120', topic: 'De 11 - Dat Ve Xem Phim' }, 1);

module.exports = {
    register,
    httpRequestsTotal,
    httpRequestDurationSeconds,
    ticketsBookedTotal,
    revenueTotal,
    activeBookingsGauge,
    appInfoGauge
};
