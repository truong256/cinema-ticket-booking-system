const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const logger = require('../config/logger');

// Cơ chế chống Brute Force đơn giản & an toàn bằng In-Memory Rate Limiting
const loginAttempts = new Map(); // key -> { count, lockUntil }

function getAttemptKey(req, username) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `${ip}:${username || ''}`;
}

function checkRateLimit(key) {
    const record = loginAttempts.get(key);
    if (!record) return { allowed: true };
    if (record.lockUntil && record.lockUntil > Date.now()) {
        const remainingMinutes = Math.ceil((record.lockUntil - Date.now()) / 60000);
        return { allowed: false, remainingMinutes };
    }
    if (record.lockUntil && record.lockUntil <= Date.now()) {
        loginAttempts.delete(key);
        return { allowed: true };
    }
    return { allowed: true };
}

function recordFailedAttempt(key) {
    const record = loginAttempts.get(key) || { count: 0, lockUntil: null };
    record.count += 1;
    if (record.count >= 5) {
        record.lockUntil = Date.now() + 15 * 60 * 1000; // Khóa 15 phút sau 5 lần sai
        logger.warn(`Rate limit triggered: IP/User ${key} locked for 15 minutes due to 5 failed attempts`);
    }
    loginAttempts.set(key, record);
}

function resetAttempts(key) {
    loginAttempts.delete(key);
}

