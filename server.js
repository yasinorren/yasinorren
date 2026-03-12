require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/products',  require('./routes/products'));
app.use('/api/inquiries', require('./routes/inquiries'));
app.use('/api/sales',     require('./routes/sales'));

// Admin panel SPA fallback
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin/index.html')));

// Main site fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Innomed Life Sciences Server çalışıyor`);
  console.log(`   Müşteri Sitesi : http://localhost:${PORT}`);
  console.log(`   Admin Paneli   : http://localhost:${PORT}/admin`);
  console.log(`   Varsayılan giriş → admin / Innomed2024!\n`);
});
