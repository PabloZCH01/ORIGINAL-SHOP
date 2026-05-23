const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/customers — Admin: list customers
router.get('/', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { search, page = 1, limit = 20 } = req.query;

    let where = ["role = 'customer'"];
    let params = [];

    if (search) {
      where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = where.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { total } = db.prepare(`SELECT COUNT(*) as total FROM users WHERE ${whereClause}`).get(...params);

    const customers = db.prepare(`
      SELECT id, name, email, phone, address, city, active, created_at,
        (SELECT COUNT(*) FROM orders WHERE user_id = users.id) as order_count,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE user_id = users.id AND status != 'cancelado') as total_spent
      FROM users
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({
      customers,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// GET /api/customers/:id — Admin: get customer detail
router.get('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const customer = db.prepare(`
      SELECT id, name, email, phone, address, city, active, created_at FROM users WHERE id = ? AND role = 'customer'
    `).get(req.params.id);

    if (!customer) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const orders = db.prepare(`
      SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
    `).all(req.params.id);

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(CASE WHEN status != 'cancelado' THEN total ELSE 0 END), 0) as total_spent,
        COALESCE(AVG(CASE WHEN status != 'cancelado' THEN total ELSE NULL END), 0) as avg_order
      FROM orders WHERE user_id = ?
    `).get(req.params.id);

    res.json({ ...customer, orders, stats });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
});

// PUT /api/customers/:id/toggle — Admin: Toggle customer active status
router.put('/:id/toggle', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const customer = db.prepare('SELECT active FROM users WHERE id = ? AND role = ?').get(req.params.id, 'customer');
    if (!customer) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    db.prepare('UPDATE users SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(customer.active ? 0 : 1, req.params.id);

    res.json({ message: 'Estado actualizado', active: !customer.active });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
});

// DELETE /api/customers/:id — Admin: Delete customer
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    db.prepare("DELETE FROM users WHERE id = ? AND role = 'customer'").run(req.params.id);
    res.json({ message: 'Cliente eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
});

module.exports = router;
