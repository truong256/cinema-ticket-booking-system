const db = require('../config/database');
const logger = require('../config/logger');

const movieController = {
    getHome: async (req, res) => {
        try {
            const movies = await db.query(
                'SELECT * FROM movies WHERE is_active = TRUE ORDER BY release_date DESC LIMIT 8'
            );

            // Suất chiếu hôm nay
            const todayShowtimes = await db.query(`
                SELECT s.id, s.start_time, s.price_regular, m.title as movie_title, m.poster_url, r.name as room_name, c.name as cinema_name
                FROM showtimes s
                JOIN movies m ON s.movie_id = m.id
                JOIN rooms r ON s.room_id = r.id
                JOIN cinemas c ON r.cinema_id = c.id
                WHERE s.status = 'scheduled' AND s.start_time >= NOW()
                ORDER BY s.start_time ASC
                LIMIT 6
            `);

            res.render('index', {
                title: 'Trang chủ - Đặt vé Xem phim & Sự kiện Đề 11',
                movies,
                todayShowtimes
            });
        } catch (error) {
            logger.error(`Error loading home page: ${error.message}`);
            res.render('index', {
                title: 'Trang chủ - Đặt vé Xem phim',
                movies: [],
                todayShowtimes: [],
                error: 'Không thể tải danh sách phim lúc này'
            });
        }
    },

    getMovies: async (req, res) => {
        try {
            const genre = req.query.genre;
            let sql = 'SELECT * FROM movies WHERE is_active = TRUE';
            const params = [];

            if (genre) {
                sql += ' AND genre LIKE ?';
                params.push(`%${genre}%`);
            }
            sql += ' ORDER BY release_date DESC';

            const movies = await db.query(sql, params);
            res.render('movies/list', {
                title: 'Danh sách Phim Đang Chiếu & Sắp Chiếu',
                movies,
                currentGenre: genre || ''
            });
        } catch (error) {
            logger.error(`Error loading movies list: ${error.message}`);
            res.render('movies/list', {
                title: 'Danh sách Phim',
                movies: [],
                currentGenre: '',
                error: 'Lỗi tải danh sách phim'
            });
        }
    },

    getMovieDetail: async (req, res) => {
        const movieId = req.params.id;
        try {
            const movies = await db.query('SELECT * FROM movies WHERE id = ?', [movieId]);
            if (movies.length === 0) {
                return res.status(404).render('error', {
                    title: 'Không tìm thấy phim',
                    statusCode: 404,
                    message: 'Phim bạn đang tìm kiếm không tồn tại hoặc đã ngừng chiếu'
                });
            }

            const movie = movies[0];

            // Lấy danh sách suất chiếu của phim
            const showtimes = await db.query(`
                SELECT s.id, s.start_time, s.end_time, s.price_regular, s.price_vip, s.price_couple,
                       r.id as room_id, r.name as room_name, r.room_type,
                       c.id as cinema_id, c.name as cinema_name, c.address as cinema_address
                FROM showtimes s
                JOIN rooms r ON s.room_id = r.id
                JOIN cinemas c ON r.cinema_id = c.id
                WHERE s.movie_id = ? AND s.status = 'scheduled' AND s.start_time >= NOW()
                ORDER BY s.start_time ASC
            `, [movieId]);

            // Nhóm suất chiếu theo Ngày
            const groupedShowtimes = {};
            showtimes.forEach(st => {
                const dateKey = new Date(st.start_time).toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
                if (!groupedShowtimes[dateKey]) {
                    groupedShowtimes[dateKey] = [];
                }
                groupedShowtimes[dateKey].push(st);
            });

            res.render('movies/detail', {
                title: `${movie.title} - Chi tiết & Lịch chiếu`,
                movie,
                groupedShowtimes
            });
        } catch (error) {
            logger.error(`Error loading movie detail: ${error.message}`);
            res.status(500).render('error', {
                title: 'Lỗi hệ thống',
                statusCode: 500,
                message: 'Không thể tải thông tin chi tiết phim'
            });
        }
    },

    getShowtimes: async (req, res) => {
        try {
            const showtimes = await db.query(`
                SELECT s.id, s.start_time, s.end_time, s.price_regular, s.price_vip, s.price_couple,
                       m.id as movie_id, m.title as movie_title, m.poster_url, m.duration_minutes, m.age_rating,
                       r.name as room_name, r.room_type,
                       c.name as cinema_name, c.address as cinema_address
                FROM showtimes s
                JOIN movies m ON s.movie_id = m.id
                JOIN rooms r ON s.room_id = r.id
                JOIN cinemas c ON r.cinema_id = c.id
                WHERE s.status = 'scheduled' AND s.start_time >= NOW()
                ORDER BY s.start_time ASC
            `);

            res.render('showtimes/list', {
                title: 'Lịch chiếu phim - Hệ thống rạp toàn quốc',
                showtimes
            });
        } catch (error) {
            logger.error(`Error loading showtimes: ${error.message}`);
            res.render('showtimes/list', {
                title: 'Lịch chiếu',
                showtimes: [],
                error: 'Không thể tải lịch chiếu lúc này'
            });
        }
    }
};

module.exports = movieController;
