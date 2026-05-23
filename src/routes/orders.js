const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const { authenticate, requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/orders — User: own orders / Admin: all orders
router.get('/', authenticate, requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { status, search, page = 1, limit = 20, start_date, end_date } = req.query;

    let where = [];
    let params = [];

    if (req.user.role !== 'admin') {
      where.push('o.user_id = ?');
      params.push(req.user.id);
    }

    if (status) {
      where.push('o.status = ?');
      params.push(status);
    }

    if (search) {
      where.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (start_date) {
      where.push('DATE(o.created_at) >= ?');
      params.push(start_date);
    }

    if (end_date) {
      where.push('DATE(o.created_at) <= ?');
      params.push(end_date);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { total } = db.prepare(`SELECT COUNT(*) as total FROM orders o ${whereClause}`).get(...params);

    const orders = db.prepare(`
      SELECT o.*, u.name as user_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    // Get items for each order
    const ordersWithItems = orders.map(order => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      return { ...order, items };
    });

    res.json({
      orders: ordersWithItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

// GET /api/orders/:id
router.get('/:id', authenticate, requireAuth, (req, res) => {
  try {
    const db = getDb();
    let order;

    if (req.user.role === 'admin') {
      order = db.prepare('SELECT o.*, u.name as user_name FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?').get(req.params.id);
    } else {
      order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    }

    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    res.json({ ...order, items });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
});

// POST /api/orders — Create order (checkout)
router.post('/', authenticate, (req, res) => {
  try {
    const db = getDb();
    const {
      customer_name, customer_email, customer_phone,
      shipping_address, shipping_city,
      payment_method, notes, items, coupon_code
    } = req.body;

    if (!customer_name || !customer_email || !shipping_address || !items || items.length === 0) {
      return res.status(400).json({ error: 'Datos de envío y productos son obligatorios' });
    }

    // Validate and calculate totals
    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(item.product_id);
      if (!product) {
        return res.status(400).json({ error: `Producto ${item.product_id} no encontrado` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Stock insuficiente para ${product.name}` });
      }

      const price = product.sale_price || product.price;
      subtotal += price * item.quantity;
      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        product_image: JSON.parse(product.images || '[]')[0] || '',
        quantity: item.quantity,
        price,
        size: item.size || '',
        color: item.color || ''
      });
    }

    // Get shipping settings
    const shippingSetting = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'shipping_cost'").get();
    const freeShippingSetting = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'free_shipping_min'").get();

    const shippingCost = parseFloat(shippingSetting?.setting_value || 3990);
    const freeShippingMin = parseFloat(freeShippingSetting?.setting_value || 50000);
    const finalShipping = subtotal >= freeShippingMin ? 0 : shippingCost;

    // Apply coupon
    let discount = 0;
    if (coupon_code) {
      const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(coupon_code.toUpperCase());
      if (coupon) {
        if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
          return res.status(400).json({ error: 'Cupón agotado' });
        }
        if (subtotal < coupon.min_purchase) {
          return res.status(400).json({ error: `Compra mínima de $${coupon.min_purchase.toLocaleString()} para este cupón` });
        }
        if (coupon.discount_type === 'percentage') {
          discount = Math.round(subtotal * coupon.discount_value / 100);
        } else {
          discount = coupon.discount_value;
        }
        db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(coupon.id);
      }
    }

    const total = subtotal + finalShipping - discount;

    // Generate order number
    const count = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const result = db.prepare(`
      INSERT INTO orders (order_number, user_id, customer_name, customer_email, customer_phone,
        shipping_address, shipping_city, subtotal, shipping_cost, tax, discount, total,
        status, payment_method, payment_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'pendiente', ?, 'pendiente', ?)
    `).run(
      orderNumber, req.user?.id || null, customer_name, customer_email,
      customer_phone || '', shipping_address, shipping_city || '',
      subtotal, finalShipping, discount, total, payment_method || 'efectivo', notes || ''
    );

    // Insert order items and update stock
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, product_image, quantity, price, size, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of validatedItems) {
      insertItem.run(result.lastInsertRowid, item.product_id, item.product_name, item.product_image, item.quantity, item.price, item.size, item.color);
      db.prepare('UPDATE products SET stock = stock - ?, sales_count = sales_count + ? WHERE id = ?')
        .run(item.quantity, item.quantity, item.product_id);
    }

    // Clear user's cart
    if (req.user) {
      db.prepare('DELETE FROM cart WHERE user_id = ?').run(req.user.id);
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(result.lastInsertRowid);

    res.status(201).json({ ...order, items: orderItems });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Error al crear pedido' });
  }
});

// PUT /api/orders/:id/status — Admin: Update order status
router.put('/:id/status', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { status, payment_status } = req.body;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    if (status) {
      db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(status, req.params.id);
    }

    if (payment_status) {
      db.prepare('UPDATE orders SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(payment_status, req.params.id);
    }

    // If cancelled, restore stock
    if (status === 'cancelado' && order.status !== 'cancelado') {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
      for (const item of items) {
        if (item.product_id) {
          db.prepare('UPDATE products SET stock = stock + ?, sales_count = sales_count - ? WHERE id = ?')
            .run(item.quantity, item.quantity, item.product_id);
        }
      }
    }

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
    res.json({ ...updated, items });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Error al actualizar estado del pedido' });
  }
});

// DELETE /api/orders/:id — Admin: Delete order
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
    db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
    res.json({ message: 'Pedido eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar pedido' });
  }
});

// POST /api/orders/validate-coupon
router.post('/validate-coupon', (req, res) => {
  try {
    const db = getDb();
    const { code, subtotal } = req.body;

    const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(code?.toUpperCase());
    if (!coupon) {
      return res.status(404).json({ error: 'Cupón no válido' });
    }

    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      return res.status(400).json({ error: 'Cupón agotado' });
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Cupón expirado' });
    }

    if (subtotal && subtotal < coupon.min_purchase) {
      return res.status(400).json({ error: `Compra mínima de $${coupon.min_purchase.toLocaleString()}` });
    }

    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = subtotal ? Math.round(subtotal * coupon.discount_value / 100) : 0;
    } else {
      discount = coupon.discount_value;
    }

    res.json({
      valid: true,
      code: coupon.code,
      description: coupon.description,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_amount: discount
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al validar cupón' });
  }
});

module.exports = router;
