const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'tienda.db');

let dbWrapper = null;
let autoSave = true;

// ============ PARAMETER PARSER ============
function parseParams(args) {
  if (!args || args.length === 0) return null;
  if (args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    const named = {};
    for (const [k, v] of Object.entries(args[0])) {
      named['@' + k] = v === undefined ? null : v;
    }
    return named;
  }
  return args.map(v => (v === undefined ? null : v));
}

// ============ DATABASE WRAPPER (compatible con better-sqlite3 API) ============
class Database {
  constructor(rawDb) {
    this.raw = rawDb;
  }

  save() {
    try {
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DB_PATH, Buffer.from(this.raw.export()));
    } catch (e) {
      console.error('[DB] Error guardando:', e.message);
    }
  }

  exec(sql) {
    this.raw.exec(sql);
    if (autoSave) this.save();
  }

  pragma(str) {
    try { this.raw.run('PRAGMA ' + str); } catch (_) {}
  }

  prepare(sql) {
    const db = this;
    return {
      run(...args) {
        const p = parseParams(args);
        if (p !== null) {
          db.raw.run(sql, p);
        } else {
          db.raw.run(sql);
        }
        const changes = db.raw.getRowsModified();
        const r = db.raw.exec('SELECT last_insert_rowid() as id');
        const lastInsertRowid = r.length ? r[0].values[0][0] : 0;
        if (autoSave) db.save();
        return { changes, lastInsertRowid };
      },

      get(...args) {
        const p = parseParams(args);
        const stmt = db.raw.prepare(sql);
        try {
          if (p !== null) stmt.bind(p);
          return stmt.step() ? stmt.getAsObject() : undefined;
        } finally {
          stmt.free();
        }
      },

      all(...args) {
        const p = parseParams(args);
        const stmt = db.raw.prepare(sql);
        const rows = [];
        try {
          if (p !== null) stmt.bind(p);
          while (stmt.step()) rows.push(stmt.getAsObject());
        } finally {
          stmt.free();
        }
        return rows;
      }
    };
  }
}

function getDb() {
  return dbWrapper;
}

