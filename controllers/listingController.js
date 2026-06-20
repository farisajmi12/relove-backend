const pool = require('../config/db');

exports.createListing = async (req, res) => {
    // Mulai transaksi database (jika salah satu gagal, semua dibatalkan/rollback)
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const { seller_id, title, brand, category, size, condition_description, price, slot_types } = req.body;
        const files = req.files;

        // 1. VALIDASI SISI SERVER (FR-01): Cek jumlah file
        if (!files || files.length !== 5) {
            return res.status(400).json({ message: 'Validasi Gagal: Wajib mengunggah tepat 5 foto.' });
        }

        // Slot types dikirim dari frontend sebagai array string (contoh: ['front', 'back', 'tag', 'minus', 'detail'])
        // Pastikan frontend mengirimkan urutan tipe slot yang sesuai dengan urutan file gambar
        let parsedSlotTypes;
        try {
            parsedSlotTypes = typeof slot_types === 'string' ? JSON.parse(slot_types) : slot_types;
        } catch (e) {
            return res.status(400).json({ message: 'Format slot_types tidak valid.' });
        }

        // 2. VALIDASI SISI SERVER (FR-01): Cek variasi elemen wajib
        const requiredSlots = ['front', 'back', 'tag', 'minus', 'detail'];
        const hasAllSlots = requiredSlots.every(slot => parsedSlotTypes.includes(slot));
        
        if (!hasAllSlots) {
            return res.status(400).json({ message: 'Validasi Gagal: Tipe slot foto (Depan, Belakang, Label, Minus, Detail) tidak lengkap.' });
        }

        // 3. Simpan data ke tabel 'listings'
        const listingQuery = `
            INSERT INTO listings (seller_id, title, brand, category, size, condition_description, price, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
        `;
        const [listingResult] = await connection.execute(listingQuery, [
            seller_id, title, brand, category, size, condition_description, price
        ]);
        
        const listingId = listingResult.insertId;

        // 4. Simpan ke tabel 'listing_images' (Tautan URL dari Cloudinary)
        const imageQuery = `INSERT INTO listing_images (listing_id, image_url, slot_type) VALUES (?, ?, ?)`;
        
        for (let i = 0; i < files.length; i++) {
            await connection.execute(imageQuery, [
                listingId, 
                files[i].path, // URL aman dari Cloudinary
                parsedSlotTypes[i]
            ]);
        }

        // Jika semua sukses, simpan permanen (commit)
        await connection.commit();
        connection.release();

        res.status(201).json({
            message: 'Listing berhasil dibuat dengan 5 foto terstandar!',
            listingId: listingId
        });

    } catch (error) {
        // Gunakan koma (,) bukan tanda tambah (+) agar objek error terbaca utuh
        console.error('Detail Error Upload:', error); 
        
        // Ubah balasan res.status agar memunculkan pesan aslinya di Hoppscotch
        res.status(500).json({ 
            message: 'Terjadi kesalahan saat upload.', 
            error: error.message || error 
        });
    }
};

// Fungsi untuk mengambil daftar barang (Katalog/Feed)
exports.getAllListings = async (req, res) => {
    try {
        // 1. Tangkap parameter filter dari URL (jika ada)
        const { search, category } = req.query; 

        // 2. Siapkan kueri dasar: Ambil data barang & gabungkan (JOIN) dengan foto depannya saja
        let query = `
            SELECT l.id, l.title, l.brand, l.category, l.price, l.size, l.condition_description, l.created_at, u.name AS seller_name, i.image_url AS thumbnail
            FROM listings l
            JOIN users u ON l.seller_id = u.id
            LEFT JOIN listing_images i ON l.id = i.listing_id AND i.slot_type = 'front'
            WHERE l.status = 'active'
        `;
        
        // Array untuk menyimpan nilai filter
        const queryParams = [];

        // 3. Tambahkan logika filter dinamis jika user melakukan pencarian
        if (search) {
            query += ` AND l.title LIKE ?`;
            queryParams.push(`%${search}%`); // Mencari kata yang mengandung inputan
        }

        // 4. Tambahkan logika filter dinamis jika user memilih kategori
        if (category) {
            query += ` AND l.category = ?`;
            queryParams.push(category);
        }

        // 5. Urutkan dari barang yang paling baru di-upload
        query += ` ORDER BY l.created_at DESC`;

        // Eksekusi kueri ke MySQL
        const [listings] = await pool.execute(query, queryParams);

        // Kembalikan hasil ke frontend
        res.status(200).json({
            message: 'Berhasil mengambil data katalog',
            total_items: listings.length,
            data: listings
        });

    } catch (error) {
        console.error('Detail Error Get Listings:', error);
        res.status(500).json({ message: 'Terjadi kesalahan saat mengambil data katalog.' });
    }
};

// Fungsi untuk mengambil detail satu barang (termasuk 5 fotonya)
exports.getListingById = async (req, res) => {
    try {
        // Tangkap ID barang dari URL (contoh: /api/listings/1)
        const { id } = req.params;

        // 1. Ambil data utama barang & informasi kontak penjualnya
        const [listings] = await pool.execute(`
            SELECT l.*, u.name AS seller_name, u.phone_number 
            FROM listings l 
            JOIN users u ON l.seller_id = u.id 
            WHERE l.id = ?
        `, [id]);

        // Jika barang tidak ada di database
        if (listings.length === 0) {
            return res.status(404).json({ message: 'Barang tidak ditemukan.' });
        }

        const listingData = listings[0];

        // 2. Ambil kelima foto yang terhubung dengan barang ini
        const [images] = await pool.execute(
            `SELECT image_url, slot_type FROM listing_images WHERE listing_id = ?`, 
            [id]
        );

        // 3. Sisipkan array gambar ke dalam object data barang
        listingData.images = images;

        // Kirim balasan sukses
        res.status(200).json({
            message: 'Berhasil mengambil detail barang',
            data: listingData
        });

    } catch (error) {
        console.error('Detail Error Get Listing By ID:', error);
        res.status(500).json({ message: 'Terjadi kesalahan saat mengambil detail barang.' });
    }
};

// Fungsi untuk melihat barang milik user yang sedang login
exports.getMyListings = async (req, res) => {
    try {
        // req.user.id didapatkan dari authMiddleware
        const sellerId = req.user.id; 

        const query = `
            SELECT l.*, i.image_url AS thumbnail 
            FROM listings l
            LEFT JOIN listing_images i ON l.id = i.listing_id AND i.slot_type = 'front'
            WHERE l.seller_id = ?
            ORDER BY l.created_at DESC
        `;
        
        const [myListings] = await pool.execute(query, [sellerId]);

        res.status(200).json({
            message: 'Berhasil mengambil data barang milikmu',
            total_items: myListings.length,
            data: myListings
        });

    } catch (error) {
        console.error('Error Get My Listings:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};