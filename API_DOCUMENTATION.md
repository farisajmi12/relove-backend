# 📑 Dokumentasi Resmi RESTful API RE-LOVE

Selamat datang di dokumentasi teknis API RE-LOVE. Seluruh *endpoint* di bawah ini telah dikonfigurasi menggunakan arsitektur relasional MySQL dan terstandarisasi dengan respons format JSON.

---

## 🔐 1. Modul Autentikasi (Authentication)

### 🔹 Registrasi Akun Baru
* **URL:** `/api/auth/register`
* **Method:** `POST`
* **Content-Type:** `application/json`
* **Request Body:**
```json
  {
    "name": "Siti",
    "email": "siti@mail.com",
    "phone_number": "089876543210",
    "password": "rahasia"
  }

Respons Sukses (201 Created):
  {
    "success": true,
    "message": "Registrasi berhasil!",
    "userId": 2
  }

🔹 Login Pengguna
URL: /api/auth/login

Method: POST

Request Body:

  {
    "email": "siti@mail.com",
    "password": "rahasia"
  }

Respons Sukses (200 OK):
  {
    "success": true,
    "message": "Login berhasil!",
    "token": "eyJhbGciOiJIUzI1NiIsInR5c...",
    "user": { "id": 2, "name": "Siti", "email": "siti@mail.com" }
  }


👕 2. Modul Produk & Katalog (Listings)
🔹 Ambil Semua Katalog (Dinamis dengan Filter)
URL: /api/listings

Method: GET

Query Parameters (Opsional): ?search=kemeja&category=pakaian

Respons Sukses (200 OK):
    {
        "success": true,
        "message": "Berhasil mengambil data katalog",
        "total_items": 1,
        "data": [ ... ]
    }

🔹 Buat Produk Baru (Wajib 5 Gambar Terstandar)
URL: /api/listings/create

Method: POST

Headers: Authorization: Bearer <JWT_TOKEN>

Content-Type: multipart/form-data

Request Body: seller_id, title, brand, category, size, condition_description, price, slot_types (Array), dan 5 File Foto (images).

💳 3. Modul Transaksi & Payment Gateway (Midtrans)
🔹 Pembuatan Pesanan (Checkout)
URL: /api/transactions/checkout

Method: POST

Headers: Authorization: Bearer <JWT_TOKEN>

Request Body:

JSON
  {
    "listing_id": 1
  }
Respons Sukses (201 Created):

JSON
  {
    "success": true,
    "message": "Silakan selesaikan pembayaran.",
    "transactionId": 2,
    "midtrans_token": "dda355e0-5b3e-464b-9e59-d51b0d68f68e",
    "redirect_url": "[https://app.sandbox.midtrans.com/snap/v4/redirection/](https://app.sandbox.midtrans.com/snap/v4/redirection/)..."
  }
🔹 Riwayat Transaksi (Pembeli & Penjual)
URL: /api/transactions/history

Method: GET

Headers: Authorization: Bearer <JWT_TOKEN>

Respons Sukses (200 OK):

JSON
  {
    "success": true,
    "message": "Berhasil mengambil riwayat transaksi",
    "data": {
      "riwayat_pembelian": [ ... ],
      "riwayat_penjualan": [ ... ]
    }
  }
🔹 Webhook Notifikasi Otomatis (Khusus Mesin Midtrans)
URL: /api/transactions/webhook

Method: POST

Note: Endpoint privat tanpa pengunci JWT karena diakses otomatis oleh server eksternal Midtrans secara langsung untuk menyinkronkan status data.