const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { verifyToken } = require('../middleware/authMiddleware');


router.post('/checkout', verifyToken, transactionController.createOrder);
router.get('/history', verifyToken, transactionController.getOrderHistory);
router.post('/webhook', transactionController.midtransWebhook);

module.exports = router;