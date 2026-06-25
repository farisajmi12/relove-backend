const bcrypt = require('bcrypt');
const pool = require('../config/db');
const jwt = require('jsonwebtoken');

exports.registerUser = async (req, res) => {
    try {
        const { name, email, phone_number, password } = req.body;

        // Validasi input sederhana
        if (!name || !email || !phone_number || !password) {
            return res.status(400).json({
                success: false,
                message: 'Semua kolom wajib diisi!' });
        }

        // Enkripsi password menggunakan bcrypt dengan salt rounds 10
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Simpan ke database MySQL
        const query = `INSERT INTO users (name, email, phone_number, password_hash, status) VALUES (?, ?, ?, ?, 'active')`;
        const [result] = await pool.execute(query, [name, email, phone_number, password_hash]);

        res.status(201).json({
            success: true,
            message: 'Registrasi berhasil!',
            userId: result.insertId
        });

    } catch (error) {
        console.error('Error saat registrasi:', error);
        // Tangani error duplicate email/phone (Unique Index)
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ 
                success: false,
                message: 'Email atau Nomor HP sudah terdaftar.' 
            });
        }
        res.status(500).json({ 
            success: false,
            message: 'Terjadi kesalahan pada server.' 
        });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Validasi input
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Email dan password wajib diisi!' 
            });
        }

        // 2. Cari user di database berdasarkan email
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ 
                success: false,
                message: 'Email tidak terdaftar.' 
            });
        }

        const user = users[0];

        // 3. Cocokkan password yang dikirim dengan password hash di database
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ 
                success: false,
                message: 'Password salah.' 
            });
        }

        // 4. Buat token JWT jika login sukses (berlaku 24 jam)
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 5. Kirim balasan sukses beserta token
        res.status(200).json({
            success: true,
            message: 'Login berhasil!',
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Error saat login:', error);
        res.status(500).json({ 
            success: false,
            message: 'Terjadi kesalahan internal server.' 
        });
    }
};