const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Endpoint POST /api/auth/register
router.post('/register', authController.registerUser);
// Tambahkan endpoint login ini
router.post('/login', authController.loginUser);

module.exports = router;