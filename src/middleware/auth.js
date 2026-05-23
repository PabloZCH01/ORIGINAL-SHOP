const jwt = require('jsonwebtoken');
const { getDb } = require('../database/init');

// Verify JWT token
function authenticate(req, res, next) {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT id, name, email, role, phone, address, city, avatar FROM users WHERE id = ? AND active = 1').get(decoded.id);
    
    if (!user) {
      req.user = null;
      return next();
    }

    req.user = user;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
}

// Require authentication
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Debes iniciar sesión para acceder' });
  }
  next();
}

// Require admin role
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Debes iniciar sesión para acceder' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'No tienes permisos para esta acción' });
  }
  next();
}

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { authenticate, requireAuth, requireAdmin, generateToken };
