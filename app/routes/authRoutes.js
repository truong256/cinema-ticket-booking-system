const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/login', authController.renderLogin);
router.post('/login', authController.handleLogin);
router.get('/register', authController.renderRegister);
router.post('/register', authController.handleRegister);
router.get('/logout', authController.handleLogout);

module.exports = router;
