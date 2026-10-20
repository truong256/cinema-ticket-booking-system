const { httpRequestsTotal, httpRequestDurationSeconds } = require('../config/metrics');

function metricsMiddleware(req, res, next) {
    // Không tính các asset tĩnh để metric chuẩn xác vào các endpoints ứng dụng
    if (req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/images/') || req.path.startsWith('/favicon.ico')) {
        return next();
    }

    const start = process.hrtime();

    res.on('finish', () => {
        const diff = process.hrtime(start);
        const durationInSeconds = diff[0] + diff[1] / 1e9;
        
        // Chuẩn hóa route path (thay ID thành :id để tránh high cardinality metrics)
        let route = req.baseUrl + (req.route ? req.route.path : req.path);
        route = route.replace(/\/\d+/g, '/:id');

        const labels = {
            method: req.method,
            route: route || req.path,
            status_code: res.statusCode.toString()
        };

        httpRequestsTotal.inc(labels);
        httpRequestDurationSeconds.observe(labels, durationInSeconds);
    });

    next();
}

module.exports = metricsMiddleware;
