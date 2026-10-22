const db = require('../config/database');
const logger = require('../config/logger');

const adminController = {
    // 1. Dashboard tổng quan
    getDashboard: async (req, res) => {
        try {
            const moviesCount = await db.query('SELECT COUNT(*) as total FROM movies WHERE is_active = TRUE');
            const showtimesCount = await db.query('SELECT COUNT(*) as total FROM showtimes WHERE status = "scheduled"');
            const ticketsSold = await db.query('SELECT COUNT(*) as total FROM booking_seats bs JOIN bookings b ON bs.booking_id = b.id WHERE b.payment_status = "completed"');
            const revenue = await db.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM bookings WHERE payment_status = "completed"');
            
            // Danh sách 5 đơn đặt vé mới nhất
            const recentBookings = await db.query(`
                SELECT b.*, m.title as movie_title, s.start_time
                FROM bookings b
                JOIN showtimes s ON b.showtime_id = s.id
                JOIN movies m ON s.movie_id = m.id
                ORDER BY b.created_at DESC
                LIMIT 5
            `);

            res.render('admin/dashboard', {
                title: 'Bảng Quản Trị - Hệ Thống Đặt Vé',
                stats: {
                    totalMovies: moviesCount[0]?.total || 0,
                    totalShowtimes: showtimesCount[0]?.total || 0,
                    totalTicketsSold: ticketsSold[0]?.total || 0,
                    totalRevenue: parseFloat(revenue[0]?.total || 0)
                },
                recentBookings
            });
        } catch (error) {
            logger.error(`Error loading admin dashboard: ${error.message}`);
            res.status(500).render('error', {
                title: 'Lỗi',
                statusCode: 500,
                message: 'Không thể tải trang quản trị'
            });
        }
    },

    // 2. Quản lý danh sách phim
    getMovies: async (req, res) => {
        try {
            const movies = await db.query('SELECT * FROM movies ORDER BY id DESC');
            res.render('admin/movies', {
                title: 'Quản lý Phim & Sự kiện',
                movies,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (error) {
            logger.error(`Error loading admin movies: ${error.message}`);
            res.redirect('/admin');
        }
    },

    createMovie: async (req, res) => {
        const { title, description, duration_minutes, release_date, poster_url, trailer_url, genre, age_rating } = req.body;
        try {
            await db.query(`
                INSERT INTO movies (title, description, duration_minutes, release_date, poster_url, trailer_url, genre, age_rating, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)
            `, [title.trim(), description.trim(), parseInt(duration_minutes, 10), release_date, poster_url, trailer_url, genre, age_rating]);

            logger.info(`Admin created new movie: ${title}`);
            res.redirect('/admin/movies?success=' + encodeURIComponent('Thêm phim mới thành công!'));
        } catch (error) {
            logger.error(`Error creating movie: ${error.message}`);
            res.redirect('/admin/movies?error=' + encodeURIComponent('Không thể thêm phim: ' + error.message));
        }
    },

    toggleMovieStatus: async (req, res) => {
        const movieId = req.params.id;
        try {
            await db.query('UPDATE movies SET is_active = NOT is_active WHERE id = ?', [movieId]);
            logger.info(`Admin toggled status for movie ID: ${movieId}`);
            res.redirect('/admin/movies?success=' + encodeURIComponent('Cập nhật trạng thái hiển thị phim thành công!'));
        } catch (error) {
            logger.error(`Error toggling movie: ${error.message}`);
            res.redirect('/admin/movies?error=' + encodeURIComponent('Lỗi cập nhật phim'));
        }
    },

    deleteMovie: async (req, res) => {
        const movieId = req.params.id;
        try {
            // Kiểm tra ràng buộc: Nếu phim đã có suất chiếu, không được phép xóa làm mất dữ liệu lịch sử
            const showtimesCount = await db.query('SELECT COUNT(*) as count FROM showtimes WHERE movie_id = ?', [movieId]);
            if (showtimesCount[0]?.count > 0) {
                return res.redirect('/admin/movies?error=' + encodeURIComponent('Không thể xóa phim này vì đã có suất chiếu hoặc lịch sử đặt vé liên kết! Hãy chọn tắt trạng thái hiển thị.'));
            }

            await db.query('DELETE FROM movies WHERE id = ?', [movieId]);
            logger.info(`Admin deleted movie ID: ${movieId}`);
            res.redirect('/admin/movies?success=' + encodeURIComponent('Xóa phim thành công!'));
        } catch (error) {
            logger.error(`Error deleting movie: ${error.message}`);
            res.redirect('/admin/movies?error=' + encodeURIComponent('Không thể xóa phim: ' + error.message));
        }
    },

    // 3. Quản lý Suất chiếu
    getShowtimes: async (req, res) => {
        try {
            const showtimes = await db.query(`
                SELECT s.*, m.title as movie_title, r.name as room_name, c.name as cinema_name
                FROM showtimes s
                JOIN movies m ON s.movie_id = m.id
                JOIN rooms r ON s.room_id = r.id
                JOIN cinemas c ON r.cinema_id = c.id
                ORDER BY s.start_time DESC
            `);

            const movies = await db.query('SELECT id, title FROM movies WHERE is_active = TRUE ORDER BY title ASC');
            const rooms = await db.query(`
                SELECT r.id, r.name, r.room_type, c.name as cinema_name
                FROM rooms r
                JOIN cinemas c ON r.cinema_id = c.id
                ORDER BY c.name, r.name
            `);

            res.render('admin/showtimes', {
                title: 'Quản lý Suất Chiếu',
                showtimes,
                movies,
                rooms,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (error) {
            logger.error(`Error loading showtimes: ${error.message}`);
            res.redirect('/admin');
        }
    },

    createShowtime: async (req, res) => {
        const { movie_id, room_id, start_time, duration_minutes, price_regular, price_vip, price_couple } = req.body;
        try {
            const startDate = new Date(start_time);
            const duration = parseInt(duration_minutes || 120, 10);
            const endDate = new Date(startDate.getTime() + duration * 60000);

            await db.query(`
                INSERT INTO showtimes (movie_id, room_id, start_time, end_time, price_regular, price_vip, price_couple, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')
            `, [movie_id, room_id, startDate, endDate, price_regular || 85000, price_vip || 110000, price_couple || 180000]);

            logger.info(`Admin created showtime for movie ${movie_id} in room ${room_id}`);
            res.redirect('/admin/showtimes?success=' + encodeURIComponent('Tạo suất chiếu mới thành công!'));
        } catch (error) {
            logger.error(`Error creating showtime: ${error.message}`);
            res.redirect('/admin/showtimes?error=' + encodeURIComponent('Lỗi tạo suất chiếu: ' + error.message));
        }
    },

    // 4. Quản lý Danh sách Đặt vé
    getBookings: async (req, res) => {
        try {
            const bookings = await db.query(`
                SELECT b.*, m.title as movie_title, s.start_time, r.name as room_name,
                       (SELECT COUNT(*) FROM booking_seats bs WHERE bs.booking_id = b.id) as seat_count
                FROM bookings b
                JOIN showtimes s ON b.showtime_id = s.id
                JOIN movies m ON s.movie_id = m.id
                JOIN rooms r ON s.room_id = r.id
                ORDER BY b.created_at DESC
                LIMIT 50
            `);

            res.render('admin/bookings', {
                title: 'Quản lý Đơn Đặt Vé',
                bookings
            });
        } catch (error) {
            logger.error(`Error loading admin bookings: ${error.message}`);
            res.redirect('/admin');
        }
    }
};

module.exports = adminController;
