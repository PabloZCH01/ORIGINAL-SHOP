const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/whatsapp/config — Public: get whatsapp config for store
router.get('/config', (req, res) => {
  try {
    const db = getDb();
    const keys = [
      'whatsapp_number', 'whatsapp_enabled', 'whatsapp_greeting',
      'whatsapp_order_message', 'whatsapp_float_enabled', 'whatsapp_float_position',
      'whatsapp_messages'
    ];
    const rows = db.prepare(
      `SELECT setting_key, setting_value FROM settings WHERE setting_key IN (${keys.map(() => '?').join(',')})`
    ).all(...keys);

    const config = {};
    for (const r of rows) config[r.setting_key] = r.setting_value;

    // Parse messages JSON
    try { config.whatsapp_messages = JSON.parse(config.whatsapp_messages || '[]'); } catch { config.whatsapp_messages = []; }

    res.json({ ok: true, data: config });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener configuración de WhatsApp' });
  }
});

// GET /api/whatsapp/settings — Admin: full settings
router.get('/settings', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'whatsapp%'").all();
    const config = {};
    for (const r of rows) config[r.setting_key] = r.setting_value;
    try { config.whatsapp_messages = JSON.parse(config.whatsapp_messages || '[]'); } catch { config.whatsapp_messages = []; }
    res.json({ ok: true, data: config });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener configuración de WhatsApp' });
  }
});

// PUT /api/whatsapp/settings — Admin: save settings
router.put('/settings', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { whatsapp_number, whatsapp_enabled, whatsapp_greeting, whatsapp_order_message,
            whatsapp_float_enabled, whatsapp_float_position, whatsapp_messages } = req.body;

    const upsert = db.prepare(`
      INSERT INTO settings (setting_key, setting_value, setting_type) VALUES (?, ?, 'text')
      ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value
    `);

    upsert.run('whatsapp_number', whatsapp_number || '');
    upsert.run('whatsapp_enabled', whatsapp_enabled ? '1' : '0');
    upsert.run('whatsapp_greeting', whatsapp_greeting || '');
    upsert.run('whatsapp_order_message', whatsapp_order_message || '');
    upsert.run('whatsapp_float_enabled', whatsapp_float_enabled ? '1' : '0');
    upsert.run('whatsapp_float_position', whatsapp_float_position || 'right');
    upsert.run('whatsapp_messages', JSON.stringify(whatsapp_messages || []));

    res.json({ ok: true, message: 'Configuración de WhatsApp guardada' });
  } catch (error) {
    console.error('WhatsApp settings error:', error);
    res.status(500).json({ error: 'Error al guardar configuración de WhatsApp' });
  }
});

module.exports = router;
