const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { requireAdmin } = require('../middlewares/auth');

// Trang xác minh vé công khai (quét mã QR từ điện thoại bất kỳ)
router.get('/verify', ticketController.verifyTicket);

// Endpoint Check-in vé tại rạp (yêu cầu quyền Admin / Quản trị viên)
router.post('/checkin', requireAdmin, ticketController.checkinTicket);

module.exports = router;
