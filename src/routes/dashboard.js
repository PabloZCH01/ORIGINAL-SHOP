const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const { authenticate, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /api/dashboard/stats
router.get('/stats', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();

    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const activeProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE active = 1').get().count;
    const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
    const pendingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pendiente'").get().count;
    const totalCategories = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;

    const revenue = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total
      FROM orders WHERE status != 'cancelado'
    `).get().total;

    const todayRevenue = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total
      FROM orders WHERE status != 'cancelado' AND DATE(created_at) = DATE('now')
    `).get().total;

    const monthRevenue = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total
      FROM orders WHERE status != 'cancelado' 
      AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
    `).get().total;

    const lowStock = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= 5 AND active = 1').get().count;

    // Orders by status
    const ordersByStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM orders GROUP BY status
    `).all();

    res.json({
      total_products: totalProducts,
      active_products: activeProducts,
      total_orders: totalOrders,
      pending_orders: pendingOrders,
      total_categories: totalCategories,
      total_revenue: revenue,
      today_revenue: todayRevenue,
      month_revenue: monthRevenue,
      low_stock: lowStock,
      ordersByStatus
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// GET /api/dashboard/recent-orders
router.get('/recent-orders', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const orders = db.prepare(`
      SELECT o.*, u.name as user_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `).all();

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener pedidos recientes' });
  }
});

// GET /api/dashboard/top-products
router.get('/top-products', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const products = db.prepare(`
      SELECT p.id, p.name, p.price, p.sale_price, p.images, p.sales_count, p.stock,
        c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.sales_count DESC
      LIMIT 10
    `).all();

    res.json(products.map(p => ({
      ...p,
      images: JSON.parse(p.images || '[]')
    })));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos top' });
  }
});

// GET /api/dashboard/sales-chart
router.get('/sales-chart', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { period = '7days' } = req.query;

    let query;
    if (period === '30days') {
      query = `
        SELECT DATE(created_at) as date, COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue
        FROM orders WHERE status != 'cancelado' AND created_at >= DATE('now', '-30 days')
        GROUP BY DATE(created_at) ORDER BY date
      `;
    } else if (period === '12months') {
      query = `
        SELECT strftime('%Y-%m', created_at) as date, COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue
        FROM orders WHERE status != 'cancelado' AND created_at >= DATE('now', '-12 months')
        GROUP BY strftime('%Y-%m', created_at) ORDER BY date
      `;
    } else {
      query = `
        SELECT DATE(created_at) as date, COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue
        FROM orders WHERE status != 'cancelado' AND created_at >= DATE('now', '-7 days')
        GROUP BY DATE(created_at) ORDER BY date
      `;
    }

    const data = db.prepare(query).all();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener datos del gráfico' });
  }
});

// ============ SETTINGS ============

// GET /api/dashboard/settings
router.get('/settings', authenticate, requireAdmin, (req, res) => {
  try {
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

// PUT /api/dashboard/settings
router.put('/settings', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const settings = req.body;

    const upsert = db.prepare(`
      INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
      ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value
    `);

    for (const [key, value] of Object.entries(settings)) {
      upsert.run(key, String(value));
    }

    res.json({ message: 'Configuración actualizada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
});

// ============ BANNERS ============

// GET /api/dashboard/banners
router.get('/banners', (req, res) => {
  try {
    const db = getDb();
    const { admin } = req.query;
    let banners;
    if (admin === '1') {
      banners = db.prepare('SELECT * FROM banners ORDER BY display_order ASC').all();
    } else {
      banners = db.prepare('SELECT * FROM banners WHERE active = 1 ORDER BY display_order ASC').all();
    }
    res.json(banners);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener banners' });
  }
});

// POST /api/dashboard/banners
router.post('/banners', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { title, subtitle, image, link, button_text, bg_color, text_color, display_order } = req.body;

    const result = db.prepare(`
      INSERT INTO banners (title, subtitle, image, link, button_text, bg_color, text_color, display_order, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(title, subtitle || '', image || '', link || '', button_text || 'Ver más', bg_color || '#1a1a2e', text_color || '#ffffff', display_order || 0);

    const banner = db.prepare('SELECT * FROM banners WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(banner);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear banner' });
  }
});

// PUT /api/dashboard/banners/:id
router.put('/banners/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { title, subtitle, image, link, button_text, bg_color, text_color, display_order, active } = req.body;

    db.prepare(`
      UPDATE banners SET title = ?, subtitle = ?, image = ?, link = ?, button_text = ?,
      bg_color = ?, text_color = ?, display_order = ?, active = ? WHERE id = ?
    `).run(title, subtitle, image, link, button_text, bg_color, text_color, display_order, active ? 1 : 0, req.params.id);

    const banner = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
    res.json(banner);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar banner' });
  }
});

// DELETE /api/dashboard/banners/:id
router.delete('/banners/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM banners WHERE id = ?').run(req.params.id);
    res.json({ message: 'Banner eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar banner' });
  }
});

// POST /api/dashboard/banners/:id/image
router.post('/banners/:id/image', authenticate, requireAdmin, upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen' });
    
    const db = getDb();
    const banner = db.prepare('SELECT id FROM banners WHERE id = ?').get(req.params.id);
    if (!banner) return res.status(404).json({ error: 'Banner no encontrado' });

    const imageUrl = `/uploads/${req.file.filename}`;
    db.prepare('UPDATE banners SET image = ? WHERE id = ?').run(imageUrl, req.params.id);
    
    res.json({ image: imageUrl });
  } catch (error) {
    console.error('Upload banner image error:', error);
    res.status(500).json({ error: 'Error al subir imagen' });
  }
});

// ============ COUPONS ============

// GET /api/dashboard/coupons
router.get('/coupons', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const coupons = db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all();
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener cupones' });
  }
});

// POST /api/dashboard/coupons
router.post('/coupons', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { code, description, discount_type, discount_value, min_purchase, max_uses, expires_at } = req.body;

    const result = db.prepare(`
      INSERT INTO coupons (code, description, discount_type, discount_value, min_purchase, max_uses, expires_at, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(code.toUpperCase(), description, discount_type, discount_value, min_purchase || 0, max_uses || null, expires_at || null);

    const coupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(coupon);
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ error: 'Error al crear cupón' });
  }
});

// DELETE /api/dashboard/coupons/:id
router.delete('/coupons/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
    res.json({ message: 'Cupón eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar cupón' });
  }
});

module.exports = router;