const authController = {
    renderLogin: (req, res) => {
        if (req.session && req.session.user) {
            return res.redirect('/');
        }
        res.render('auth/login', {
            title: 'Đăng nhập - CINEVIBE',
            error: req.query.error || null,
            success: req.query.success || null,
            extraCss: '/css/auth.css'
        });
    },

    handleLogin: async (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.render('auth/login', {
                title: 'Đăng nhập',
                error: 'Vui lòng điền đầy đủ tên đăng nhập và mật khẩu',
                success: null
            });
        }

        const attemptKey = getAttemptKey(req, username.trim());
        const rateCheck = checkRateLimit(attemptKey);
        if (!rateCheck.allowed) {
            return res.render('auth/login', {
                title: 'Đăng nhập',
                error: `Bạn đã thử đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${rateCheck.remainingMinutes} phút.`,
                success: null
            });
        }

        try {
            const users = await db.query(
                'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1',
                [username.trim(), username.trim()]
            );

            if (users.length === 0) {
                recordFailedAttempt(attemptKey);
                logger.warn(`Failed login attempt for non-existent user: ${username}`);
                return res.render('auth/login', {
                    title: 'Đăng nhập',
                    error: 'Tên đăng nhập hoặc mật khẩu không chính xác',
                    success: null
                });
            }

            const user = users[0];

            // Kiểm tra trạng thái tài khoản
            if (user.status === 'locked') {
                logger.warn(`Locked user attempted login: ${username}`);
                return res.render('auth/login', {
                    title: 'Đăng nhập',
                    error: 'Tài khoản của bạn đã bị khóa bởi Quản trị viên. Vui lòng liên hệ bộ phận hỗ trợ.',
                    success: null
                });
            }

            const isMatch = await bcrypt.compare(password, user.password_hash);

            if (!isMatch) {
                recordFailedAttempt(attemptKey);
                logger.warn(`Invalid password for user: ${username}`);
                return res.render('auth/login', {
                    title: 'Đăng nhập',
                    error: 'Tên đăng nhập hoặc mật khẩu không chính xác',
                    success: null
                });
            }

            // Đăng nhập thành công -> Reset bộ đếm brute force
            resetAttempts(attemptKey);

            // Chống Session Fixation bằng req.session.regenerate
            const sessionReturnTo = req.session.returnTo;
            const guestTokens = req.session.guest_booking_tokens || [];

            req.session.regenerate((err) => {
                if (err) {
                    logger.error(`Session regenerate error: ${err.message}`);
                }

                req.session.user = {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    full_name: user.full_name,
                    phone: user.phone,
                    role: user.role
                };
                req.session.guest_booking_tokens = guestTokens;

                logger.info(`User logged in successfully: ${user.username} (${user.role})`);

                const returnTo = sessionReturnTo || (user.role === 'admin' ? '/admin' : '/');
                res.redirect(returnTo);
            });

        } catch (error) {
            logger.error(`Login error: ${error.message}`);
            res.render('auth/login', {
                title: 'Đăng nhập',
                error: 'Đã xảy ra lỗi trong quá trình xử lý đăng nhập',
                success: null
            });
        }
    },

    renderRegister: (req, res) => {
        if (req.session && req.session.user) {
            return res.redirect('/');
        }
        res.render('auth/register', {
            title: 'Đăng ký thành viên - CINEVIBE',
            error: null,
            formData: {},
            extraCss: '/css/auth.css'
        });
    },

    handleRegister: async (req, res) => {
        const { username, email, password, confirm_password, full_name, phone } = req.body;

        if (!username || !email || !password || !full_name) {
            return res.render('auth/register', {
                title: 'Đăng ký',
                error: 'Vui lòng điền các trường bắt buộc',
                formData: req.body
            });
        }

        if (password.length < 6) {
            return res.render('auth/register', {
                title: 'Đăng ký',
                error: 'Mật khẩu phải chứa ít nhất 6 ký tự',
                formData: req.body
            });
        }

        if (password !== confirm_password) {
            return res.render('auth/register', {
                title: 'Đăng ký',
                error: 'Mật khẩu xác nhận không khớp',
                formData: req.body
            });
        }

        try {
            const existing = await db.query(
                'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
                [username.trim(), email.trim()]
            );

            if (existing.length > 0) {
                return res.render('auth/register', {
                    title: 'Đăng ký',
                    error: 'Tên đăng nhập hoặc email đã được sử dụng',
                    formData: req.body
                });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            await db.query(
                'INSERT INTO users (username, email, password_hash, full_name, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, "active")',
                [username.trim(), email.trim(), hashedPassword, full_name.trim(), phone ? phone.trim() : '', 'customer']
            );

            logger.info(`New user registered: ${username} (${email})`);
            res.redirect('/auth/login?success=' + encodeURIComponent('Đăng ký tài khoản thành công! Vui lòng đăng nhập.'));
        } catch (error) {
            logger.error(`Register error: ${error.message}`);
            res.render('auth/register', {
                title: 'Đăng ký',
                error: 'Không thể đăng ký tài khoản lúc này, vui lòng thử lại',
                formData: req.body
            });
        }
    },

    handleLogout: (req, res) => {
        if (req.session) {
            const username = req.session.user?.username;
            req.session.destroy((err) => {
                if (err) logger.error(`Session destroy error: ${err.message}`);
                logger.info(`User logged out: ${username}`);
                res.redirect('/');
            });
        } else {
            res.redirect('/');
        }
    },

    // Quản lý Trang Cá Nhân (Profile)
    renderProfile: async (req, res) => {
        if (!req.session || !req.session.user) {
            return res.redirect('/auth/login');
        }

        try {
            const users = await db.query('SELECT id, username, email, full_name, phone, role, created_at FROM users WHERE id = ?', [req.session.user.id]);
            if (users.length === 0) {
                return res.redirect('/auth/logout');
            }

            const user = users[0];

            // Thống kê đơn vé của người dùng
            const bookingStats = await db.query(`
                SELECT COUNT(*) as total_bookings,
                       COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END), 0) as completed_bookings,
                       COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN total_amount ELSE 0 END), 0) as total_spent
                FROM bookings WHERE user_id = ?
            `, [user.id]);

            res.render('auth/profile', {
                title: 'Hồ Sơ Cá Nhân - CINEVIBE',
                user,
                stats: bookingStats[0] || { total_bookings: 0, completed_bookings: 0, total_spent: 0 },
                error: req.query.error || null,
                success: req.query.success || null
            });
        } catch (error) {
            logger.error(`Error loading profile: ${error.message}`);
            res.redirect('/');
        }
    },

    handleUpdateProfile: async (req, res) => {
        if (!req.session || !req.session.user) {
            return res.redirect('/auth/login');
        }

        const { full_name, phone } = req.body;
        if (!full_name || !full_name.trim()) {
            return res.redirect('/auth/profile?error=' + encodeURIComponent('Họ và tên không được để trống'));
        }

        try {
            await db.query('UPDATE users SET full_name = ?, phone = ?, updated_at = NOW() WHERE id = ?', [
                full_name.trim(),
                phone ? phone.trim() : '',
                req.session.user.id
            ]);

            req.session.user.full_name = full_name.trim();
            req.session.user.phone = phone ? phone.trim() : '';

            logger.info(`User updated profile: ${req.session.user.username}`);
            res.redirect('/auth/profile?success=' + encodeURIComponent('Cập nhật thông tin thành công!'));
        } catch (error) {
            logger.error(`Update profile error: ${error.message}`);
            res.redirect('/auth/profile?error=' + encodeURIComponent('Không thể cập nhật hồ sơ lúc này'));
        }
    },

    handleChangePassword: async (req, res) => {
        if (!req.session || !req.session.user) {
            return res.redirect('/auth/login');
        }

        const { current_password, new_password, confirm_password } = req.body;

        if (!current_password || !new_password || !confirm_password) {
            return res.redirect('/auth/profile?error=' + encodeURIComponent('Vui lòng điền đầy đủ các trường đổi mật khẩu'));
        }

        if (new_password.length < 6) {
            return res.redirect('/auth/profile?error=' + encodeURIComponent('Mật khẩu mới phải có ít nhất 6 ký tự'));
        }

        if (new_password !== confirm_password) {
            return res.redirect('/auth/profile?error=' + encodeURIComponent('Mật khẩu mới và mật khẩu xác nhận không khớp'));
        }

        try {
            const users = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.session.user.id]);
            if (users.length === 0) return res.redirect('/auth/logout');

            const isMatch = await bcrypt.compare(current_password, users[0].password_hash);
            if (!isMatch) {
                return res.redirect('/auth/profile?error=' + encodeURIComponent('Mật khẩu hiện tại không chính xác'));
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(new_password, salt);

            await db.query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [
                hashedPassword,
                req.session.user.id
            ]);

            logger.info(`User changed password successfully: ${req.session.user.username}`);
            res.redirect('/auth/profile?success=' + encodeURIComponent('Đổi mật khẩu thành công!'));
        } catch (error) {
            logger.error(`Change password error: ${error.message}`);
            res.redirect('/auth/profile?error=' + encodeURIComponent('Lỗi hệ thống khi đổi mật khẩu'));
        }
    },

    // Quên Mật Khẩu & Khôi Phục qua Token
    renderForgotPassword: (req, res) => {
        res.render('auth/forgot-password', {
            title: 'Quên Mật Khẩu - CINEVIBE',
            error: req.query.error || null,
            success: req.query.success || null,
            extraCss: '/css/auth.css'
        });
    },

    handleForgotPassword: async (req, res) => {
        const { email } = req.body;
        if (!email || !email.trim()) {
            return res.render('auth/forgot-password', {
                title: 'Quên Mật Khẩu',
                error: 'Vui lòng nhập địa chỉ email của bạn',
                success: null
            });
        }

        try {
            const users = await db.query('SELECT id, username, email FROM users WHERE email = ? LIMIT 1', [email.trim()]);
            if (users.length > 0) {
                const user = users[0];
                const resetToken = crypto.randomBytes(32).toString('hex');
                const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 giờ

                await db.query(`
                    UPDATE users 
                    SET reset_password_token = ?, reset_password_expires = ?
                    WHERE id = ?
                `, [resetToken, expires, user.id]);

                const resetLink = `${req.protocol}://${req.get('host')}/auth/reset-password/${resetToken}`;
                logger.info(`[Password Reset] Token generated for user ${user.username} (${user.email}): ${resetLink}`);
            }

            // Luôn thông báo thành công chung để chống enumeration user
            res.render('auth/forgot-password', {
                title: 'Quên Mật Khẩu',
                error: null,
                success: 'Nếu email tồn tại trong hệ thống CineVibe, liên kết khôi phục mật khẩu đã được khởi tạo (có hiệu lực trong 60 phút).'
            });
        } catch (error) {
            logger.error(`Forgot password error: ${error.message}`);
            res.render('auth/forgot-password', {
                title: 'Quên Mật Khẩu',
                error: 'Đã xảy ra lỗi, vui lòng thử lại sau',
                success: null
            });
        }
    },

    renderResetPassword: async (req, res) => {
        const token = req.params.token;
        try {
            const users = await db.query(`
                SELECT id FROM users 
                WHERE reset_password_token = ? AND reset_password_expires > NOW()
                LIMIT 1
            `, [token]);

            if (users.length === 0) {
                return res.render('auth/reset-password', {
                    title: 'Đặt Lại Mật Khẩu',
                    token: null,
                    error: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
                    success: null
                });
            }

            res.render('auth/reset-password', {
                title: 'Đặt Lại Mật Khẩu - CINEVIBE',
                token,
                error: null,
                success: null
            });
        } catch (error) {
            res.render('auth/reset-password', {
                title: 'Đặt Lại Mật Khẩu',
                token: null,
                error: 'Lỗi xác thực liên kết khôi phục',
                success: null
            });
        }
    },

    handleResetPassword: async (req, res) => {
        const token = req.params.token;
        const { password, confirm_password } = req.body;

        if (!password || password.length < 6) {
            return res.render('auth/reset-password', {
                title: 'Đặt Lại Mật Khẩu',
                token,
                error: 'Mật khẩu mới phải có ít nhất 6 ký tự',
                success: null
            });
        }

        if (password !== confirm_password) {
            return res.render('auth/reset-password', {
                title: 'Đặt Lại Mật Khẩu',
                token,
                error: 'Mật khẩu xác nhận không khớp',
                success: null
            });
        }

        try {
            const users = await db.query(`
                SELECT id, username FROM users 
                WHERE reset_password_token = ? AND reset_password_expires > NOW()
                LIMIT 1
            `, [token]);

            if (users.length === 0) {
                return res.render('auth/reset-password', {
                    title: 'Đặt Lại Mật Khẩu',
                    token: null,
                    error: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
                    success: null
                });
            }

            const user = users[0];
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            await db.query(`
                UPDATE users 
                SET password_hash = ?, reset_password_token = NULL, reset_password_expires = NULL, updated_at = NOW()
                WHERE id = ?
            `, [hashedPassword, user.id]);

            logger.info(`Password reset successfully for user: ${user.username}`);
            res.redirect('/auth/login?success=' + encodeURIComponent('Mật khẩu của bạn đã được cập nhật thành công! Vui lòng đăng nhập với mật khẩu mới.'));
        } catch (error) {
            logger.error(`Handle reset password error: ${error.message}`);
            res.render('auth/reset-password', {
                title: 'Đặt Lại Mật Khẩu',
                token,
                error: 'Không thể cập nhật mật khẩu lúc này, vui lòng thử lại',
                success: null
            });
        }
    }
};

module.exports = authController;
