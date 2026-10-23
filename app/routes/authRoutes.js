const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middlewares/auth');

// Đăng nhập / Đăng ký / Đăng xuất
router.get('/login', authController.renderLogin);
router.post('/login', authController.handleLogin);
router.get('/register', authController.renderRegister);
router.post('/register', authController.handleRegister);
router.get('/logout', authController.handleLogout);

// Hồ sơ cá nhân & Đổi mật khẩu
router.get('/profile', requireAuth, authController.renderProfile);
router.post('/profile', requireAuth, authController.handleUpdateProfile);
router.post('/change-password', requireAuth, authController.handleChangePassword);

// Quên mật khẩu & Khôi phục mật khẩu qua token
router.get('/forgot-password', authController.renderForgotPassword);
router.post('/forgot-password', authController.handleForgotPassword);
router.get('/reset-password/:token', authController.renderResetPassword);
router.post('/reset-password/:token', authController.handleResetPassword);

module.exports = router;
