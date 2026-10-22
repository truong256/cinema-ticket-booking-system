/**
 * CINEVIBE CINEMA CITY AUTHENTICATION JAVASCRIPT
 * Handles password visibility, loading state, double-click protection & client feedback
 */

document.addEventListener('DOMContentLoaded', function () {
    // 1. Password Visibility Toggle
    window.togglePasswordVisibility = function (fieldId, btn) {
        const input = document.getElementById(fieldId);
        if (!input) return;
        
        const icon = btn.querySelector('i');
        const isPassword = input.type === 'password';
        
        input.type = isPassword ? 'text' : 'password';
        btn.setAttribute('aria-label', isPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu');
        btn.setAttribute('title', isPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu');
        
        if (icon) {
            if (isPassword) {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        }
        
        // Keep focus on input or button gracefully
        input.focus();
    };

    // 2. Poster Image Fallback Handler
    const posterImages = document.querySelectorAll('.tilted-poster img');
    posterImages.forEach(function (img) {
        img.addEventListener('error', function () {
            if (!this.getAttribute('data-fallback-applied')) {
                this.setAttribute('data-fallback-applied', 'true');
                this.src = '/images/default_poster.jpg';
            }
        });
    });

    // 3. Login Form Submit Handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            const submitBtn = this.querySelector('.auth-submit-btn');
            if (submitBtn) {
                // Check if already loading
                if (submitBtn.classList.contains('is-loading')) {
                    e.preventDefault();
                    return false;
                }
                
                // Add loading state
                submitBtn.classList.add('is-loading');
                const btnText = submitBtn.querySelector('.auth-btn-text');
                if (btnText) {
                    btnText.textContent = 'Đang đăng nhập...';
                }
                
                // Safety timeout to re-enable if page does not navigate (e.g. invalid form)
                setTimeout(function () {
                    if (submitBtn && submitBtn.classList.contains('is-loading')) {
                        submitBtn.classList.remove('is-loading');
                        if (btnText) btnText.textContent = 'Đăng nhập ngay';
                    }
                }, 8000);
            }
        });
    }

    // 4. Register Form Submit & Password Match Validation
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        const passwordInput = document.getElementById('password');
        const confirmInput = document.getElementById('confirm_password');
        const matchError = document.getElementById('passwordMatchError');

        function checkPasswordMatch() {
            if (!passwordInput || !confirmInput || !matchError) return true;
            if (confirmInput.value.length === 0) {
                matchError.style.display = 'none';
                return true;
            }
            if (passwordInput.value !== confirmInput.value) {
                matchError.textContent = 'Mật khẩu xác nhận không khớp.';
                matchError.style.display = 'block';
                return false;
            } else {
                matchError.style.display = 'none';
                return true;
            }
        }

        if (passwordInput && confirmInput) {
            confirmInput.addEventListener('input', checkPasswordMatch);
            passwordInput.addEventListener('input', function () {
                if (confirmInput.value.length > 0) {
                    checkPasswordMatch();
                }
            });
        }

        registerForm.addEventListener('submit', function (e) {
            const submitBtn = this.querySelector('.auth-submit-btn');
            
            // Client-side confirmation check
            if (!checkPasswordMatch()) {
                e.preventDefault();
                confirmInput.focus();
                return false;
            }

            if (submitBtn) {
                if (submitBtn.classList.contains('is-loading')) {
                    e.preventDefault();
                    return false;
                }

                submitBtn.classList.add('is-loading');
                const btnText = submitBtn.querySelector('.auth-btn-text');
                if (btnText) {
                    btnText.textContent = 'Đang khởi tạo tài khoản...';
                }

                // Safety timeout
                setTimeout(function () {
                    if (submitBtn && submitBtn.classList.contains('is-loading')) {
                        submitBtn.classList.remove('is-loading');
                        if (btnText) btnText.textContent = 'Hoàn tất đăng ký thành viên';
                    }
                }, 8000);
            }
        });
    }
});
