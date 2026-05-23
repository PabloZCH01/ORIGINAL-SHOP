const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/categories — Public: list active categories
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const categories = db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) as product_count,
        pc.name as parent_name
      FROM categories c
      LEFT JOIN categories pc ON c.parent_id = pc.id
      WHERE c.active = 1
      ORDER BY c.display_order ASC, c.name ASC
    `).all();

    // Build tree structure
    const tree = [];
    const map = {};

    for (const cat of categories) {
      map[cat.id] = { ...cat, children: [] };
    }

    for (const cat of categories) {
      if (cat.parent_id && map[cat.parent_id]) {
        map[cat.parent_id].children.push(map[cat.id]);
      } else if (!cat.parent_id) {
        tree.push(map[cat.id]);
      }
    }

    res.json({ categories: tree, all: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// GET /api/categories/all — Admin: all categories
router.get('/all', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const categories = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as product_count,
        pc.name as parent_name
      FROM categories c
      LEFT JOIN categories pc ON c.parent_id = pc.id
      ORDER BY c.display_order ASC, c.name ASC
    `).all();

    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// GET /api/categories/:slug
router.get('/:slug', (req, res) => {
  try {
    const db = getDb();
    const category = db.prepare(`
      SELECT c.*, pc.name as parent_name, pc.slug as parent_slug
      FROM categories c
      LEFT JOIN categories pc ON c.parent_id = pc.id
      WHERE c.slug = ? OR c.id = ?
    `).get(req.params.slug, isNaN(req.params.slug) ? -1 : parseInt(req.params.slug));

    if (!category) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    // Get children
    const children = db.prepare(`
      SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) as product_count
      FROM categories c WHERE c.parent_id = ? AND c.active = 1
      ORDER BY c.display_order ASC
    `).all(category.id);

    res.json({ ...category, children });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener categoría' });
  }
});

// POST /api/categories — Admin: Create category
router.post('/', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { name, description, parent_id, display_order, image } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const slug = name.toLowerCase()
      .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
      .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o')
      .replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const existingSlug = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug);
    const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug;

    const result = db.prepare(`
      INSERT INTO categories (name, slug, description, parent_id, display_order, image, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(name, finalSlug, description || '', parent_id || null, display_order || 0, image || '');

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Error al crear categoría' });
  }
});

// PUT /api/categories/:id — Admin: Update category
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);

    if (!category) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    const { name, description, parent_id, display_order, image, active } = req.body;

    db.prepare(`
      UPDATE categories SET
        name = ?, description = ?, parent_id = ?,
        display_order = ?, image = ?, active = ?
      WHERE id = ?
    `).run(
      name ?? category.name,
      description ?? category.description,
      parent_id !== undefined ? (parent_id || null) : category.parent_id,
      display_order ?? category.display_order,
      image ?? category.image,
      active !== undefined ? (active ? 1 : 0) : category.active,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
});

// DELETE /api/categories/:id — Admin: Delete category
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);

    if (!category) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    // Move products to uncategorized
    db.prepare('UPDATE products SET category_id = NULL WHERE category_id = ?').run(req.params.id);
    // Move subcategories to parent level
    db.prepare('UPDATE categories SET parent_id = ? WHERE parent_id = ?').run(category.parent_id, req.params.id);
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);

    res.json({ message: 'Categoría eliminada correctamente' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
});

module.exports = router;
