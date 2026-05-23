require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./src/database/init');
const { authenticate } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ MIDDLEWARE ============
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Auth middleware for all requests
app.use(authenticate);

// ============ API ROUTES ============
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/products', require('./src/routes/products'));
app.use('/api/categories', require('./src/routes/categories'));
app.use('/api/brands', require('./src/routes/brands'));
app.use('/api/orders', require('./src/routes/orders'));

app.use('/api/dashboard', require('./src/routes/dashboard'));
app.use('/api/whatsapp', require('./src/routes/whatsapp'));
app.use('/api/users', require('./src/routes/users'));

// ============ PUBLIC SETTINGS (no auth required) ============
app.get('/api/settings/public', (req, res) => {
  try {
    const { getDb } = require('./src/database/init');
    const db = getDb();
    const settings = db.prepare('SELECT * FROM settings').all();
    const obj = {};
    for (const s of settings) {
      obj[s.setting_key] = s.setting_value;
    }
    res.json(obj);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// ============ PAGE ROUTES ============
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ============ ERROR HANDLING ============
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Archivo demasiado grande. Máximo 5MB.' });
  }
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ============ START SERVER ============
(async () => {
  await initDatabase();

  app.listen(PORT, '0.0.0.0', () => {
    const nets = require('os').networkInterfaces();
    const localIP = Object.values(nets).flat().find(i => i.family === 'IPv4' && !i.internal)?.address || 'tu-ip';
    console.log(`
  ╔══════════════════════════════════════════════════╗
  ║                                                  ║
  ║   🛍️  MODA STORE - Tienda Online                ║
  ║                                                  ║
  ║   🌐 Local:   http://localhost:${PORT}              ║
  ║   📱 Red:     http://${localIP}:${PORT}        ║
  ║   🔧 Admin:   http://${localIP}:${PORT}/admin  ║
  ║                                                  ║
  ║   📧 Admin:   ${process.env.ADMIN_EMAIL || 'admin@tiendamoda.com'}       ║
  ║   🔑 Pass:    ${process.env.ADMIN_PASSWORD || 'Admin123!'}                  ║
  ║                                                  ║
  ╚══════════════════════════════════════════════════╝
    `);
  });
})();

module.exports = app;
