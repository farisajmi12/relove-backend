const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    // Ambil token dari header Authorization
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Akses ditolak. Token tidak ditemukan.' });
    }

    const token = authHeader.split(' ')[1]; // Mengambil token setelah kata 'Bearer'

    try {
        // Verifikasi token menggunakan secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Simpan data user (id, email) ke dalam req untuk dipakai di controller
        req.user = decoded; 
        next(); // Lanjut ke fungsi controller
    } catch (error) {
        return res.status(403).json({ message: 'Token tidak valid atau sudah kadaluarsa.' });
    }
};