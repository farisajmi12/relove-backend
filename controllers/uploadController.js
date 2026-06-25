exports.uploadImage = (req, res) => {
    // req.file sudah berisi data dari Cloudinary berkat multer-storage-cloudinary
    if (!req.file) {
        return res.status(400).json({ 
            success: false,
            message: 'Tidak ada file yang diunggah.' });
    }

    res.status(200).json({
        success: true,
        message: 'Gambar berhasil diunggah ke Cloudinary!',
        imageUrl: req.file.path // Ini adalah Tautan langsung dari Cloudinary
    });
};