async function initDatabase() {
  const SQL = await initSqlJs();

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let rawDb;
  if (fs.existsSync(DB_PATH)) {
    rawDb = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    rawDb = new SQL.Database();
  }

  dbWrapper = new Database(rawDb);
  const db = dbWrapper;

  // Desactivar auto-guardado durante la inicialización
  autoSave = false;

  db.pragma('foreign_keys = ON');

  // ============ CREAR TABLAS ============

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      role TEXT DEFAULT 'customer',
      avatar TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      image TEXT DEFAULT '',
      parent_id INTEGER DEFAULT NULL,
      display_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      price REAL NOT NULL,
      sale_price REAL DEFAULT NULL,
      cost_price REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      sku TEXT DEFAULT '',
      category_id INTEGER,
      brand TEXT DEFAULT '',
      sizes TEXT DEFAULT '[]',
      colors TEXT DEFAULT '[]',
      images TEXT DEFAULT '[]',
      featured INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      views INTEGER DEFAULT 0,
      sales_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT DEFAULT '',
      shipping_address TEXT NOT NULL,
      shipping_city TEXT DEFAULT '',
      subtotal REAL NOT NULL,
      shipping_cost REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL NOT NULL,
      status TEXT DEFAULT 'pendiente',
      payment_method TEXT DEFAULT 'efectivo',
      payment_status TEXT DEFAULT 'pendiente',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      product_image TEXT DEFAULT '',
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      size TEXT DEFAULT '',
      color TEXT DEFAULT '',
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      session_id TEXT,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      size TEXT DEFAULT '',
      color TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subtitle TEXT DEFAULT '',
      image TEXT DEFAULT '',
      link TEXT DEFAULT '',
      button_text TEXT DEFAULT 'Ver mas',
      bg_color TEXT DEFAULT '#1a1a2e',
      text_color TEXT DEFAULT '#ffffff',
      display_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT DEFAULT '',
      setting_type TEXT DEFAULT 'text'
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      discount_type TEXT DEFAULT 'percentage',
      discount_value REAL NOT NULL,
      min_purchase REAL DEFAULT 0,
      max_uses INTEGER DEFAULT NULL,
      used_count INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      expires_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE(user_id, product_id)
    )
  `);

  // Indexes
  db.exec('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_products_active ON products(active)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_cart_user ON cart(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_cart_session ON cart(session_id)');

  // ============ SEED DATA ============
  seedData(db);

  // Reactivar auto-guardado y persistir
  autoSave = true;
  db.save();

  console.log('✅ Base de datos inicializada correctamente');
  return db;
}

function seedData(db) {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount && userCount.count > 0) return;

  console.log('🌱 Insertando datos iniciales...');

  // ---- Admin User ----
  const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Admin123!', 10);
  db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  ).run('Administrador', process.env.ADMIN_EMAIL || 'admin@tiendamoda.com', hashedPassword, 'admin');


  // ---- Categories ----
  const categories = [
    { name: 'Mujer', slug: 'mujer', description: 'Moda femenina', order: 1 },
    { name: 'Hombre', slug: 'hombre', description: 'Moda masculina', order: 2 },
    { name: 'Niños', slug: 'ninos', description: 'Moda infantil', order: 3 },
    { name: 'Accesorios', slug: 'accesorios', description: 'Complementa tu estilo', order: 4 },
    { name: 'Vestidos', slug: 'vestidos', description: 'Vestidos para toda ocasion', order: 1, parent: 1 },
    { name: 'Blusas y Tops', slug: 'blusas-tops', description: 'Blusas y tops elegantes', order: 2, parent: 1 },
    { name: 'Pantalones Mujer', slug: 'pantalones-mujer', description: 'Pantalones femeninos', order: 3, parent: 1 },
    { name: 'Faldas', slug: 'faldas', description: 'Faldas de todos los estilos', order: 4, parent: 1 },
    { name: 'Chaquetas Mujer', slug: 'chaquetas-mujer', description: 'Chaquetas y abrigos', order: 5, parent: 1 },
    { name: 'Camisas', slug: 'camisas', description: 'Camisas formales y casual', order: 1, parent: 2 },
    { name: 'Pantalones Hombre', slug: 'pantalones-hombre', description: 'Pantalones masculinos', order: 2, parent: 2 },
    { name: 'Polos y Camisetas', slug: 'polos-camisetas', description: 'Polos y camisetas', order: 3, parent: 2 },
    { name: 'Chaquetas Hombre', slug: 'chaquetas-hombre', description: 'Chaquetas y blazers', order: 4, parent: 2 },
    { name: 'Ninas', slug: 'ropa-ninas', description: 'Ropa para ninas', order: 1, parent: 3 },
    { name: 'Ninos', slug: 'ropa-ninos', description: 'Ropa para ninos', order: 2, parent: 3 },
    { name: 'Bolsos y Carteras', slug: 'bolsos-carteras', description: 'Bolsos y carteras', order: 1, parent: 4 },
    { name: 'Cinturones', slug: 'cinturones', description: 'Cinturones de cuero y tela', order: 2, parent: 4 },
    { name: 'Bufandas y Panuelos', slug: 'bufandas-panuelos', description: 'Bufandas y panuelos', order: 3, parent: 4 },
  ];

  for (const cat of categories) {
    db.prepare(
      'INSERT INTO categories (name, slug, description, display_order, parent_id, active) VALUES (?, ?, ?, ?, ?, 1)'
    ).run(cat.name, cat.slug, cat.description, cat.order, cat.parent || null);
  }

  // ---- Products ----
  const products = [
    { name: 'Vestido Floral Primavera', slug: 'vestido-floral-primavera', description: 'Hermoso vestido con estampado floral, perfecto para la temporada de primavera. Tela ligera y comoda con corte A.', price: 49990, sale_price: 39990, cost_price: 18000, stock: 45, sku: 'VFP-001', category_id: 5, brand: 'Moda Store', sizes: '["XS","S","M","L","XL"]', colors: '[{"name":"Rosa","hex":"#FF69B4"},{"name":"Azul Cielo","hex":"#87CEEB"},{"name":"Blanco","hex":"#FFFFFF"}]', images: '["https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=400&h=500&fit=crop"]', featured: 1 },
    { name: 'Blusa Elegante de Seda', slug: 'blusa-elegante-seda', description: 'Blusa de seda premium con acabado satinado. Diseno versatil para la oficina o cena elegante.', price: 34990, sale_price: 27990, cost_price: 12000, stock: 60, sku: 'BES-002', category_id: 6, brand: 'Moda Store', sizes: '["XS","S","M","L","XL"]', colors: '[{"name":"Negro","hex":"#000000"},{"name":"Blanco","hex":"#FFFFFF"},{"name":"Vino","hex":"#722F37"}]', images: '["https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1551803091-e20673f15770?w=400&h=500&fit=crop"]', featured: 1 },
    { name: 'Jeans Slim Fit Premium', slug: 'jeans-slim-fit-premium', description: 'Jeans de mezclilla premium con corte slim fit. Tela stretch de alta calidad.', price: 39990, sale_price: null, cost_price: 15000, stock: 80, sku: 'JSF-003', category_id: 7, brand: 'Denim Co.', sizes: '["26","28","30","32","34","36"]', colors: '[{"name":"Azul Medio","hex":"#4169E1"},{"name":"Azul Oscuro","hex":"#191970"},{"name":"Negro","hex":"#000000"}]', images: '["https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&h=500&fit=crop"]', featured: 1 },
    { name: 'Camisa Oxford Clasica', slug: 'camisa-oxford-clasica', description: 'Camisa Oxford de algodon 100% con boton en el cuello. Corte regular fit.', price: 29990, sale_price: 24990, cost_price: 10000, stock: 70, sku: 'COC-004', category_id: 10, brand: 'Classic Wear', sizes: '["S","M","L","XL","XXL"]', colors: '[{"name":"Blanco","hex":"#FFFFFF"},{"name":"Celeste","hex":"#B0E0E6"},{"name":"Rosa","hex":"#FFB6C1"}]', images: '["https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1598033129183-c4f50c736c10?w=400&h=500&fit=crop"]', featured: 1 },
    { name: 'Chaqueta de Cuero Biker', slug: 'chaqueta-cuero-biker', description: 'Chaqueta estilo biker en cuero sintetico de alta calidad. Cierre diagonal con cremallera metalica.', price: 89990, sale_price: 69990, cost_price: 35000, stock: 25, sku: 'CCB-005', category_id: 9, brand: 'Urban Style', sizes: '["S","M","L","XL"]', colors: '[{"name":"Negro","hex":"#000000"},{"name":"Marron","hex":"#8B4513"}]', images: '["https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1520975954732-35dd22299614?w=400&h=500&fit=crop"]', featured: 1 },
    { name: 'Falda Midi Plisada', slug: 'falda-midi-plisada', description: 'Falda midi plisada con cintura elastica. Tela fluida con caida elegante.', price: 32990, sale_price: null, cost_price: 12000, stock: 40, sku: 'FMP-006', category_id: 8, brand: 'Moda Store', sizes: '["XS","S","M","L","XL"]', colors: '[{"name":"Negro","hex":"#000000"},{"name":"Verde Militar","hex":"#4B5320"},{"name":"Beige","hex":"#F5F5DC"}]', images: '["https://images.unsplash.com/photo-1583496661160-fb5886a0uj49?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1590159983013-d4ff5fc71c1d?w=400&h=500&fit=crop"]', featured: 1 },
    { name: 'Polo Basico Algodon', slug: 'polo-basico-algodon', description: 'Polo de algodon peinado 100% con cuello redondo. Basico esencial.', price: 14990, sale_price: 9990, cost_price: 4000, stock: 150, sku: 'PBA-007', category_id: 12, brand: 'Basic Co.', sizes: '["S","M","L","XL","XXL"]', colors: '[{"name":"Blanco","hex":"#FFFFFF"},{"name":"Negro","hex":"#000000"},{"name":"Gris","hex":"#808080"},{"name":"Azul Marino","hex":"#000080"}]', images: '["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400&h=500&fit=crop"]', featured: 0 },
    { name: 'Vestido Cocktail Negro', slug: 'vestido-cocktail-negro', description: 'Vestido cocktail en color negro con escote corazon. Perfecto para fiestas.', price: 64990, sale_price: 54990, cost_price: 25000, stock: 30, sku: 'VCN-008', category_id: 5, brand: 'Moda Store', sizes: '["XS","S","M","L"]', colors: '[{"name":"Negro","hex":"#000000"},{"name":"Rojo","hex":"#DC143C"}]', images: '["https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=500&fit=crop"]', featured: 1 },
    { name: 'Pantalon Chino Slim', slug: 'pantalon-chino-slim', description: 'Pantalon chino con corte slim en algodon stretch. Look casual elegante.', price: 34990, sale_price: null, cost_price: 13000, stock: 55, sku: 'PCS-009', category_id: 11, brand: 'Classic Wear', sizes: '["28","30","32","34","36","38"]', colors: '[{"name":"Beige","hex":"#F5F5DC"},{"name":"Azul Marino","hex":"#000080"},{"name":"Verde Oliva","hex":"#556B2F"}]', images: '["https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400&h=500&fit=crop"]', featured: 0 },
    { name: 'Blazer Oversize Mujer', slug: 'blazer-oversize-mujer', description: 'Blazer oversize con hombreras estructuradas. Corte relajado y moderno.', price: 59990, sale_price: 49990, cost_price: 22000, stock: 35, sku: 'BOM-010', category_id: 9, brand: 'Urban Style', sizes: '["S","M","L","XL"]', colors: '[{"name":"Negro","hex":"#000000"},{"name":"Gris","hex":"#808080"},{"name":"Camel","hex":"#C19A6B"}]', images: '["https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=500&fit=crop"]', featured: 1 },
    { name: 'Top Crop Deportivo', slug: 'top-crop-deportivo', description: 'Top crop con diseno deportivo y tela transpirable.', price: 16990, sale_price: 12990, cost_price: 5000, stock: 90, sku: 'TCD-011', category_id: 6, brand: 'Active Wear', sizes: '["XS","S","M","L"]', colors: '[{"name":"Negro","hex":"#000000"},{"name":"Blanco","hex":"#FFFFFF"},{"name":"Rosa","hex":"#FF69B4"},{"name":"Lila","hex":"#C8A2C8"}]', images: '["https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=400&h=500&fit=crop"]', featured: 0 },
    { name: 'Conjunto Nina Floral', slug: 'conjunto-nina-floral', description: 'Conjunto de dos piezas para nina: blusa floral y pantalon corto.', price: 22990, sale_price: 18990, cost_price: 8000, stock: 40, sku: 'CNF-012', category_id: 14, brand: 'Kids Fashion', sizes: '["2 anos","4 anos","6 anos","8 anos","10 anos"]', colors: '[{"name":"Rosa","hex":"#FFB6C1"},{"name":"Amarillo","hex":"#FFD700"}]', images: '["https://images.unsplash.com/photo-1543854589-fba8281d72b8?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=400&h=500&fit=crop"]', featured: 0 },
    { name: 'Polera Estampada Nino', slug: 'polera-estampada-nino', description: 'Polera de algodon con estampado divertido para nino.', price: 12990, sale_price: null, cost_price: 4000, stock: 60, sku: 'PEN-013', category_id: 15, brand: 'Kids Fashion', sizes: '["2 anos","4 anos","6 anos","8 anos","10 anos","12 anos"]', colors: '[{"name":"Azul","hex":"#4169E1"},{"name":"Rojo","hex":"#DC143C"},{"name":"Verde","hex":"#32CD32"}]', images: '["https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=400&h=500&fit=crop"]', featured: 0 },
    { name: 'Bolso Tote Cuero', slug: 'bolso-tote-cuero', description: 'Bolso tote de cuero sintetico premium. Amplio interior con bolsillos.', price: 44990, sale_price: 37990, cost_price: 16000, stock: 30, sku: 'BTC-014', category_id: 16, brand: 'Moda Store', sizes: '["Unico"]', colors: '[{"name":"Negro","hex":"#000000"},{"name":"Camel","hex":"#C19A6B"},{"name":"Rojo","hex":"#DC143C"}]', images: '["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&h=500&fit=crop"]', featured: 1 },
    { name: 'Cinturon Cuero Italiano', slug: 'cinturon-cuero-italiano', description: 'Cinturon de cuero genuino con hebilla metalica cepillada.', price: 19990, sale_price: null, cost_price: 7000, stock: 50, sku: 'CCI-015', category_id: 17, brand: 'Classic Wear', sizes: '["85cm","90cm","95cm","100cm","105cm"]', colors: '[{"name":"Negro","hex":"#000000"},{"name":"Marron","hex":"#8B4513"}]', images: '["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=400&h=500&fit=crop"]', featured: 0 },
    { name: 'Bufanda Cashmere Premium', slug: 'bufanda-cashmere-premium', description: 'Bufanda de cashmere blend ultra suave para dias frios.', price: 27990, sale_price: 22990, cost_price: 9000, stock: 35, sku: 'BCP-016', category_id: 18, brand: 'Moda Store', sizes: '["Unico"]', colors: '[{"name":"Gris","hex":"#808080"},{"name":"Beige","hex":"#F5F5DC"},{"name":"Azul Marino","hex":"#000080"},{"name":"Burdeo","hex":"#800020"}]', images: '["https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1601924921557-45e8e0f5e684?w=400&h=500&fit=crop"]', featured: 0 },
    { name: 'Vestido Maxi Bohemio', slug: 'vestido-maxi-bohemio', description: 'Vestido largo estilo bohemio con estampado etnico.', price: 44990, sale_price: 37990, cost_price: 16000, stock: 30, sku: 'VMB-017', category_id: 5, brand: 'Boho Chic', sizes: '["S","M","L","XL"]', colors: '[{"name":"Terracota","hex":"#E2725B"},{"name":"Azul Indigo","hex":"#4B0082"}]', images: '["https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=500&fit=crop"]', featured: 0 },
    { name: 'Hoodie Urban Street', slug: 'hoodie-urban-street', description: 'Hoodie oversize de algodon french terry. Estilo streetwear urbano.', price: 39990, sale_price: 32990, cost_price: 14000, stock: 50, sku: 'HUS-018', category_id: 12, brand: 'Urban Style', sizes: '["S","M","L","XL","XXL"]', colors: '[{"name":"Negro","hex":"#000000"},{"name":"Gris Melange","hex":"#C0C0C0"},{"name":"Verde Bosque","hex":"#228B22"}]', images: '["https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1578768079470-0a4536e2d7e2?w=400&h=500&fit=crop"]', featured: 1 },
    { name: 'Pantalon Palazzo Mujer', slug: 'pantalon-palazzo-mujer', description: 'Pantalon palazzo de tiro alto con pierna ancha. Tela fluida.', price: 36990, sale_price: null, cost_price: 13000, stock: 40, sku: 'PPM-019', category_id: 7, brand: 'Moda Store', sizes: '["XS","S","M","L","XL"]', colors: '[{"name":"Negro","hex":"#000000"},{"name":"Blanco","hex":"#FFFFFF"},{"name":"Terracota","hex":"#E2725B"}]', images: '["https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400&h=500&fit=crop"]', featured: 0 },
    { name: 'Camisa Hawaiana Tropical', slug: 'camisa-hawaiana-tropical', description: 'Camisa de manga corta con estampado tropical vibrante.', price: 24990, sale_price: 19990, cost_price: 8000, stock: 45, sku: 'CHT-020', category_id: 10, brand: 'Summer Vibes', sizes: '["S","M","L","XL","XXL"]', colors: '[{"name":"Azul Tropical","hex":"#00CED1"},{"name":"Coral","hex":"#FF7F50"}]', images: '["https://images.unsplash.com/photo-1590271068338-230b55e1cca8?w=400&h=500&fit=crop","https://images.unsplash.com/photo-1608063615781-e2ef8c73d114?w=400&h=500&fit=crop"]', featured: 0 },
  ];

  for (const p of products) {
    db.prepare(
      'INSERT INTO products (name, slug, description, price, sale_price, cost_price, stock, sku, category_id, brand, sizes, colors, images, featured, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)'
    ).run(p.name, p.slug, p.description, p.price, p.sale_price, p.cost_price, p.stock, p.sku, p.category_id, p.brand, p.sizes, p.colors, p.images, p.featured);
  }

  // ---- Brands ----
  const brandsSet = new Set(products.map(p => p.brand).filter(Boolean));
  for (const b of brandsSet) {
    db.prepare('INSERT INTO brands (name) VALUES (?)').run(b);
  }

  // ---- Banners ----
  const banners = [
    { title: 'NUEVA COLECCION', subtitle: 'Descubre las ultimas tendencias con hasta 40% de descuento', button_text: 'Comprar Ahora', link: '#/productos', bg_color: '#1a1a2e', display_order: 1 },
    { title: 'MODA MUJER', subtitle: 'Vestidos, blusas y mas. Todo lo que necesitas para brillar', button_text: 'Ver Coleccion', link: '#/categoria/mujer', bg_color: '#e94560', display_order: 2 },
    { title: 'OFERTAS ESPECIALES', subtitle: 'Hasta 50% de descuento en productos seleccionados', button_text: 'Ver Ofertas', link: '#/ofertas', bg_color: '#00b894', display_order: 3 },
  ];

  for (const b of banners) {
    db.prepare(
      'INSERT INTO banners (title, subtitle, button_text, link, bg_color, display_order, active) VALUES (?, ?, ?, ?, ?, ?, 1)'
    ).run(b.title, b.subtitle, b.button_text, b.link, b.bg_color, b.display_order);
  }

  // ---- Settings ----
  const settings = [
    { key: 'store_name', value: 'MODA STORE', type: 'text' },
    { key: 'store_description', value: 'Tu tienda de moda online', type: 'text' },
    { key: 'store_email', value: 'contacto@tiendamoda.com', type: 'text' },
    { key: 'store_phone', value: '+56 9 8765 4321', type: 'text' },
    { key: 'store_address', value: 'Av. Providencia 1234, Santiago', type: 'text' },
    { key: 'store_currency', value: '$', type: 'text' },
    { key: 'store_tax_rate', value: '19', type: 'number' },
    { key: 'shipping_cost', value: '3990', type: 'number' },
    { key: 'free_shipping_min', value: '50000', type: 'number' },
    { key: 'instagram', value: 'https://instagram.com/modastore', type: 'text' },
    { key: 'facebook', value: 'https://facebook.com/modastore', type: 'text' },
    { key: 'whatsapp', value: '+56987654321', type: 'text' },
    { key: 'whatsapp_number', value: '+56987654321', type: 'text' },
    { key: 'whatsapp_enabled', value: '1', type: 'text' },
    { key: 'whatsapp_float_enabled', value: '1', type: 'text' },
    { key: 'whatsapp_float_position', value: 'right', type: 'text' },
    { key: 'whatsapp_greeting', value: '¡Hola! 👋 Bienvenido a *MODA STORE*. ¿En qué podemos ayudarte hoy?', type: 'text' },
    { key: 'whatsapp_order_message', value: '🛍️ *NUEVO PEDIDO - MODA STORE*\n\n📋 *Pedido:* {{order_number}}\n👤 *Cliente:* {{customer_name}}\n📞 *Teléfono:* {{customer_phone}}\n📍 *Dirección:* {{shipping_address}}, {{shipping_city}}\n\n📦 *Productos:*\n{{items}}\n\n💰 *Subtotal:* {{subtotal}}\n🚚 *Envío:* {{shipping}}\n✅ *TOTAL: {{total}}*\n\n💳 *Pago:* {{payment_method}}', type: 'text' },
    { key: 'whatsapp_messages', value: JSON.stringify([{"id":1,"text":"Hola, me gustaría obtener información sobre sus productos 👗","label":"Consulta de productos"},{"id":2,"text":"¿Cuáles son los métodos de pago disponibles? 💳","label":"Métodos de pago"},{"id":3,"text":"¿Realizan envíos a todo el país? 🚚","label":"Información de envíos"},{"id":4,"text":"Tengo un problema con mi pedido, ¿me pueden ayudar? 📦","label":"Soporte de pedidos"},{"id":5,"text":"¿Tienen disponibilidad de tallas especiales? 📏","label":"Tallas disponibles"}]), type: 'text' },
  ];

  for (const s of settings) {
    db.prepare(
      'INSERT INTO settings (setting_key, setting_value, setting_type) VALUES (?, ?, ?)'
    ).run(s.key, s.value, s.type);
  }

  // ---- Sample Orders ----
  db.prepare('INSERT INTO orders (order_number, user_id, customer_name, customer_email, customer_phone, shipping_address, shipping_city, subtotal, shipping_cost, tax, discount, total, status, payment_method, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('ORD-2026-0001', 2, 'Maria Garcia', 'maria@email.com', '+56 9 1234 5678', 'Av. Principal 123, Santiago', 'Santiago', 67980, 3990, 0, 0, 71970, 'entregado', 'tarjeta', 'pagado');
  db.prepare('INSERT INTO orders (order_number, user_id, customer_name, customer_email, customer_phone, shipping_address, shipping_city, subtotal, shipping_cost, tax, discount, total, status, payment_method, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('ORD-2026-0002', 2, 'Maria Garcia', 'maria@email.com', '+56 9 1234 5678', 'Av. Principal 123, Santiago', 'Santiago', 39990, 3990, 0, 0, 43980, 'enviado', 'transferencia', 'pagado');
  db.prepare('INSERT INTO orders (order_number, user_id, customer_name, customer_email, customer_phone, shipping_address, shipping_city, subtotal, shipping_cost, tax, discount, total, status, payment_method, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('ORD-2026-0003', 2, 'Maria Garcia', 'maria@email.com', '+56 9 1234 5678', 'Av. Principal 123, Santiago', 'Santiago', 89990, 0, 0, 5000, 84990, 'pendiente', 'efectivo', 'pendiente');

  // Order items
  db.prepare('INSERT INTO order_items (order_id, product_id, product_name, quantity, price, size, color) VALUES (?, ?, ?, ?, ?, ?, ?)').run(1, 1, 'Vestido Floral Primavera', 1, 39990, 'M', 'Rosa');
  db.prepare('INSERT INTO order_items (order_id, product_id, product_name, quantity, price, size, color) VALUES (?, ?, ?, ?, ?, ?, ?)').run(1, 2, 'Blusa Elegante de Seda', 1, 27990, 'S', 'Negro');
  db.prepare('INSERT INTO order_items (order_id, product_id, product_name, quantity, price, size, color) VALUES (?, ?, ?, ?, ?, ?, ?)').run(2, 3, 'Jeans Slim Fit Premium', 1, 39990, '30', 'Azul Medio');
  db.prepare('INSERT INTO order_items (order_id, product_id, product_name, quantity, price, size, color) VALUES (?, ?, ?, ?, ?, ?, ?)').run(3, 5, 'Chaqueta de Cuero Biker', 1, 69990, 'M', 'Negro');
  db.prepare('INSERT INTO order_items (order_id, product_id, product_name, quantity, price, size, color) VALUES (?, ?, ?, ?, ?, ?, ?)').run(3, 7, 'Polo Basico Algodon', 2, 9990, 'L', 'Blanco');

  // ---- Coupons ----
  db.prepare('INSERT INTO coupons (code, description, discount_type, discount_value, min_purchase, max_uses, active) VALUES (?, ?, ?, ?, ?, ?, 1)').run('BIENVENIDO10', '10% de descuento en tu primera compra', 'percentage', 10, 20000, 100);
  db.prepare('INSERT INTO coupons (code, description, discount_type, discount_value, min_purchase, max_uses, active) VALUES (?, ?, ?, ?, ?, ?, 1)').run('ENVIOGRATIS', 'Envio gratis en tu compra', 'fixed', 3990, 30000, 50);
  db.prepare('INSERT INTO coupons (code, description, discount_type, discount_value, min_purchase, max_uses, active) VALUES (?, ?, ?, ?, ?, ?, 1)').run('MODA20', '20% de descuento en toda la tienda', 'percentage', 20, 40000, 30);

  console.log('✅ Datos iniciales insertados correctamente');
}

module.exports = { getDb, initDatabase };
