const express = require('express');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes'); // 1. Pastikan baris ini ada
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. PASTIKAN BARIS INI ADA (Ini yang mengarahkan /api/auth ke authRoutes)
app.use('/api/auth', authRoutes); 
app.use('/api/listings', uploadRoutes); 

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server RE-LOVE berjalan lancar di port ${PORT}`);
});