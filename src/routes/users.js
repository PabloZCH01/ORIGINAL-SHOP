const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const { authenticate, requireAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// GET /api/users - List system users (staff)
router.get('/', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { search = '' } = req.query;

    let where = ["role IN ('admin', 'editor', 'viewer')"];
    let params = [];

    if (search) {
      where.push('(name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = where.join(' AND ');
    
    const users = db.prepare(`
      SELECT id, name, email, phone, role, active, created_at 
      FROM users 
      WHERE ${whereClause}
      ORDER BY created_at DESC
    `).all(...params);

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// GET /api/users/:id - Get specific user
router.get('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare(`
      SELECT id, name, email, phone, role, active, created_at 
      FROM users WHERE id = ?
    `).get(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// POST /api/users - Create new user
router.post('/', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // Check email exists
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (exists) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = db.prepare(`
      INSERT INTO users (name, email, password, role, phone, active) 
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(name, email, hashedPassword, role, phone || '');

    res.status(201).json({ 
      id: result.lastInsertRowid, 
      message: 'Usuario creado exitosamente' 
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { name, email, password, role, phone, active } = req.body;
    const userId = req.params.id;

    // Check user exists
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Check email uniqueness if changed
    if (email) {
      const emailExists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
      if (emailExists) {
        return res.status(400).json({ error: 'El correo ya está registrado por otro usuario' });
      }
    }

    // Build update dynamic query
    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name); }
    if (email) { updates.push('email = ?'); params.push(email); }
    if (password) { updates.push('password = ?'); params.push(bcrypt.hashSync(password, 10)); }
    if (role) { updates.push('role = ?'); params.push(role); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(userId);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    res.json({ message: 'Usuario actualizado exitosamente' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    
    // Prevent deleting self
    if (parseInt(req.params.id) === parseInt(req.user.id)) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    }

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;
