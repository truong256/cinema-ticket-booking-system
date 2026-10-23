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
            const pendingCount = await db.query('SELECT COUNT(*) as total FROM bookings WHERE payment_status = "pending"');
            const failedCount = await db.query('SELECT COUNT(*) as total FROM bookings WHERE payment_status = "failed" OR booking_status = "cancelled"');
            const usersCount = await db.query('SELECT COUNT(*) as total FROM users WHERE role = "customer"');

            // Danh sách 5 đơn đặt vé mới nhất
            const recentBookings = await db.query(`
                SELECT b.*, m.title as movie_title, s.start_time
                FROM bookings b
                JOIN showtimes s ON b.showtime_id = s.id
                JOIN movies m ON s.movie_id = m.id
                ORDER BY b.created_at DESC
                LIMIT 5
            `);

            // Top 5 phim có doanh thu cao nhất
            const topMovies = await db.query(`
                SELECT m.id, m.title, m.poster_url, m.genre,
                       COUNT(DISTINCT b.id) as booking_count,
                       COUNT(bs.id) as tickets_count,
                       COALESCE(SUM(b.total_amount), 0) as total_revenue
                FROM movies m
                LEFT JOIN showtimes s ON m.id = s.movie_id
                LEFT JOIN bookings b ON s.id = b.showtime_id AND b.payment_status = 'completed'
                LEFT JOIN booking_seats bs ON b.id = bs.booking_id
                GROUP BY m.id, m.title, m.poster_url, m.genre
                ORDER BY total_revenue DESC
                LIMIT 5
            `);

            // Thống kê doanh thu 7 ngày gần nhất
            const dailyRevenue = await db.query(`
                SELECT DATE(created_at) as date_label, COALESCE(SUM(total_amount), 0) as daily_total
                FROM bookings
                WHERE payment_status = 'completed' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY DATE(created_at)
                ORDER BY date_label ASC
            `);

            res.render('admin/dashboard', {
                title: 'Bảng Quản Trị - Hệ Thống Đặt Vé CINEVIBE',
                stats: {
                    totalMovies: moviesCount[0]?.total || 0,
                    totalShowtimes: showtimesCount[0]?.total || 0,
                    totalTicketsSold: ticketsSold[0]?.total || 0,
                    totalRevenue: parseFloat(revenue[0]?.total || 0),
                    totalPending: pendingCount[0]?.total || 0,
                    totalFailed: failedCount[0]?.total || 0,
                    totalUsers: usersCount[0]?.total || 0
                },
                recentBookings,
                topMovies,
                dailyRevenue
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

    // 2. Quản lý danh sách phim (CRUD & Toggle & Soft Protection)
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
        if (!title || !duration_minutes) {
            return res.redirect('/admin/movies?error=' + encodeURIComponent('Vui lòng nhập tên phim và thời lượng'));
        }

        try {
            await db.query(`
                INSERT INTO movies (title, description, duration_minutes, release_date, poster_url, trailer_url, genre, age_rating, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)
            `, [
                title.trim(), 
                description ? description.trim() : '', 
                parseInt(duration_minutes, 10), 
                release_date || null, 
                poster_url ? poster_url.trim() : '/images/dune2.jpg', 
                trailer_url ? trailer_url.trim() : '', 
                genre ? genre.trim() : 'Hành Động', 
                age_rating || 'P'
            ]);

            logger.info(`Admin created new movie: ${title}`);
            res.redirect('/admin/movies?success=' + encodeURIComponent('Thêm phim mới thành công!'));
        } catch (error) {
            logger.error(`Error creating movie: ${error.message}`);
            res.redirect('/admin/movies?error=' + encodeURIComponent('Không thể thêm phim: ' + error.message));
        }
    },

    updateMovie: async (req, res) => {
        const movieId = req.params.id;
        const { title, description, duration_minutes, release_date, poster_url, trailer_url, genre, age_rating } = req.body;
        if (!title || !duration_minutes) {
            return res.redirect('/admin/movies?error=' + encodeURIComponent('Tiêu đề và thời lượng không được để trống'));
        }
        try {
            await db.query(`
                UPDATE movies SET title=?, description=?, duration_minutes=?, release_date=?,
                poster_url=?, trailer_url=?, genre=?, age_rating=?, updated_at=NOW()
                WHERE id=?
            `, [
                title.trim(),
                description ? description.trim() : '',
                parseInt(duration_minutes, 10),
                release_date || null,
                poster_url ? poster_url.trim() : '',
                trailer_url ? trailer_url.trim() : '',
                genre ? genre.trim() : 'Hành Động',
                age_rating || 'P',
                movieId
            ]);
            logger.info(`Admin updated movie ID: ${movieId}`);
            res.redirect('/admin/movies?success=' + encodeURIComponent('Cập nhật thông tin phim thành công!'));
        } catch (error) {
            logger.error(`Error updating movie: ${error.message}`);
            res.redirect('/admin/movies?error=' + encodeURIComponent('Lỗi cập nhật: ' + error.message));
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
            // Kiểm tra ràng buộc: Nếu phim đã có suất chiếu hoặc đơn đặt vé, không được xóa cứng
            const showtimesCount = await db.query('SELECT COUNT(*) as count FROM showtimes WHERE movie_id = ?', [movieId]);
            if (showtimesCount[0]?.count > 0) {
                // Soft protect: Tự động ẩn phim thay vì xóa làm hỏng dữ liệu liên kết
                await db.query('UPDATE movies SET is_active = FALSE WHERE id = ?', [movieId]);
                return res.redirect('/admin/movies?success=' + encodeURIComponent('Phim đã có lịch sử suất chiếu nên hệ thống đã tự động chuyển sang chế độ Ẩn (Soft Deactivate) để bảo toàn dữ liệu.'));
            }

            await db.query('DELETE FROM movies WHERE id = ?', [movieId]);
            logger.info(`Admin deleted movie ID: ${movieId}`);
            res.redirect('/admin/movies?success=' + encodeURIComponent('Xóa phim thành công!'));
        } catch (error) {
            logger.error(`Error deleting movie: ${error.message}`);
            res.redirect('/admin/movies?error=' + encodeURIComponent('Không thể xóa phim: ' + error.message));
        }
    },

    // 3. Quản lý Suất chiếu (với Thuật toán Chống Trùng Lịch Chiếu trong Phòng + 15 phút Buffer)
    getShowtimes: async (req, res) => {
        try {
            const showtimes = await db.query(`
                SELECT s.*, m.title as movie_title, m.duration_minutes, r.name as room_name, c.name as cinema_name
                FROM showtimes s
                JOIN movies m ON s.movie_id = m.id
                JOIN rooms r ON s.room_id = r.id
                JOIN cinemas c ON r.cinema_id = c.id
                ORDER BY s.start_time DESC
            `);

            const movies = await db.query('SELECT id, title, duration_minutes FROM movies WHERE is_active = TRUE ORDER BY title ASC');
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

        if (!movie_id || !room_id || !start_time) {
            return res.redirect('/admin/showtimes?error=' + encodeURIComponent('Vui lòng điền đầy đủ: Phim, Phòng chiếu và Thời gian bắt đầu'));
        }

        try {
            const startDate = new Date(start_time);
            if (isNaN(startDate.getTime())) {
                return res.redirect('/admin/showtimes?error=' + encodeURIComponent('Thời gian bắt đầu không hợp lệ'));
            }

            // Lấy thời lượng phim nếu không chỉ định
            let duration = parseInt(duration_minutes, 10);
            if (!duration || isNaN(duration)) {
                const movie = await db.query('SELECT duration_minutes FROM movies WHERE id = ?', [movie_id]);
                duration = movie.length > 0 ? movie[0].duration_minutes : 120;
            }

            const endDate = new Date(startDate.getTime() + duration * 60000);

            // KIỂM TRA CHỐNG TRÙNG LỊCH CHIẾU TRONG CÙNG PHÒNG (Bao gồm 15 phút đệm dọn dẹp phòng chiếu)
            // Buffer: 15 phút trước và sau
            const conflicts = await db.query(`
                SELECT s.id, m.title, s.start_time, s.end_time
                FROM showtimes s
                JOIN movies m ON s.movie_id = m.id
                WHERE s.room_id = ? 
                  AND s.status != 'cancelled'
                  AND s.start_time < DATE_ADD(?, INTERVAL 15 MINUTE)
                  AND DATE_ADD(s.end_time, INTERVAL 15 MINUTE) > ?
                LIMIT 1
            `, [room_id, endDate, startDate]);

            if (conflicts.length > 0) {
                const c = conflicts[0];
                const conflictStart = new Date(c.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                const conflictEnd = new Date(c.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                return res.redirect('/admin/showtimes?error=' + encodeURIComponent(
                    `Xung đột lịch chiếu: Phòng chiếu này đã có suất chiếu phim "${c.title}" (${conflictStart} - ${conflictEnd}). Hệ thống yêu cầu cách nhau tối thiểu 15 phút dọn phòng!`
                ));
            }

            await db.query(`
                INSERT INTO showtimes (movie_id, room_id, start_time, end_time, price_regular, price_vip, price_couple, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')
            `, [
                movie_id, 
                room_id, 
                startDate, 
                endDate, 
                parseFloat(price_regular) || 85000, 
                parseFloat(price_vip) || 110000, 
                parseFloat(price_couple) || 180000
            ]);

            logger.info(`Admin created showtime for movie ${movie_id} in room ${room_id} (${startDate.toISOString()} - ${endDate.toISOString()})`);
            res.redirect('/admin/showtimes?success=' + encodeURIComponent('Tạo suất chiếu mới thành công! Đã kiểm tra không xung đột phòng chiếu.'));
        } catch (error) {
            logger.error(`Error creating showtime: ${error.message}`);
            res.redirect('/admin/showtimes?error=' + encodeURIComponent('Lỗi tạo suất chiếu: ' + error.message));
        }
    },

    updateShowtime: async (req, res) => {
        const showtimeId = req.params.id;
        const { start_time, price_regular, price_vip, price_couple } = req.body;

        if (!start_time) {
            return res.redirect('/admin/showtimes?error=' + encodeURIComponent('Vui lòng nhập thời gian bắt đầu'));
        }

        try {
            // Chỉ cho phép sửa khi chưa bán vé nào
            const soldSeats = await db.query(`
                SELECT COUNT(*) as cnt FROM booking_seats bs
                JOIN bookings b ON bs.booking_id = b.id
                WHERE bs.showtime_id = ? AND b.payment_status = 'completed'
            `, [showtimeId]);

            if (soldSeats[0].cnt > 0) {
                return res.redirect('/admin/showtimes?error=' + encodeURIComponent('Không thể sửa suất chiếu đã có vé được bán'));
            }

            // Lấy thời lượng phim để tính end_time
            const showtimes = await db.query('SELECT movie_id, room_id FROM showtimes WHERE id = ?', [showtimeId]);
            if (showtimes.length === 0) {
                return res.redirect('/admin/showtimes?error=' + encodeURIComponent('Suất chiếu không tồn tại'));
            }

            const st = showtimes[0];
            const movie = await db.query('SELECT duration_minutes FROM movies WHERE id = ?', [st.movie_id]);
            const duration = movie[0]?.duration_minutes || 120;
            const startDate = new Date(start_time);
            const endDate = new Date(startDate.getTime() + duration * 60000);

            // Kiểm tra xung đột phòng (trừ chính suất chiếu này)
            const conflicts = await db.query(`
                SELECT id FROM showtimes
                WHERE room_id = ? AND id != ? AND status != 'cancelled'
                  AND start_time < DATE_ADD(?, INTERVAL 15 MINUTE)
                  AND DATE_ADD(end_time, INTERVAL 15 MINUTE) > ?
                LIMIT 1
            `, [st.room_id, showtimeId, endDate, startDate]);

            if (conflicts.length > 0) {
                return res.redirect('/admin/showtimes?error=' + encodeURIComponent('Xung đột lịch chiếu: Phòng này đã có suất chiếu khác trong khoảng thời gian này'));
            }

            await db.query(`
                UPDATE showtimes SET start_time=?, end_time=?, price_regular=?, price_vip=?, price_couple=?, updated_at=NOW()
                WHERE id=?
            `, [
                startDate, endDate,
                parseFloat(price_regular) || 85000,
                parseFloat(price_vip) || 110000,
                parseFloat(price_couple) || 180000,
                showtimeId
            ]);

            logger.info(`Admin updated showtime ID: ${showtimeId}`);
            res.redirect('/admin/showtimes?success=' + encodeURIComponent('Cập nhật suất chiếu thành công!'));
        } catch (error) {
            logger.error(`Error updating showtime: ${error.message}`);
            res.redirect('/admin/showtimes?error=' + encodeURIComponent('Lỗi cập nhật: ' + error.message));
        }
    },

    cancelShowtime: async (req, res) => {
        const showtimeId = req.params.id;
        try {
            await db.query('UPDATE showtimes SET status = "cancelled" WHERE id = ?', [showtimeId]);
            logger.info(`Admin cancelled showtime ID: ${showtimeId}`);
            res.redirect('/admin/showtimes?success=' + encodeURIComponent('Đã hủy suất chiếu thành công!'));
        } catch (error) {
            logger.error(`Error cancelling showtime: ${error.message}`);
            res.redirect('/admin/showtimes?error=' + encodeURIComponent('Lỗi khi hủy suất chiếu: ' + error.message));
        }
    },

    // 4. Quản lý Rạp Chiếu (Cinemas)
    getCinemas: async (req, res) => {
        try {
            const cinemas = await db.query(`
                SELECT c.*, COUNT(r.id) as room_count
                FROM cinemas c
                LEFT JOIN rooms r ON c.id = r.cinema_id
                GROUP BY c.id
                ORDER BY c.id ASC
            `);

            res.render('admin/cinemas', {
                title: 'Quản lý Cụm Rạp Chiếu',
                cinemas,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (error) {
            logger.error(`Error loading cinemas: ${error.message}`);
            res.redirect('/admin');
        }
    },

    createCinema: async (req, res) => {
        const { name, address, city, phone } = req.body;
        if (!name || !address) {
            return res.redirect('/admin/cinemas?error=' + encodeURIComponent('Tên rạp và địa chỉ không được để trống'));
        }

        try {
            await db.query(`
                INSERT INTO cinemas (name, address, city, phone, is_active)
                VALUES (?, ?, ?, ?, 1)
            `, [name.trim(), address.trim(), city ? city.trim() : 'Hà Nội', phone ? phone.trim() : '']);

            logger.info(`Admin created cinema: ${name}`);
            res.redirect('/admin/cinemas?success=' + encodeURIComponent('Thêm cụm rạp mới thành công!'));
        } catch (error) {
            logger.error(`Error creating cinema: ${error.message}`);
            res.redirect('/admin/cinemas?error=' + encodeURIComponent('Lỗi: ' + error.message));
        }
    },

    updateCinema: async (req, res) => {
        const cinemaId = req.params.id;
        const { name, address, city, phone } = req.body;
        if (!name || !address) {
            return res.redirect('/admin/cinemas?error=' + encodeURIComponent('Tên rạp và địa chỉ không được để trống'));
        }
        try {
            await db.query('UPDATE cinemas SET name=?, address=?, city=?, phone=?, updated_at=NOW() WHERE id=?',
                [name.trim(), address.trim(), city ? city.trim() : '', phone ? phone.trim() : '', cinemaId]);
            logger.info(`Admin updated cinema ID: ${cinemaId}`);
            res.redirect('/admin/cinemas?success=' + encodeURIComponent('Cập nhật rạp thành công!'));
        } catch (error) {
            logger.error(`Error updating cinema: ${error.message}`);
            res.redirect('/admin/cinemas?error=' + encodeURIComponent('Lỗi: ' + error.message));
        }
    },

    toggleCinemaStatus: async (req, res) => {
        const cinemaId = req.params.id;
        try {
            await db.query('UPDATE cinemas SET is_active = NOT is_active WHERE id = ?', [cinemaId]);
            res.redirect('/admin/cinemas?success=' + encodeURIComponent('Cập nhật trạng thái hoạt động của rạp thành công!'));
        } catch (error) {
            res.redirect('/admin/cinemas?error=' + encodeURIComponent('Lỗi cập nhật rạp'));
        }
    },

    // 5. Quản lý Phòng Chiếu & Sơ đồ Ghế (Rooms & Seats)
    getRooms: async (req, res) => {
        try {
            const rooms = await db.query(`
                SELECT r.*, c.name as cinema_name,
                       (SELECT COUNT(*) FROM seats s WHERE s.room_id = r.id) as actual_seats,
                       (SELECT COUNT(*) FROM seats s WHERE s.room_id = r.id AND s.is_active = 0) as locked_seats
                FROM rooms r
                JOIN cinemas c ON r.cinema_id = c.id
                ORDER BY c.name, r.name
            `);

            const cinemas = await db.query('SELECT id, name FROM cinemas WHERE is_active = 1 ORDER BY name ASC');

            res.render('admin/rooms', {
                title: 'Quản lý Phòng Chiếu & Ghế',
                rooms,
                cinemas,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (error) {
            logger.error(`Error loading rooms: ${error.message}`);
            res.redirect('/admin');
        }
    },

    updateRoom: async (req, res) => {
        const roomId = req.params.id;
        const { name, room_type } = req.body;
        if (!name) {
            return res.redirect('/admin/rooms?error=' + encodeURIComponent('Tên phòng không được để trống'));
        }
        try {
            await db.query('UPDATE rooms SET name=?, room_type=?, updated_at=NOW() WHERE id=?',
                [name.trim(), room_type || 'Standard', roomId]);
            logger.info(`Admin updated room ID: ${roomId}`);
            res.redirect('/admin/rooms?success=' + encodeURIComponent('Cập nhật phòng chiếu thành công!'));
        } catch (error) {
            logger.error(`Error updating room: ${error.message}`);
            res.redirect('/admin/rooms?error=' + encodeURIComponent('Lỗi: ' + error.message));
        }
    },

    createRoom: async (req, res) => {
        const { cinema_id, name, room_type } = req.body;
        if (!cinema_id || !name) {
            return res.redirect('/admin/rooms?error=' + encodeURIComponent('Vui lòng chọn rạp và đặt tên phòng'));
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.query(`
                INSERT INTO rooms (cinema_id, name, room_type, total_seats, is_active)
                VALUES (?, ?, ?, 60, 1)
            `, [cinema_id, name.trim(), room_type || 'Standard']);

            const newRoomId = result.insertId;

            // Tự động tạo ma trận 60 ghế (Hàng A, B: Regular; C, D, E: VIP; F: Couple)
            const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
            for (const r of rows) {
                let type = 'Regular';
                if (r === 'C' || r === 'D' || r === 'E') type = 'VIP';
                if (r === 'F') type = 'Couple';

                for (let num = 1; num <= 10; num++) {
                    await connection.query(`
                        INSERT INTO seats (room_id, row_label, seat_number, seat_type, is_active)
                        VALUES (?, ?, ?, ?, 1)
                    `, [newRoomId, r, num, type]);
                }
            }

            await connection.commit();
            logger.info(`Admin created room ID ${newRoomId} with 60 auto-generated seats`);
            res.redirect('/admin/rooms?success=' + encodeURIComponent('Thêm phòng chiếu mới thành công kèm sơ đồ 60 ghế tự động!'));
        } catch (error) {
            await connection.rollback();
            logger.error(`Error creating room: ${error.message}`);
            res.redirect('/admin/rooms?error=' + encodeURIComponent('Lỗi tạo phòng: ' + error.message));
        } finally {
            connection.release();
        }
    },

    getRoomSeats: async (req, res) => {
        const roomId = req.params.id;
        try {
            const rooms = await db.query(`
                SELECT r.*, c.name as cinema_name
                FROM rooms r
                JOIN cinemas c ON r.cinema_id = c.id
                WHERE r.id = ?
            `, [roomId]);

            if (rooms.length === 0) {
                return res.redirect('/admin/rooms');
            }

            const room = rooms[0];
            const seats = await db.query('SELECT * FROM seats WHERE room_id = ? ORDER BY row_label ASC, seat_number ASC', [roomId]);

            // Gom nhóm ghế theo hàng
            const seatRows = {};
            seats.forEach(s => {
                if (!seatRows[s.row_label]) seatRows[s.row_label] = [];
                seatRows[s.row_label].push(s);
            });

            res.render('admin/room_seats', {
                title: `Sơ đồ ghế - ${room.name} (${room.cinema_name})`,
                room,
                seatRows,
                totalSeats: seats.length,
                lockedCount: seats.filter(s => !s.is_active).length,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (error) {
            logger.error(`Error loading room seats: ${error.message}`);
            res.redirect('/admin/rooms');
        }
    },

    toggleSeatStatus: async (req, res) => {
        const seatId = req.params.id;
        try {
            // Lấy thông tin ghế
            const seats = await db.query('SELECT * FROM seats WHERE id = ?', [seatId]);
            if (seats.length === 0) {
                return res.redirect('/admin/rooms');
            }
            const seat = seats[0];

            // Nếu đang muốn KHÓA ghế: kiểm tra xem ghế có đơn vé nào trong các suất chiếu tương lai chưa
            if (seat.is_active) {
                const activeBookings = await db.query(`
                    SELECT bs.id
                    FROM booking_seats bs
                    JOIN bookings b ON bs.booking_id = b.id
                    JOIN showtimes s ON bs.showtime_id = s.id
                    WHERE bs.seat_id = ? 
                      AND s.start_time > NOW()
                      AND b.payment_status = 'completed'
                `, [seatId]);

                if (activeBookings.length > 0) {
                    return res.redirect(`/admin/rooms/${seat.room_id}/seats?error=` + encodeURIComponent(
                        `Không thể khóa ghế ${seat.row_label}${seat.seat_number} vì đang có khách đặt vé trong suất chiếu tương lai!`
                    ));
                }
            }

            await db.query('UPDATE seats SET is_active = NOT is_active WHERE id = ?', [seatId]);
            logger.info(`Admin toggled lock on seat ${seat.row_label}${seat.seat_number} in room ${seat.room_id}`);

            res.redirect(`/admin/rooms/${seat.room_id}/seats?success=` + encodeURIComponent(
                `Cập nhật trạng thái ghế ${seat.row_label}${seat.seat_number} thành công!`
            ));
        } catch (error) {
            logger.error(`Error toggling seat: ${error.message}`);
            res.redirect('/admin/rooms');
        }
    },

    // 6. Quản lý Danh sách Đặt vé (Tìm kiếm, Lọc, Chi tiết, Hủy đơn/Hoàn tiền mô phỏng)
    getBookings: async (req, res) => {
        const search = req.query.search ? req.query.search.trim() : '';
        const status = req.query.status || 'all';

        try {
            let query = `
                SELECT b.*, m.title as movie_title, s.start_time, r.name as room_name, c.name as cinema_name,
                       (SELECT COUNT(*) FROM booking_seats bs WHERE bs.booking_id = b.id) as seat_count,
                       (SELECT GROUP_CONCAT(CONCAT(s2.row_label, s2.seat_number) SEPARATOR ', ')
                        FROM booking_seats bs2
                        JOIN seats s2 ON bs2.seat_id = s2.id
                        WHERE bs2.booking_id = b.id) as seat_names
                FROM bookings b
                JOIN showtimes s ON b.showtime_id = s.id
                JOIN movies m ON s.movie_id = m.id
                JOIN rooms r ON s.room_id = r.id
                JOIN cinemas c ON r.cinema_id = c.id
                WHERE 1=1
            `;
            const params = [];

            if (search) {
                query += ` AND (b.booking_code LIKE ? OR b.customer_name LIKE ? OR b.customer_email LIKE ? OR b.customer_phone LIKE ?)`;
                const searchParam = `%${search}%`;
                params.push(searchParam, searchParam, searchParam, searchParam);
            }

            if (status === 'completed') {
                query += ' AND b.payment_status = "completed"';
            } else if (status === 'pending') {
                query += ' AND b.payment_status = "pending"';
            } else if (status === 'cancelled' || status === 'failed') {
                query += ' AND (b.booking_status = "cancelled" OR b.payment_status = "failed" OR b.payment_status = "refunded")';
            }

            query += ' ORDER BY b.created_at DESC LIMIT 100';

            const bookings = await db.query(query, params);

            res.render('admin/bookings', {
                title: 'Quản lý Đơn Đặt Vé',
                bookings,
                search,
                status,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (error) {
            logger.error(`Error loading admin bookings: ${error.message}`);
            res.redirect('/admin');
        }
    },

    cancelBooking: async (req, res) => {
        const bookingId = req.params.id;
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            const [bookings] = await connection.query('SELECT * FROM bookings WHERE id = ? FOR UPDATE', [bookingId]);
            if (bookings.length === 0) {
                await connection.rollback();
                return res.redirect('/admin/bookings?error=' + encodeURIComponent('Đơn vé không tồn tại'));
            }

            const booking = bookings[0];

            // Cập nhật trạng thái đơn thành cancelled / refunded
            await connection.query(`
                UPDATE bookings 
                SET booking_status = 'cancelled', payment_status = 'refunded', updated_at = NOW() 
                WHERE id = ?
            `, [bookingId]);

            // Giải phóng ghế trong booking_seats
            await connection.query('DELETE FROM booking_seats WHERE booking_id = ?', [bookingId]);

            await connection.commit();
            logger.info(`Admin cancelled/refunded booking: ${booking.booking_code} (ID: ${bookingId}), seats released`);

            res.redirect('/admin/bookings?success=' + encodeURIComponent(`Đã hủy đơn ${booking.booking_code} và hoàn tiền mô phỏng thành công! Ghế đã được giải phóng.`));
        } catch (error) {
            await connection.rollback();
            logger.error(`Error cancelling booking: ${error.message}`);
            res.redirect('/admin/bookings?error=' + encodeURIComponent('Lỗi hủy đơn: ' + error.message));
        } finally {
            connection.release();
        }
    },

    // 7. Quản lý Tài khoản Khách hàng (Users Management & Lock/Unlock)
    getUsers: async (req, res) => {
        const search = req.query.search ? req.query.search.trim() : '';
        try {
            let query = `
                SELECT u.id, u.username, u.email, u.full_name, u.phone, u.role, u.status, u.created_at,
                       (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) as booking_count,
                       (SELECT COALESCE(SUM(b.total_amount), 0) FROM bookings b WHERE b.user_id = u.id AND b.payment_status = 'completed') as total_spent
                FROM users u
                WHERE 1=1
            `;
            const params = [];

            if (search) {
                query += ' AND (u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ? OR u.phone LIKE ?)';
                const searchParam = `%${search}%`;
                params.push(searchParam, searchParam, searchParam, searchParam);
            }

            query += ' ORDER BY u.id DESC';

            const users = await db.query(query, params);

            res.render('admin/users', {
                title: 'Quản lý Người Dùng & Khách Hàng',
                users,
                search,
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (error) {
            logger.error(`Error loading admin users: ${error.message}`);
            res.redirect('/admin');
        }
    },

    toggleUserLock: async (req, res) => {
        const userId = req.params.id;
        try {
            const users = await db.query('SELECT role, status, username FROM users WHERE id = ?', [userId]);
            if (users.length === 0) {
                return res.redirect('/admin/users');
            }

            const user = users[0];
            if (user.role === 'admin') {
                return res.redirect('/admin/users?error=' + encodeURIComponent('Không thể khóa tài khoản có quyền Quản trị viên!'));
            }

            const newStatus = user.status === 'locked' ? 'active' : 'locked';
            await db.query('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [newStatus, userId]);

            logger.info(`Admin updated user lock status: ${user.username} -> ${newStatus}`);
            res.redirect('/admin/users?success=' + encodeURIComponent(`Đã ${newStatus === 'locked' ? 'khóa' : 'mở khóa'} tài khoản ${user.username} thành công!`));
        } catch (error) {
            logger.error(`Error toggling user lock: ${error.message}`);
            res.redirect('/admin/users?error=' + encodeURIComponent('Lỗi cập nhật tài khoản'));
        }
    }
};

module.exports = adminController;
