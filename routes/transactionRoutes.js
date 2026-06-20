const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { verifyToken } = require('../middleware/authMiddleware');

// Wajib login untuk melakukan order
router.post('/checkout', verifyToken, transactionController.createOrder);

module.exports = router;