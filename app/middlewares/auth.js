function injectUser(req, res, next) {
    res.locals.currentUser = req.session ? req.session.user : null;
    res.locals.currentPath = req.path;
    next();
}

function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để tiếp tục' });
    }
    req.session.returnTo = req.originalUrl;
    res.redirect('/auth/login?error=' + encodeURIComponent('Vui lòng đăng nhập trước khi thực hiện thao tác này'));
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập trang quản trị' });
    }
    res.status(403).render('error', {
        title: 'Truy cập bị từ chối',
        statusCode: 403,
        message: 'Bạn không có quyền quản trị viên để xem trang này'
    });
}

module.exports = {
    injectUser,
    requireAuth,
    requireAdmin
};
