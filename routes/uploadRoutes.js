const express = require('express');
const router = express.Router();
const uploadMiddleware = require('../config/cloudinarySetup');
const listingController = require('../controllers/listingController');

// Menggunakan upload.array untuk menerima maksimal 5 file gambar sekaligus
router.post('/create', uploadMiddleware.array('images', 5), listingController.createListing);
router.get('/', listingController.getAllListings);
router.get('/:id', listingController.getListingById);
module.exports = router;