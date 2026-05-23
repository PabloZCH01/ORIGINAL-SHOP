const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/brands/all (Public)
router.get('/all', (req, res) => {
  try {
    const db = getDb();
    const brands = db.prepare('SELECT * FROM brands ORDER BY name ASC').all();
    res.json({ data: brands });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener marcas' });
  }
});

// POST /api/brands
router.post('/', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, active } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

    const db = getDb();
    const result = db.prepare('INSERT INTO brands (name, active) VALUES (?, ?)').run(name, active !== undefined ? active : 1);
    res.json({ message: 'Marca creada', data: { id: result.lastInsertRowid } });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'La marca ya existe' });
    }
    res.status(500).json({ error: 'Error al crear marca' });
  }
});

// PUT /api/brands/:id
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, active } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

    const db = getDb();
    db.prepare('UPDATE brands SET name = ?, active = ? WHERE id = ?').run(name, active !== undefined ? active : 1, req.params.id);
    res.json({ message: 'Marca actualizada' });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'La marca ya existe' });
    }
    res.status(500).json({ error: 'Error al actualizar marca' });
  }
});

// DELETE /api/brands/:id
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM brands WHERE id = ?').run(req.params.id);
    res.json({ message: 'Marca eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar marca' });
  }
});

module.exports = router;
