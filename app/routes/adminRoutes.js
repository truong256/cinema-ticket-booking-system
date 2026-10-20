const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middlewares/auth');

// Bảo vệ toàn bộ admin routes bằng middleware requireAdmin
router.use(requireAdmin);

// Dashboard
router.get('/', adminController.getDashboard);

// Phim
router.get('/movies', adminController.getMovies);
router.post('/movies/create', adminController.createMovie);
router.post('/movies/:id/toggle', adminController.toggleMovieStatus);
router.post('/movies/:id/delete', adminController.deleteMovie);

// Suất chiếu
router.get('/showtimes', adminController.getShowtimes);
router.post('/showtimes/create', adminController.createShowtime);

// Đặt vé
router.get('/bookings', adminController.getBookings);

module.exports = router;
