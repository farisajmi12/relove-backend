const express = require('express');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes'); 
const uploadRoutes = require('./routes/uploadRoutes');
const transactionRoutes = require('./routes/transactionRoutes');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/auth', authRoutes); 
app.use('/api/listings', uploadRoutes); 
app.use('/api/transactions', transactionRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server RE-LOVE berjalan lancar di port ${PORT}`);
});