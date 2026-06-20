const pool = require('../config/db');

exports.createOrder = async (req, res) => {
    // Mulai mode transaksi database (Integritas Data)
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const buyerId = req.user.id; // Dari JWT Middleware
        const { listing_id } = req.body;

        // 1. Cek apakah barang ada dan statusnya masih 'active'
        const [listings] = await connection.execute(
            'SELECT * FROM listings WHERE id = ? FOR UPDATE', // FOR UPDATE mengunci baris ini sementara agar tidak dibeli orang lain secara bersamaan
            [listing_id]
        );

        if (listings.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Barang tidak ditemukan.' });
        }

        const listing = listings[0];

        if (listing.status !== 'active') {
            await connection.rollback();
            return res.status(400).json({ message: 'Maaf, barang ini sudah terjual atau sedang dimoderasi.' });
        }

        // Cek agar penjual tidak membeli barangnya sendiri
        if (listing.seller_id === buyerId) {
            await connection.rollback();
            return res.status(400).json({ message: 'Kamu tidak bisa membeli barangmu sendiri.' });
        }

        // 2. Catat transaksi ke tabel transactions
        const insertTxQuery = `INSERT INTO transactions (buyer_id, listing_id, amount, transaction_status) VALUES (?, ?, ?, 'success')`;
        const [txResult] = await connection.execute(insertTxQuery, [buyerId, listing_id, listing.price]);

        // 3. Ubah status barang menjadi 'sold'
        await connection.execute(`UPDATE listings SET status = 'sold' WHERE id = ?`, [listing_id]);

        // 4. Jika semua proses sukses, patenkan perubahan di database!
        await connection.commit();
        connection.release();

        res.status(201).json({
            message: 'Checkout berhasil! Status barang kini telah Terjual.',
            transactionId: txResult.insertId
        });

    } catch (error) {
        // Jika ada error di tengah jalan, batalkan semua perubahan!
        await connection.rollback();
        connection.release();
        console.error('Error saat Checkout:', error);
        res.status(500).json({ message: 'Transaksi gagal, terjadi kesalahan server.' });
    }
};