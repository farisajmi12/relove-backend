const pool = require('../config/db');
// 1. Import settingan Midtrans (Snap dan CoreApi)
const { snap, coreApi } = require('../config/midtransSetup'); 

// =================================================================
// FUNGSI 1: MEMBUAT PESANAN (MINTA TOKEN KE MIDTRANS)
// =================================================================
exports.createOrder = async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const buyerId = req.user.id; 
        const { listing_id } = req.body;

        // Cek ketersediaan barang
        const [listings] = await connection.execute(
            'SELECT * FROM listings WHERE id = ? FOR UPDATE', 
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

        if (listing.seller_id === buyerId) {
            await connection.rollback();
            return res.status(400).json({ message: 'Kamu tidak bisa membeli barangmu sendiri.' });
        }

        // --- MULAI LOGIKA MIDTRANS ---
        const grossAmount = listing.price;
        // Buat ID unik untuk Midtrans (ORDER-waktu-IDpembeli-IDbarang)
        const orderId = `ORDER-${Date.now()}-${buyerId}-${listing_id}`; 

        // Catat transaksi ke DB, TAPI statusnya 'pending' (belum dibayar)
        const insertTxQuery = `INSERT INTO transactions (buyer_id, listing_id, amount, transaction_status) VALUES (?, ?, ?, 'pending')`;
        const [txResult] = await connection.execute(insertTxQuery, [buyerId, listing_id, grossAmount]);

        // Siapkan kerangka data untuk dikirim ke Midtrans
        const parameter = {
            transaction_details: {
                order_id: orderId,
                gross_amount: parseInt(grossAmount)
            },
            item_details: [{
                id: listing.id.toString(),
                price: parseInt(grossAmount),
                quantity: 1,
                name: listing.title
            }],
            customer_details: {
                first_name: req.user.name,
                email: req.user.email
            }
        };

        // Tembak API Midtrans untuk mendapatkan Snap Token
        const midtransTransaction = await snap.createTransaction(parameter);

        // Ubah status barang jadi 'moderation' agar tidak bisa di-checkout orang lain saat menunggu transfer
        await connection.execute(`UPDATE listings SET status = 'moderation' WHERE id = ?`, [listing_id]);

        await connection.commit();
        connection.release();

        // Kirim token Midtrans ke Frontend React
        res.status(201).json({
            message: 'Silakan selesaikan pembayaran.',
            transactionId: txResult.insertId,
            midtrans_token: midtransTransaction.token,
            redirect_url: midtransTransaction.redirect_url
        });

    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Midtrans Checkout Error:', error);
        res.status(500).json({ message: 'Gagal membuat pesanan.' });
    }
};

// =================================================================
// FUNGSI 2: WEBHOOK MIDTRANS (PENERIMA NOTIFIKASI OTOMATIS)
// =================================================================
exports.midtransWebhook = async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const notificationObj = req.body;
        
        // Verifikasi keaslian notifikasi ke server Midtrans (Keamanan)
        const statusResponse = await coreApi.transaction.notification(notificationObj);
        
        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;

        // Ambil ID Listing dari belakang order_id
        const listingId = orderId.split('-')[3]; 

        if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
            if (fraudStatus === 'accept' || !fraudStatus) {
                // UANG MASUK: Ubah transaksi jadi success, barang jadi sold
                await connection.execute(`UPDATE transactions SET transaction_status = 'success' WHERE listing_id = ?`, [listingId]);
                await connection.execute(`UPDATE listings SET status = 'sold' WHERE id = ?`, [listingId]);
            }
        } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
            // BATAL/KADALUARSA: Ubah transaksi failed, barang kembalikan ke etalase (active)
            await connection.execute(`UPDATE transactions SET transaction_status = 'failed' WHERE listing_id = ?`, [listingId]);
            await connection.execute(`UPDATE listings SET status = 'active' WHERE id = ?`, [listingId]); 
        }

        await connection.commit();
        connection.release();

        // Balas pesan ke mesin Midtrans agar berhenti mengirim notifikasi
        res.status(200).json({ status: 'OK' });

    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Webhook Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// =================================================================
// FUNGSI 3: MENGAMBIL RIWAYAT TRANSAKSI (PEMBELI & PENJUAL)
// =================================================================
exports.getOrderHistory = async (req, res) => {
    try {
        // Ambil ID User dari Token JWT yang sedang login
        const userId = req.user.id;

        // 1. Kueri Riwayat Pembelian (User sebagai Buyer)
        // Mengambil data transaksi di mana buyer_id adalah user yang login
        const [purchases] = await pool.execute(`
            SELECT 
                t.id AS transaction_id, 
                t.transaction_status, 
                t.amount, 
                t.created_at, 
                l.title AS item_title,
                l.status AS item_status
            FROM transactions t
            JOIN listings l ON t.listing_id = l.id
            WHERE t.buyer_id = ?
            ORDER BY t.created_at DESC
        `, [userId]);

        // 2. Kueri Riwayat Penjualan (User sebagai Seller)
        // Mengambil data transaksi dari barang-barang milik user yang login
        const [sales] = await pool.execute(`
            SELECT 
                t.id AS transaction_id, 
                t.transaction_status, 
                t.amount, 
                t.created_at, 
                l.title AS item_title
            FROM transactions t
            JOIN listings l ON t.listing_id = l.id
            WHERE l.seller_id = ?
            ORDER BY t.created_at DESC
        `, [userId]);

        // 3. Kirimkan respons sukses ke Frontend
        res.status(200).json({
            success: true,
            message: 'Berhasil mengambil riwayat transaksi',
            data: {
                riwayat_pembelian: purchases,
                riwayat_penjualan: sales
            }
        });

    } catch (error) {
        console.error('Error saat mengambil riwayat transaksi:', error);
        res.status(500).json({ 
            success: false,
            message: 'Terjadi kesalahan pada server saat memuat riwayat.' 
        });
    }
};