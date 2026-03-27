require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// API Routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/products',   require('./routes/products'));
app.use('/api/inquiries',  require('./routes/inquiries'));
app.use('/api/sales',      require('./routes/sales'));
app.use('/api/content',    require('./routes/content'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/sterility',  require('./routes/sterility'));
app.use('/api/upload',     require('./routes/upload'));

// Admin panel SPA fallback
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin/index.html')));

// Main site fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Innomed Life Sciences Server running`);
  console.log(`   Website  : http://localhost:${PORT}`);
  console.log(`   Admin    : http://localhost:${PORT}/admin`);
  console.log(`   Login    → admin / Innomed2024!\n`);
});
