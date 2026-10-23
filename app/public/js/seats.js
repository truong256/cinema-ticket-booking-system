/**
 * Cinema Ticket Booking - Interactive Seat Selection
 * Author: Nguyễn Duy Trường - DTC245200120 - CNTTK23E
 * Reference Inspiration: Lumière Cinema & BookMyShow
 */

document.addEventListener('DOMContentLoaded', () => {
    const seats = document.querySelectorAll('.seat:not(.booked)');
    const selectedListEl = document.getElementById('selectedSeatsList');
    const countBadgeEl = document.getElementById('selectedCountBadge');
    const totalPriceEl = document.getElementById('totalPrice');
    const submitBtn = document.getElementById('btnSubmitBooking');
    const bookingForm = document.getElementById('bookingForm');

    const showtimeId = document.getElementById('showtimeId')?.value;
    const priceRegular = parseFloat(document.getElementById('priceRegular')?.value || 85000);
    const priceVip = parseFloat(document.getElementById('priceVip')?.value || 110000);
    const priceCouple = parseFloat(document.getElementById('priceCouple')?.value || 180000);

    let selectedSeats = new Map(); // id -> { id, label, type, price }

    // Xử lý click chọn ghế
    seats.forEach(seat => {
        seat.addEventListener('click', () => {
            const id = seat.dataset.id;
            const label = seat.dataset.label;
            const type = seat.dataset.type;

            let price = priceRegular;
            if (type === 'VIP') price = priceVip;
            if (type === 'Couple') price = priceCouple;

            if (selectedSeats.has(id)) {
                selectedSeats.delete(id);
                seat.classList.remove('selected');
            } else {
                if (selectedSeats.size >= 8) {
                    alert('Bạn chỉ có thể đặt tối đa 8 ghế trong một lần giao dịch.');
                    return;
                }
                selectedSeats.set(id, { id, label, type, price });
                seat.classList.add('selected');
            }

            updateSummary();
        });

        // Hỗ trợ chọn bằng phím Enter/Space khi focus
        seat.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                seat.click();
            }
        });
    });

    // Cập nhật bảng tổng kết thanh toán
    function updateSummary() {
        if (!selectedListEl || !totalPriceEl) return;

        selectedListEl.innerHTML = '';
        let total = 0;

        if (countBadgeEl) {
            countBadgeEl.textContent = `${selectedSeats.size} ghế`;
        }

        if (selectedSeats.size === 0) {
            selectedListEl.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">Chưa có ghế nào được chọn. Nhấp vào ghế trên sơ đồ để chọn.</span>';
            totalPriceEl.textContent = '0 đ';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Tiếp tục thanh toán';
            }
            return;
        }

        selectedSeats.forEach(item => {
            total += item.price;
            const tag = document.createElement('span');
            tag.className = 'selected-seat-tag';
            tag.innerHTML = `<span>${item.label} (${item.type})</span> <span style="cursor:pointer; opacity:0.7; font-weight: bold; margin-left: 6px;" title="Bỏ chọn">&times;</span>`;
            
            // Cho phép click vào x để bỏ chọn ghế
            tag.querySelector('span:last-child').addEventListener('click', (ev) => {
                ev.stopPropagation();
                const seatElem = document.querySelector(`.seat[data-id="${item.id}"]`);
                if (seatElem) seatElem.classList.remove('selected');
                selectedSeats.delete(item.id);
                updateSummary();
            });

            selectedListEl.appendChild(tag);
        });

        totalPriceEl.textContent = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(total);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = `Thanh toán (${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(total)})`;
        }
    }

    // Submit Đặt vé
    if (bookingForm) {
        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (selectedSeats.size === 0) {
                alert('Vui lòng chọn ít nhất một ghế ngồi trước khi tiếp tục!');
                return;
            }

            const customerName = document.getElementById('customerName')?.value.trim();
            const customerEmail = document.getElementById('customerEmail')?.value.trim();
            const customerPhone = document.getElementById('customerPhone')?.value.trim();

            if (!customerName || !customerEmail || !customerPhone) {
                alert('Vui lòng điền đầy đủ Họ tên, Email và Số điện thoại nhận vé!');
                return;
            }

            const seatIds = Array.from(selectedSeats.keys());

            submitBtn.disabled = true;
            submitBtn.textContent = 'Đang giữ chỗ và khóa giao dịch...';

            try {
                const response = await fetch('/booking/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        showtimeId,
                        seatIds,
                        customerName,
                        customerEmail,
                        customerPhone
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // Chuyển hướng tới trang thanh toán
                    window.location.href = data.redirectUrl;
                } else if (response.status === 409 || data.conflict) {
                    // Xung đột đặt trùng ghế (Double booking prevention)
                    alert('THÔNG BÁO XUNG ĐỘT GHẾ:\n' + (data.message || 'Ghế bạn vừa chọn đã có người khác đặt. Vui lòng chọn ghế khác.'));
                    // Reload trạng thái ghế
                    refreshSeatsStatus();
                    submitBtn.disabled = false;
                    updateSummary();
                } else {
                    alert('Lỗi đặt vé: ' + (data.message || 'Không thể tạo đơn đặt vé lúc này'));
                    submitBtn.disabled = false;
                    updateSummary();
                }
            } catch (err) {
                alert('Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền và thử lại!');
                submitBtn.disabled = false;
                updateSummary();
            }
        });
    }

    // Polling cập nhật ghế thời gian thực
    async function refreshSeatsStatus() {
        if (!showtimeId) return;
        try {
            const res = await fetch(`/booking/api/showtime/${showtimeId}/seats`);
            const data = await res.json();
            if (data.success && data.bookedSeatIds) {
                const bookedSet = new Set(data.bookedSeatIds);
                document.querySelectorAll('.seat').forEach(seat => {
                    const id = parseInt(seat.dataset.id, 10);
                    if (bookedSet.has(id)) {
                        seat.classList.add('booked');
                        seat.classList.remove('selected');
                        selectedSeats.delete(id.toString());
                    }
                });
                updateSummary();
            }
        } catch (e) {
            console.warn('Real-time seat status polling error:', e);
        }
    }

    // Tự động kiểm tra trạng thái ghế mỗi 15 giây
    setInterval(refreshSeatsStatus, 15000);
});
