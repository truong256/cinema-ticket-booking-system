const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const logger = require('../config/logger');

let transporter = null;

// Khởi tạo SMTP Transporter nếu có biến môi trường
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    try {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        logger.info(`Email service initialized with SMTP host: ${process.env.SMTP_HOST}`);
    } catch (err) {
        logger.warn(`Failed to initialize SMTP transporter: ${err.message}. Fallback to sandbox mode.`);
        transporter = null;
    }
} else {
    logger.info('Email service running in Demo / Sandbox mode (no SMTP credentials configured)');
}

const emailService = {
    /**
     * Gửi vé điện tử sau khi thanh toán thành công
     * @param {number} bookingId 
     * @param {string} baseUrl
     */
    sendBookingConfirmation: async (bookingId, baseUrl = 'http://localhost') => {
        try {
            // Lấy thông tin chi tiết vé
            const bookings = await db.query(`
                SELECT b.*, s.start_time, s.end_time,
                       m.title as movie_title, m.poster_url, m.duration_minutes,
                       r.name as room_name,
                       c.name as cinema_name, c.address as cinema_address,
                       p.payment_method, p.transaction_id
                FROM bookings b
                JOIN showtimes s ON b.showtime_id = s.id
                JOIN movies m ON s.movie_id = m.id
                JOIN rooms r ON s.room_id = r.id
                JOIN cinemas c ON r.cinema_id = c.id
                LEFT JOIN payments p ON b.id = p.booking_id AND p.status = 'success'
                WHERE b.id = ?
            `, [bookingId]);

            if (bookings.length === 0) {
                logger.warn(`Cannot send email: Booking ${bookingId} not found`);
                return false;
            }

            const booking = bookings[0];

            // Lấy danh sách ghế
            const seats = await db.query(`
                SELECT s.row_label, s.seat_number, s.seat_type, bs.price
                FROM booking_seats bs
                JOIN seats s ON bs.seat_id = s.id
                WHERE bs.booking_id = ?
            `, [bookingId]);

            const seatListStr = seats.map(s => `${s.row_label}${s.seat_number} (${s.seat_type})`).join(', ');
            const formattedTime = new Date(booking.start_time).toLocaleString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh',
                hour: '2-digit', minute: '2-digit',
                day: '2-digit', month: '2-digit', year: 'numeric'
            });
            const formattedTotal = Number(booking.total_amount).toLocaleString('vi-VN');
            const verifyUrl = `${baseUrl}/ticket/verify?token=${encodeURIComponent(booking.booking_token || booking.booking_code)}`;

            const emailSubject = `[CineVibe] Vé xem phim điện tử - ${booking.movie_title} (${booking.booking_code})`;
            const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0B0F19; color: #FFFFFF; margin: 0; padding: 20px; }
                    .ticket-card { max-width: 600px; margin: 0 auto; background: #171E2B; border: 1px solid #2A3446; border-radius: 12px; padding: 30px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
                    .header { border-bottom: 2px dashed #F5C451; padding-bottom: 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
                    .logo { font-size: 24px; font-weight: bold; color: #FFFFFF; }
                    .logo span { color: #E50914; }
                    .badge { background: #10B981; color: white; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
                    .movie-title { font-size: 22px; font-weight: bold; color: #FFFFFF; margin: 0 0 10px 0; }
                    .cinema-info { color: #F5C451; font-size: 15px; margin-bottom: 20px; }
                    .details-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
                    .details-table td { padding: 8px 0; font-size: 14px; }
                    .details-table .label { color: #94A3B8; width: 140px; }
                    .details-table .value { color: #FFFFFF; font-weight: 600; }
                    .total-box { background: #0B0F19; border: 1px solid #2A3446; border-radius: 8px; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
                    .total-label { color: #94A3B8; font-size: 14px; }
                    .total-amount { color: #F5C451; font-size: 22px; font-weight: bold; }
                    .btn-action { display: block; text-align: center; background: #E50914; color: #FFFFFF; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 15px; }
                    .footer { text-align: center; color: #64748B; font-size: 12px; margin-top: 25px; }
                </style>
            </head>
            <body>
                <div class="ticket-card">
                    <div class="header">
                        <div class="logo">CINE<span>VIBE</span></div>
                        <span class="badge">ĐÃ XÁC NHẬN</span>
                    </div>
                    
                    <h1 class="movie-title">${booking.movie_title}</h1>
                    <div class="cinema-info">${booking.cinema_name} &bull; ${booking.room_name}</div>
                    
                    <table class="details-table">
                        <tr>
                            <td class="label">Mã đặt vé:</td>
                            <td class="value" style="color: #F5C451; font-family: monospace; font-size: 16px;">${booking.booking_code}</td>
                        </tr>
                        <tr>
                            <td class="label">Suất chiếu:</td>
                            <td class="value">${formattedTime}</td>
                        </tr>
                        <tr>
                            <td class="label">Vị trí ghế:</td>
                            <td class="value" style="color: #60A5FA;">${seatListStr}</td>
                        </tr>
                        <tr>
                            <td class="label">Người nhận vé:</td>
                            <td class="value">${booking.customer_name} (${booking.customer_phone})</td>
                        </tr>
                        <tr>
                            <td class="label">Hình thức:</td>
                            <td class="value">${booking.payment_method || 'Thanh toán trực tuyến'}</td>
                        </tr>
                    </table>
                    
                    <div class="total-box">
                        <span class="total-label">Tổng tiền đã thanh toán:</span>
                        <span class="total-amount">${formattedTotal} đ</span>
                    </div>
                    
                    <a href="${verifyUrl}" class="btn-action" target="_blank">Xem Vé Điện Tử & Quét Mã QR</a>
                    
                    <div class="footer">
                        Cảm ơn bạn đã lựa chọn CineVibe. Vui lòng xuất trình vé điện tử tại rạp trước giờ chiếu 15 phút.<br>
                        Email này được gửi tự động từ hệ thống CineVibe Cinema System.
                    </div>
                </div>
            </body>
            </html>
            `;

            // Nếu transporter khả dụng, gửi email qua SMTP
            if (transporter) {
                const mailOptions = {
                    from: process.env.SMTP_FROM || '"CineVibe Cinema" <no-reply@cinevibe.local>',
                    to: booking.customer_email,
                    subject: emailSubject,
                    html: emailHtml
                };

                const info = await transporter.sendMail(mailOptions);
                logger.info(`Ticket email sent successfully via SMTP to ${booking.customer_email} (MsgID: ${info.messageId})`);
                return { success: true, simulated: false, messageId: info.messageId };
            } else {
                // Chế độ Sandbox / Demo: Ghi nhận thông tin email vào file log sandbox
                // KHÔNG ghi verify URL có chứa booking_token vào log (tránh lộ token)
                const sandboxLogDir = path.join(__dirname, '../logs');
                if (!fs.existsSync(sandboxLogDir)) {
                    fs.mkdirSync(sandboxLogDir, { recursive: true });
                }
                const sandboxLogPath = path.join(sandboxLogDir, 'email_sandbox.log');
                const logEntry = `[${new Date().toISOString()}] EMAIL TO: ${booking.customer_email} | SUBJECT: ${emailSubject} | BOOKING: ${booking.booking_code}\n`;
                fs.appendFileSync(sandboxLogPath, logEntry, 'utf8');

                logger.info(`[Email Sandbox] Email generated for Booking ${booking.booking_code}. Logged to ${sandboxLogPath}`);
                return { success: true, simulated: true, bookingCode: booking.booking_code };
            }
        } catch (error) {
            // Không để lỗi gửi email làm gián đoạn luồng thanh toán
            logger.error(`Failed to process ticket email for booking ${bookingId}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
};

module.exports = emailService;
