const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const { authenticate, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

// GET /api/products — List products with filters & pagination
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const {
      page = 1,
      limit = 12,
      category,
      brand,
      sort = 'newest',
      search,
      featured,
      min_price,
      max_price,
      on_sale
    } = req.query;

    let where = ['p.active = 1'];
    let params = [];

    if (category) {
      // Also include subcategories
      where.push('(p.category_id = ? OR p.category_id IN (SELECT id FROM categories WHERE parent_id = (SELECT id FROM categories WHERE slug = ?)))');
      params.push(category, category);
      // Also try by slug
      where.push('OR p.category_id = (SELECT id FROM categories WHERE slug = ?)');
      // Rebuild the where clause properly
      where = ['p.active = 1'];
      where.push(`(p.category_id = ? OR p.category_id IN (SELECT id FROM categories WHERE slug = ?) OR p.category_id IN (SELECT id FROM categories WHERE parent_id = (SELECT id FROM categories WHERE slug = ?)))`);
      params = [category, category, category];
    }

    if (brand) {
      where.push('p.brand = ?');
      params.push(brand);
    }

    if (search) {
      where.push('(p.name LIKE ? OR p.description LIKE ? OR p.brand LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (featured === '1' || featured === 'true') {
      where.push('p.featured = 1');
    }

    if (min_price) {
      where.push('COALESCE(p.sale_price, p.price) >= ?');
      params.push(parseFloat(min_price));
    }

    if (max_price) {
      where.push('COALESCE(p.sale_price, p.price) <= ?');
      params.push(parseFloat(max_price));
    }

    if (on_sale === '1' || on_sale === 'true') {
      where.push('p.sale_price IS NOT NULL AND p.sale_price < p.price');
    }

    let orderBy = 'p.created_at DESC';
    switch (sort) {
      case 'price_asc': orderBy = 'COALESCE(p.sale_price, p.price) ASC'; break;
      case 'price_desc': orderBy = 'COALESCE(p.sale_price, p.price) DESC'; break;
      case 'name_asc': orderBy = 'p.name ASC'; break;
      case 'name_desc': orderBy = 'p.name DESC'; break;
      case 'popular': orderBy = 'p.sales_count DESC'; break;
      case 'newest': default: orderBy = 'p.created_at DESC'; break;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = where.join(' AND ');

    const countQuery = `SELECT COUNT(*) as total FROM products p WHERE ${whereClause}`;
    const { total } = db.prepare(countQuery).get(...params);

    const query = `
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const products = db.prepare(query).all(...params, parseInt(limit), offset);

    // Parse JSON fields
    const parsed = products.map(p => ({
      ...p,
      sizes: JSON.parse(p.sizes || '[]'),
      colors: JSON.parse(p.colors || '[]'),
      images: JSON.parse(p.images || '[]')
    }));

    res.json({
      products: parsed,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// GET /api/products/brands — Get all brands
router.get('/brands', (req, res) => {
  try {
    const db = getDb();
    const brands = db.prepare('SELECT DISTINCT brand FROM products WHERE active = 1 AND brand != "" ORDER BY brand').all();
    res.json(brands.map(b => b.brand));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener marcas' });
  }
});

// GET /api/products/all — Admin: all products
router.get('/all', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { search, category, status } = req.query;
    let where = ['1=1'];
    let params = [];

    if (search) {
      where.push('(p.name LIKE ? OR p.sku LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      where.push('p.category_id = ?');
      params.push(parseInt(category));
    }
    if (status === 'active') where.push('p.active = 1');
    if (status === 'inactive') where.push('p.active = 0');

    const products = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${where.join(' AND ')}
      ORDER BY p.created_at DESC
    `).all(...params);

    const parsed = products.map(p => ({
      ...p,
      sizes: JSON.parse(p.sizes || '[]'),
      colors: JSON.parse(p.colors || '[]'),
      images: JSON.parse(p.images || '[]')
    }));

    res.json(parsed);
  } catch (error) {
    console.error('Get all products error:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const product = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Increment views
    db.prepare('UPDATE products SET views = views + 1 WHERE id = ?').run(req.params.id);

    // Get related products
    const related = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.category_id = ? AND p.id != ? AND p.active = 1
      ORDER BY RANDOM()
      LIMIT 4
    `).all(product.category_id, product.id);

    res.json({
      ...product,
      sizes: JSON.parse(product.sizes || '[]'),
      colors: JSON.parse(product.colors || '[]'),
      images: JSON.parse(product.images || '[]'),
      related: related.map(r => ({
        ...r,
        sizes: JSON.parse(r.sizes || '[]'),
        colors: JSON.parse(r.colors || '[]'),
        images: JSON.parse(r.images || '[]')
      }))
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

// POST /api/products — Admin: Create product
router.post('/', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const {
      name, description, price, sale_price, cost_price,
      stock, sku, category_id, brand, sizes, colors, featured
    } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Nombre y precio son obligatorios' });
    }

    const slug = name.toLowerCase()
      .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
      .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o')
      .replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      + '-' + Date.now().toString(36);

    const result = db.prepare(`
      INSERT INTO products (name, slug, description, price, sale_price, cost_price, stock, sku, category_id, brand, sizes, colors, images, featured, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, 1)
    `).run(
      name, slug, description || '', parseFloat(price),
      sale_price ? parseFloat(sale_price) : null,
      cost_price ? parseFloat(cost_price) : 0,
      parseInt(stock) || 0, sku || '',
      category_id ? parseInt(category_id) : null,
      brand || '',
      JSON.stringify(sizes || []),
      JSON.stringify(colors || []),
      featured ? 1 : 0
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({
      ...product,
      sizes: JSON.parse(product.sizes || '[]'),
      colors: JSON.parse(product.colors || '[]'),
      images: JSON.parse(product.images || '[]')
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// PUT /api/products/:id — Admin: Update product
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const {
      name, description, price, sale_price, cost_price,
      stock, sku, category_id, brand, sizes, colors, featured, active
    } = req.body;

    db.prepare(`
      UPDATE products SET
        name = ?, description = ?, price = ?, sale_price = ?, cost_price = ?,
        stock = ?, sku = ?, category_id = ?, brand = ?,
        sizes = ?, colors = ?, featured = ?, active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ?? product.name,
      description ?? product.description,
      price !== undefined ? parseFloat(price) : product.price,
      sale_price !== undefined ? (sale_price ? parseFloat(sale_price) : null) : product.sale_price,
      cost_price !== undefined ? parseFloat(cost_price) : product.cost_price,
      stock !== undefined ? parseInt(stock) : product.stock,
      sku ?? product.sku,
      category_id !== undefined ? (category_id ? parseInt(category_id) : null) : product.category_id,
      brand ?? product.brand,
      sizes ? JSON.stringify(sizes) : product.sizes,
      colors ? JSON.stringify(colors) : product.colors,
      featured !== undefined ? (featured ? 1 : 0) : product.featured,
      active !== undefined ? (active ? 1 : 0) : product.active,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json({
      ...updated,
      sizes: JSON.parse(updated.sizes || '[]'),
      colors: JSON.parse(updated.colors || '[]'),
      images: JSON.parse(updated.images || '[]')
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

// POST /api/products/:id/images — Admin: Upload images
router.post('/:id/images', authenticate, requireAdmin, upload.array('images', 5), (req, res) => {
  try {
    const db = getDb();
    const product = db.prepare('SELECT images FROM products WHERE id = ?').get(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const currentImages = JSON.parse(product.images || '[]');
    const newImages = req.files.map(f => `/uploads/${f.filename}`);
    const allImages = [...currentImages, ...newImages];

    db.prepare('UPDATE products SET images = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(JSON.stringify(allImages), req.params.id);

    res.json({ images: allImages });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({ error: 'Error al subir imágenes' });
  }
});

// DELETE /api/products/:id/images/:index — Admin: Remove image
router.delete('/:id/images/:index', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const product = db.prepare('SELECT images FROM products WHERE id = ?').get(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const images = JSON.parse(product.images || '[]');
    const index = parseInt(req.params.index);

    if (index >= 0 && index < images.length) {
      // Delete file
      const filePath = path.join(__dirname, '..', '..', 'public', images[index]);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      images.splice(index, 1);
      db.prepare('UPDATE products SET images = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(JSON.stringify(images), req.params.id);
    }

    res.json({ images });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Error al eliminar imagen' });
  }
});

// DELETE /api/products/:id — Admin: Delete product
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Delete product images
    const images = JSON.parse(product.images || '[]');
    for (const img of images) {
      const filePath = path.join(__dirname, '..', '..', 'uploads', path.basename(img));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    db.prepare('DELETE FROM cart WHERE product_id = ?').run(req.params.id);
    db.prepare('DELETE FROM wishlist WHERE product_id = ?').run(req.params.id);
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);

    res.json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

module.exports = router;
