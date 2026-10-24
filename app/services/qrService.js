const QRCode = require('qrcode');
const logger = require('../config/logger');

const qrService = {
    /**
     * Tạo mã QR dạng Data URL (base64 PNG) chứa đường link xác minh vé bảo mật
     * @param {Object} req - Express request object để lấy host/protocol
     * @param {Object} booking - Thông tin booking bao gồm booking_token và booking_code
     * @returns {Promise<string>} Data URL của QR code
     */
    generateTicketQr: async (req, booking) => {
        try {
            const host = req ? req.get('host') : 'localhost';
            const protocol = req && req.protocol ? req.protocol : 'http';
            const token = booking.booking_token || booking.booking_code;
            
            // Đường link xác minh vé bảo mật công khai (không lộ thông tin nhạy cảm trong URL)
            const verificationUrl = `${protocol}://${host}/ticket/verify?token=${encodeURIComponent(token)}`;

            // Render mã QR chất lượng cao, độ tương phản sắc nét
            const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
                errorCorrectionLevel: 'H',
                type: 'image/png',
                margin: 2,
                width: 280,
                color: {
                    dark: '#0B0F19', // Dark Cinema tone
                    light: '#FFFFFF'
                }
            });

            return {
                qrDataUrl,
                verificationUrl
            };
        } catch (error) {
            logger.error(`Error generating QR code for booking ${booking.booking_code}: ${error.message}`);
            // Fallback nếu có lỗi
            return {
                qrDataUrl: '',
                verificationUrl: ''
            };
        }
    }
};

module.exports = qrService;
