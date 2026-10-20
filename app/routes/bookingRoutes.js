const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { requireAuth } = require('../middlewares/auth');

// Chọn ghế theo Suất chiếu
router.get('/showtime/:showtimeId', bookingController.getSeatSelection);
router.get('/api/showtime/:showtimeId/seats', bookingController.getSeatsStatusApi);

// Đặt vé (Backend transaction chống double-booking)
router.post('/create', bookingController.createBooking);

// Thanh toán giả lập (Checkout & Xử lý)
router.get('/payment/:bookingId', bookingController.getPaymentPage);
router.post('/payment/:bookingId/process', bookingController.processPayment);

// Kết quả thanh toán
router.get('/success/:bookingId', bookingController.getBookingSuccess);
router.get('/failure/:bookingId', bookingController.getBookingFailure);

// Lịch sử đặt vé người dùng
router.get('/history', requireAuth, bookingController.getUserHistory);

module.exports = router;
