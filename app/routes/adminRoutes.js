const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middlewares/auth');

// Bảo vệ toàn bộ admin routes bằng middleware requireAdmin
router.use(requireAdmin);

// 1. Dashboard
router.get('/', adminController.getDashboard);

// 2. Quản lý Phim
router.get('/movies', adminController.getMovies);
router.post('/movies/create', adminController.createMovie);
router.post('/movies/:id/toggle', adminController.toggleMovieStatus);
router.post('/movies/:id/delete', adminController.deleteMovie);

// 3. Quản lý Suất chiếu
router.get('/showtimes', adminController.getShowtimes);
router.post('/showtimes/create', adminController.createShowtime);
router.post('/showtimes/:id/cancel', adminController.cancelShowtime);

// 4. Quản lý Cụm Rạp
router.get('/cinemas', adminController.getCinemas);
router.post('/cinemas/create', adminController.createCinema);
router.post('/cinemas/:id/toggle', adminController.toggleCinemaStatus);

// 5. Quản lý Phòng chiếu & Sơ đồ Ghế
router.get('/rooms', adminController.getRooms);
router.post('/rooms/create', adminController.createRoom);
router.get('/rooms/:id/seats', adminController.getRoomSeats);
router.post('/seats/:id/toggle', adminController.toggleSeatStatus);

// 6. Quản lý Đơn đặt vé
router.get('/bookings', adminController.getBookings);
router.post('/bookings/:id/cancel', adminController.cancelBooking);

// 7. Quản lý Khách hàng & Người dùng
router.get('/users', adminController.getUsers);
router.post('/users/:id/toggle-lock', adminController.toggleUserLock);

module.exports = router;
