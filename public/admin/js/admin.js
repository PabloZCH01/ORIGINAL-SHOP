/* ============================================
   MODA STORE - Admin Panel JavaScript
   ============================================ */

const Admin = {
  currentPage: 'dashboard',
  token: null,
  user: null,

  // ============ INIT ============
  init: async function() {
    this.token = localStorage.getItem('token');
    if (!this.token) { this.showLogin(); return; }
    try {
      const res = await this.api('/api/auth/me');
      if (!res.ok) throw new Error();
      this.user = res.data;
      if (this.user.role !== 'admin') { this.showLogin('Acceso denegado. Solo administradores.'); return; }
      document.getElementById('adminApp').style.display = '';
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('adminName').textContent = this.user.name;
      document.getElementById('userAvatar').textContent = this.user.name.charAt(0).toUpperCase();
    } catch { localStorage.removeItem('token'); this.showLogin(); return; }

    this.bindEvents();
    this.navigate('dashboard');
  },

  showLogin: function(errorMsg = '') {
    document.getElementById('adminApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    const errEl = document.getElementById('loginError');
    if (errEl) errEl.textContent = errorMsg;
    // bind login form
    const form = document.getElementById('adminLoginForm');
    if (form && !form._bound) {
      form._bound = true;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = form.email.value.trim();
        const password = form.password.value;
        const errEl = document.getElementById('loginError');
        errEl.textContent = '';
        if (!email || !password) { errEl.textContent = 'Completa todos los campos'; return; }
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = 'Ingresando...';
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();
          if (res.ok && (data.token || (data.data && data.data.token))) {
            localStorage.setItem('token', data.token || data.data.token);
            location.reload();
          } else {
            errEl.textContent = data.error || data.message || 'Credenciales incorrectas';
          }
        } catch {
          errEl.textContent = 'Error de conexión con el servidor';
        }
        btn.disabled = false; btn.textContent = 'Iniciar Sesión';
      });
    }
  },

  bindEvents: function() {
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.addEventListener('click', () => this.navigate(el.dataset.page));
    });
    document.getElementById('adminLogout').addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      window.location.href = '/';
    });
    document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeModal();
    });
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });
  },

  navigate: function(page) {
    this.currentPage = page;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) navItem.classList.add('active');

    const titles = {
      dashboard: 'Dashboard', products: 'Productos', categories: 'Categorías', brands: 'Marcas',
      orders: 'Pedidos', users: 'Usuarios', banners: 'Banners',
      coupons: 'Cupones', footer: 'Pie de Página', whatsapp: 'WhatsApp', settings: 'Ajustes'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;
    document.getElementById('sidebar').classList.remove('open');

    const loaders = {
      dashboard: () => this.loadDashboard(),
      products: () => this.loadProducts(),
      categories: () => this.loadCategories(),
      brands: () => this.loadBrands(),
      orders: () => this.loadOrders(),
      users: () => this.loadUsers(),
      banners: () => this.loadBanners(),
      coupons: () => this.loadCoupons(),
      footer: () => this.loadFooterSettings(),
      whatsapp: () => this.loadWhatsApp(),
      settings: () => this.loadSettings()
    };
    if (loaders[page]) loaders[page]();
  },

  // ============ API HELPER ============
  api: async function(url, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    try {
      const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
      const data = await res.json();
      const payload = data.data !== undefined ? data.data : (data.user !== undefined ? data.user : data);
      return { ok: res.ok, status: res.status, data: payload, message: data.message || data.error };
    } catch (err) {
      return { ok: false, message: 'Error de conexión' };
    }
  },

  apiForm: async function(url, formData, method = 'POST') {
    const headers = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    try {
      const res = await fetch(url, { method, headers, body: formData });
      const data = await res.json();
      return { ok: res.ok, data: data.data || data, message: data.message };
    } catch (err) {
      return { ok: false, message: 'Error de conexión' };
    }
  },

  // ============ UTILS ============
  formatPrice: function(n) { return '$' + Number(n || 0).toLocaleString('es-CL'); },
  formatDate: function(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-CL', { day:'2-digit', month:'short', year:'numeric' });
  },
  toast: function(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `admin-toast ${type}`;
    el.innerHTML = `${type==='success'?'✓':type==='error'?'✕':'⚠'} ${msg}`;
    container.appendChild(el);
    setTimeout(() => { if(el.parentNode) el.remove(); }, 3500);
  },
  openModal: function(title, body, footer = '') {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalFooter').innerHTML = footer;
    document.getElementById('modalOverlay').classList.add('active');
  },
  closeModal: function() {
    document.getElementById('modalOverlay').classList.remove('active');
  },

  // ============ DASHBOARD ============
  loadDashboard: async function() {
    const content = document.getElementById('mainContent');
    if (content) {
      content.innerHTML = '<div style="text-align:center;padding:40px;">Cargando dashboard...</div>';
    }

    const [statsRes, recentRes, topRes, chartRes] = await Promise.all([
      this.api('/api/dashboard/stats'),
      this.api('/api/dashboard/recent-orders'),
      this.api('/api/dashboard/top-products'),
      this.api('/api/dashboard/sales-chart?period=7days')
    ]);

    const s = statsRes.data || {};
    const recent = recentRes.data || [];
    const top = topRes.data || [];
    const chart = chartRes.data || [];

    const pendingCount = s.pending_orders || 0;
    const badge = document.getElementById('pendingOrdersBadge');
    if (pendingCount > 0) {
      badge.textContent = pendingCount;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }

    const maxSale = Math.max(...chart.map(c => c.total || 0), 1);
    const barsHTML = chart.map(c => {
      const h = Math.max(((c.total || 0) / maxSale) * 200, 8);
      return `<div class="chart-bar" style="height:${h}px;background:${c.total?'var(--admin-primary)':'var(--admin-primary-light)'}">
        <span class="chart-tooltip">${this.formatPrice(c.total||0)}</span>
      </div>`;
    }).join('');
    const labelsHTML = chart.map(c => `<span>${c.label || ''}</span>`).join('');

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue">💰</div>
          <div class="stat-info">
            <h3>${this.formatPrice(s.total_revenue || 0)}</h3>
            <p>Ingresos Totales</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">📦</div>
          <div class="stat-info">
            <h3>${s.total_orders || 0}</h3>
            <p>Pedidos Totales</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple">👕</div>
          <div class="stat-info">
            <h3>${s.total_products || 0}</h3>
            <p>Productos</p>
          </div>
        </div>
          <div class="stat-card" style="visibility:hidden">
          </div>
        </div>

      <div class="grid-2 mb-20">
        <div class="admin-card">
          <div class="card-header">
            <h2>Ventas (Últimos 7 días)</h2>
          </div>
          <div class="card-body">
            <div class="chart-container">${barsHTML}</div>
            <div class="chart-labels">${labelsHTML}</div>
          </div>
        </div>
        <div class="admin-card">
          <div class="card-header"><h2>Productos Top</h2></div>
          <div class="card-body">
            ${top.length ? top.map((p, i) => `
              <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--admin-border)">
                <span style="font-weight:700;color:var(--admin-text-muted);width:20px">${i+1}</span>
                <div style="flex:1">
                  <div style="font-weight:600;font-size:13px">${p.name}</div>
                  <div style="font-size:12px;color:var(--admin-text-muted)">${p.total_sold || 0} vendidos</div>
                </div>
                <span style="font-weight:700">${this.formatPrice(p.total_revenue || 0)}</span>
              </div>
            `).join('') : '<p style="color:var(--admin-text-muted);text-align:center;padding:20px">Sin datos</p>'}
          </div>
        </div>
      </div>

      <div class="admin-card">
        <div class="card-header">
          <h2>Pedidos Recientes</h2>
          <button class="btn-admin btn-admin-outline btn-admin-sm" onclick="Admin.navigate('orders')">Ver todos</button>
        </div>
        <div class="card-body" style="padding:0">
          <table class="admin-table">
            <thead><tr>
              <th>Pedido</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th>
            </tr></thead>
            <tbody>
              ${recent.length ? recent.map(o => `
                <tr style="cursor:pointer" onclick="Admin.viewOrder(${o.id})">
                  <td><strong>#${o.order_number || o.id}</strong></td>
                  <td>${o.customer_name || 'Cliente'}</td>
                  <td><strong>${this.formatPrice(o.total)}</strong></td>
                  <td><span class="admin-badge status-${o.status}">${o.status}</span></td>
                  <td>${this.formatDate(o.created_at)}</td>
                </tr>
              `).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--admin-text-muted);padding:30px">No hay pedidos</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ============ PRODUCTS ============
  async loadProducts(search = '') {
    const content = document.getElementById('mainContent');
    const q = search ? `&search=${encodeURIComponent(search)}` : '';
    const res = await this.api(`/api/products/all?limit=100${q}`);
    const products = res.data || [];

    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">
        <div class="admin-search" style="margin-bottom:0;flex:1;max-width:400px">
          <input type="text" id="productSearch" placeholder="Buscar productos..." value="${search}" onkeydown="if(event.key==='Enter')Admin.loadProducts(this.value)">
          <button class="btn-admin btn-admin-outline btn-admin-sm" onclick="Admin.loadProducts(document.getElementById('productSearch').value)">🔍</button>
        </div>
        <button class="btn-admin btn-admin-primary" onclick="Admin.showProductForm()">＋ Nuevo Producto</button>
      </div>
      <div class="admin-card">
        <div class="card-body" style="padding:0;overflow-x:auto;">
          <table class="admin-table">
            <thead><tr>
              <th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Acciones</th>
            </tr></thead>
            <tbody>
              ${products.length ? products.map(p => `
                <tr>
                  <td>
                    <div class="product-cell">
                      <div class="product-thumb">${Array.isArray(p.images) && p.images.length ? `<img src="${p.images[0]}" alt="">` : '👕'}</div>
                      <div>
                        <div style="font-weight:600">${p.name}</div>
                        <div style="font-size:12px;color:var(--admin-text-muted)">${p.brand || ''}</div>
                      </div>
                    </div>
                  </td>
                  <td>${p.category_name || '-'}</td>
                  <td>
                    <strong>${this.formatPrice(p.price)}</strong>
                    ${p.sale_price ? `<br><span style="color:var(--admin-danger);font-size:12px">${this.formatPrice(p.sale_price)}</span>` : ''}
                  </td>
                  <td><span class="admin-badge ${p.stock < 5 ? 'badge-danger' : 'badge-success'}">${p.stock}</span></td>
                  <td><span class="admin-badge ${p.active ? 'badge-success' : 'badge-gray'}">${p.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <div class="table-actions">
                      <button class="edit" onclick="Admin.showProductForm(${p.id})">✏️</button>
                      <button class="danger" onclick="Admin.deleteProduct(${p.id})">🗑️</button>
                    </div>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--admin-text-muted)">No hay productos</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async showProductForm(id = null) {
    const catsRes = await this.api('/api/categories/all');
    const brandsRes = await this.api('/api/brands/all');
    const cats = catsRes.data || [];
    const brandsList = brandsRes.data || [];
    let product = { name:'', description:'', price:'', sale_price:'', stock:10, category_id:'', brand:'', sizes:'["S","M","L","XL"]', colors:'[]', featured:0, active:1 };

    if (id) {
      const r = await this.api(`/api/products/${id}`);
      if (r.ok) product = { ...product, ...r.data };
    }

    const catsOptions = cats.map(c => `<option value="${c.id}" ${product.category_id==c.id?'selected':''}>${c.parent_id ? '  └ ':'' }${c.name}</option>`).join('');
    const brandsOptions = brandsList.filter(b => b.active).map(b => `<option value="${b.name}" ${product.brand===b.name?'selected':''}>${b.name}</option>`).join('');

    const form = `
      <form class="admin-form" id="productForm" onsubmit="Admin.saveProduct(event,${id})">
        <div class="form-row">
          <div class="form-group">
            <label>Nombre *</label>
            <input name="name" value="${product.name||''}" required>
          </div>
          <div class="form-group">
            <label>Marca</label>
            <select name="brand">
              <option value="">Sin marca</option>
              ${brandsOptions}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <textarea name="description" rows="3">${product.description||''}</textarea>
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label>Precio *</label>
            <input type="number" name="price" value="${product.price||''}" required>
          </div>
          <div class="form-group">
            <label>Precio Oferta</label>
            <input type="number" name="sale_price" value="${product.sale_price||''}">
          </div>
          <div class="form-group">
            <label>Stock *</label>
            <input type="number" name="stock" value="${product.stock||0}" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Categoría</label>
            <select name="category_id"><option value="">Sin categoría</option>${catsOptions}</select>
          </div>
          <div class="form-group" id="sizes-group">
            <label>Tallas</label>
            <div style="display:flex; gap:10px; margin-bottom:10px;">
              <input type="text" id="new-size-input" placeholder="Ej: M, XL, 42" onkeydown="if(event.key==='Enter'){event.preventDefault();Admin.addSize();}">
              <button type="button" class="btn-admin btn-admin-outline" onclick="Admin.addSize()">Agregar</button>
            </div>
            <div id="sizes-list" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
            <input type="hidden" name="sizes" id="hidden-sizes" value='${typeof product.sizes==='string'?product.sizes.replace(/'/g,"&apos;"):JSON.stringify(product.sizes||[]).replace(/'/g,"&apos;")}'>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group" id="colors-group">
            <label>Colores</label>
            <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
              <input type="text" id="new-color-name" placeholder="Nombre (Ej: Rojo)" onkeydown="if(event.key==='Enter'){event.preventDefault();Admin.addColor();}">
              <input type="color" id="new-color-hex" value="#ff0000" style="width:40px; height:38px; padding:0; border:1px solid var(--admin-border); border-radius:4px; cursor:pointer;">
              <button type="button" class="btn-admin btn-admin-outline" onclick="Admin.addColor()">Agregar</button>
            </div>
            <div id="colors-list" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
            <input type="hidden" name="colors" id="hidden-colors" value='${typeof product.colors==='string'?product.colors.replace(/'/g,"&apos;"):JSON.stringify(product.colors||[]).replace(/'/g,"&apos;")}'>
          </div>
          <div class="form-group" style="display:flex;align-items:center;gap:20px;padding-top:24px">
            <label style="display:flex;align-items:center;gap:8px;margin:0;cursor:pointer">
              <input type="checkbox" name="featured" ${product.featured?'checked':''} style="width:auto"> Destacado
            </label>
            <label style="display:flex;align-items:center;gap:8px;margin:0;cursor:pointer">
              <input type="checkbox" name="active" ${product.active?'checked':''} style="width:auto"> Activo
            </label>
          </div>
        </div>
        <!-- Seccion de Imagenes -->
        <div class="form-group">
          <label>Imágenes del Producto</label>
          ${id && Array.isArray(product.images) && product.images.length ? `
            <div id="currentImages" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px">
              ${product.images.map((img, idx) => `
                <div style="position:relative;width:90px;height:90px;border-radius:8px;overflow:hidden;border:1.5px solid #e2e8f0">
                  <img src="${img}" style="width:100%;height:100%;object-fit:cover">
                  <button type="button" onclick="Admin.deleteProductImage(${id},${idx})" style="position:absolute;top:2px;right:2px;background:#ef4444;color:white;border:none;border-radius:50%;width:22px;height:22px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">✕</button>
                </div>
              `).join('')}
            </div>
          ` : ''}
          <div style="border:2px dashed #cbd5e1;border-radius:10px;padding:20px;text-align:center;cursor:pointer;transition:border-color 0.2s" 
               onclick="document.getElementById('productImages').click()" 
               onmouseover="this.style.borderColor='#6366f1'" onmouseout="this.style.borderColor='#cbd5e1'">
            <div style="font-size:32px;margin-bottom:6px">📸</div>
            <p style="margin:0;font-weight:600;font-size:14px;color:#475569">Click para subir imágenes</p>
            <p style="margin:4px 0 0;font-size:12px;color:#94a3b8">JPG, PNG, WebP (máx. 5MB c/u, hasta 5 imágenes)</p>
          </div>
          <input type="file" id="productImages" name="images" accept="image/*" multiple style="display:none" onchange="Admin.previewImages(this)">
          <div id="imagePreview" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:12px"></div>
        </div>
      </form>
    `;
    const footer = `
      <button class="btn-admin btn-admin-outline" onclick="Admin.closeModal()">Cancelar</button>
      <button class="btn-admin btn-admin-primary" onclick="document.getElementById('productForm').requestSubmit()">
        ${id ? 'Guardar Cambios' : 'Crear Producto'}
      </button>
    `;
    this.openModal(id ? 'Editar Producto' : 'Nuevo Producto', form, footer);
    this.renderSizes();
    this.renderColors();
  },

  // Helper methods for Sizes and Colors
  renderSizes() {
    const hidden = document.getElementById('hidden-sizes');
    const list = document.getElementById('sizes-list');
    if (!hidden || !list) return;
    try {
      const sizes = JSON.parse(hidden.value || '[]');
      list.innerHTML = sizes.map((s, i) => `
        <div style="display:flex;align-items:center;gap:4px;background:var(--admin-bg);border:1px solid var(--admin-border);padding:4px 8px;border-radius:4px;font-size:12px;">
          <span>${s}</span>
          <button type="button" onclick="Admin.removeSize(${i})" style="background:none;border:none;color:var(--admin-danger);cursor:pointer;padding:0 2px;">✕</button>
        </div>
      `).join('');
    } catch(e) {}
  },
  addSize() {
    const input = document.getElementById('new-size-input');
    const hidden = document.getElementById('hidden-sizes');
    if (!input || !hidden) return;
    const val = input.value.trim();
    if (!val) return;
    try {
      const sizes = JSON.parse(hidden.value || '[]');
      if (!sizes.includes(val)) {
        sizes.push(val);
        hidden.value = JSON.stringify(sizes);
        this.renderSizes();
      }
      input.value = '';
    } catch(e) {}
  },
  removeSize(idx) {
    const hidden = document.getElementById('hidden-sizes');
    if (!hidden) return;
    try {
      const sizes = JSON.parse(hidden.value || '[]');
      sizes.splice(idx, 1);
      hidden.value = JSON.stringify(sizes);
      this.renderSizes();
    } catch(e) {}
  },

  renderColors() {
    const hidden = document.getElementById('hidden-colors');
    const list = document.getElementById('colors-list');
    if (!hidden || !list) return;
    try {
      const colors = JSON.parse(hidden.value || '[]');
      list.innerHTML = colors.map((c, i) => `
        <div style="display:flex;align-items:center;gap:6px;background:var(--admin-bg);border:1px solid var(--admin-border);padding:4px 8px;border-radius:4px;font-size:12px;">
          <div style="width:12px;height:12px;border-radius:50%;background-color:${c.hex};border:1px solid rgba(0,0,0,0.1)"></div>
          <span>${c.name}</span>
          <button type="button" onclick="Admin.removeColor(${i})" style="background:none;border:none;color:var(--admin-danger);cursor:pointer;padding:0 2px;">✕</button>
        </div>
      `).join('');
    } catch(e) {}
  },
  addColor() {
    const nameInput = document.getElementById('new-color-name');
    const hexInput = document.getElementById('new-color-hex');
    const hidden = document.getElementById('hidden-colors');
    if (!nameInput || !hexInput || !hidden) return;
    const name = nameInput.value.trim();
    const hex = hexInput.value;
    if (!name) return;
    try {
      const colors = JSON.parse(hidden.value || '[]');
      colors.push({ name, hex });
      hidden.value = JSON.stringify(colors);
      this.renderColors();
      nameInput.value = '';
      hexInput.value = '#ff0000';
    } catch(e) {}
  },
  removeColor(idx) {
    const hidden = document.getElementById('hidden-colors');
    if (!hidden) return;
    try {
      const colors = JSON.parse(hidden.value || '[]');
      colors.splice(idx, 1);
      hidden.value = JSON.stringify(colors);
      this.renderColors();
    } catch(e) {}
  },

  async saveProduct(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      name: fd.get('name'), description: fd.get('description'),
      price: Number(fd.get('price')), sale_price: fd.get('sale_price') ? Number(fd.get('sale_price')) : null,
      stock: Number(fd.get('stock')), category_id: fd.get('category_id') || null,
      brand: fd.get('brand'), 
      sizes: fd.get('sizes') ? JSON.parse(fd.get('sizes')) : [], 
      colors: fd.get('colors') ? JSON.parse(fd.get('colors')) : [],
      featured: fd.get('featured') ? 1 : 0, active: fd.get('active') ? 1 : 0
    };

    const url = id ? `/api/products/${id}` : '/api/products';
    const method = id ? 'PUT' : 'POST';
    const res = await this.api(url, { method, body: JSON.stringify(body) });

    if (res.ok) {
      const productId = id || res.data?.id;
      // Upload images if files selected
      const fileInput = document.getElementById('productImages');
      if (fileInput && fileInput.files.length > 0 && productId) {
        const imgForm = new FormData();
        for (const file of fileInput.files) imgForm.append('images', file);
        await this.apiForm(`/api/products/${productId}/images`, imgForm);
      }
      this.toast(id ? 'Producto actualizado' : 'Producto creado');
      this.closeModal();
      this.loadProducts();
    } else {
      this.toast(res.message || 'Error', 'error');
    }
  },

  previewImages(input) {
    const container = document.getElementById('imagePreview');
    container.innerHTML = '';
    for (const file of input.files) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const div = document.createElement('div');
        div.style.cssText = 'width:80px;height:80px;border-radius:8px;overflow:hidden;border:1.5px solid #e2e8f0';
        div.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
        container.appendChild(div);
      };
      reader.readAsDataURL(file);
    }
  },

  async deleteProductImage(productId, imageIndex) {
    if (!confirm('¿Eliminar esta imagen?')) return;
    const res = await this.api(`/api/products/${productId}/images/${imageIndex}`, { method: 'DELETE' });
    if (res.ok) {
      this.toast('Imagen eliminada');
      this.showProductForm(productId);
    } else {
      this.toast(res.message || 'Error al eliminar', 'error');
    }
  },

  async deleteProduct(id) {
    if (!confirm('¿Eliminar este producto?')) return;
    const res = await this.api(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) {
      this.toast('Producto eliminado');
      this.loadProducts();
    } else {
      this.toast(res.message || 'Error', 'error');
    }
  },

  // ============ CATEGORIES ============
  async loadCategories() {
    const content = document.getElementById('mainContent');
    const res = await this.api('/api/categories/all');
    const cats = res.data || [];

    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
        <p style="color:var(--admin-text-muted)">${cats.length} categorías</p>
        <button class="btn-admin btn-admin-primary" onclick="Admin.showCategoryForm()">＋ Nueva Categoría</button>
      </div>
      <div class="admin-card">
        <div class="card-body" style="padding:0">
          <table class="admin-table">
            <thead><tr><th>Nombre</th><th>Slug</th><th>Padre</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              ${cats.map(c => `
                <tr>
                  <td><strong>${c.parent_id?'&nbsp;&nbsp;&nbsp;└ ':''}${c.name}</strong></td>
                  <td style="color:var(--admin-text-muted)">${c.slug}</td>
                  <td>${c.parent_id ? cats.find(p=>p.id===c.parent_id)?.name||'-' : '-'}</td>
                  <td><span class="admin-badge ${c.active?'badge-success':'badge-gray'}">${c.active?'Activa':'Inactiva'}</span></td>
                  <td>
                    <div class="table-actions">
                      <button class="edit" onclick="Admin.showCategoryForm(${c.id})">✏️</button>
                      <button class="danger" onclick="Admin.deleteCategory(${c.id})">🗑️</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async showCategoryForm(id = null) {
    const catsRes = await this.api('/api/categories/all');
    const cats = (catsRes.data || []).filter(c => !c.parent_id);
    let cat = { name:'', slug:'', description:'', parent_id:'', active:1 };
    if (id) {
      const found = (catsRes.data||[]).find(c => c.id === id);
      if (found) cat = found;
    }

    const parentOpts = cats.filter(c=>c.id!==id).map(c =>
      `<option value="${c.id}" ${cat.parent_id==c.id?'selected':''}>${c.name}</option>`
    ).join('');

    const form = `
      <form class="admin-form" id="catForm" onsubmit="Admin.saveCategory(event,${id})">
        <div class="form-row">
          <div class="form-group">
            <label>Nombre *</label>
            <input name="name" value="${cat.name}" required oninput="this.form.slug.value=this.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')">
          </div>
          <div class="form-group">
            <label>Slug</label>
            <input name="slug" value="${cat.slug}">
          </div>
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <textarea name="description" rows="2">${cat.description||''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Categoría Padre</label>
            <select name="parent_id"><option value="">Ninguna (raíz)</option>${parentOpts}</select>
          </div>
          <div class="form-group" style="display:flex;align-items:center;gap:8px;padding-top:24px">
            <label style="display:flex;align-items:center;gap:8px;margin:0;cursor:pointer">
              <input type="checkbox" name="active" ${cat.active?'checked':''} style="width:auto"> Activa
            </label>
          </div>
        </div>
      </form>
    `;
    const footer = `
      <button class="btn-admin btn-admin-outline" onclick="Admin.closeModal()">Cancelar</button>
      <button class="btn-admin btn-admin-primary" onclick="document.getElementById('catForm').requestSubmit()">
        ${id ? 'Guardar' : 'Crear Categoría'}
      </button>
    `;
    this.openModal(id ? 'Editar Categoría' : 'Nueva Categoría', form, footer);
  },

  async saveCategory(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      name: fd.get('name'), slug: fd.get('slug'), description: fd.get('description'),
      parent_id: fd.get('parent_id') || null, active: fd.get('active') ? 1 : 0
    };
    const url = id ? `/api/categories/${id}` : '/api/categories';
    const method = id ? 'PUT' : 'POST';
    const res = await this.api(url, { method, body: JSON.stringify(body) });
    if (res.ok) {
      this.toast(id ? 'Categoría actualizada' : 'Categoría creada');
      this.closeModal();
      this.loadCategories();
    } else {
      this.toast(res.message || 'Error', 'error');
    }
  },

  async deleteCategory(id) {
    if (!confirm('¿Eliminar esta categoría?')) return;
    const res = await this.api(`/api/categories/${id}`, { method: 'DELETE' });
    if (res.ok) {
      this.toast('Categoría eliminada');
      this.loadCategories();
    } else {
      this.toast(res.message || 'Error', 'error');
    }
  },

  // ============ BRANDS ============
  async loadBrands() {
    const content = document.getElementById('mainContent');
    const res = await this.api('/api/brands/all');
    const brands = res.data || [];

    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
        <p style="color:var(--admin-text-muted)">${brands.length} marcas</p>
        <button class="btn-admin btn-admin-primary" onclick="Admin.showBrandForm()">＋ Nueva Marca</button>
      </div>
      <div class="admin-card">
        <div class="card-body" style="padding:0">
          <table class="admin-table">
            <thead><tr><th>ID</th><th>Nombre</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              ${brands.map(b => `
                <tr>
                  <td style="color:var(--admin-text-muted)">#${b.id}</td>
                  <td><strong>${b.name}</strong></td>
                  <td><span class="admin-badge ${b.active?'badge-success':'badge-gray'}">${b.active?'Activa':'Inactiva'}</span></td>
                  <td>
                    <div class="table-actions">
                      <button class="edit" onclick="Admin.showBrandForm(${b.id}, '${b.name.replace(/'/g,"\\'")}', ${b.active})">✏️</button>
                      <button class="danger" onclick="Admin.deleteBrand(${b.id})">🗑️</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  showBrandForm(id = null, name = '', active = 1) {
    const form = `
      <form class="admin-form" id="brandForm" onsubmit="Admin.saveBrand(event,${id})">
        <div class="form-group">
          <label>Nombre de la Marca *</label>
          <input name="name" value="${name}" required>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:8px;padding-top:10px">
          <label style="display:flex;align-items:center;gap:8px;margin:0;cursor:pointer">
            <input type="checkbox" name="active" ${active?'checked':''} style="width:auto"> Activa
          </label>
        </div>
      </form>
    `;
    const footer = `
      <button class="btn-admin btn-admin-outline" onclick="Admin.closeModal()">Cancelar</button>
      <button class="btn-admin btn-admin-primary" onclick="document.getElementById('brandForm').requestSubmit()">
        ${id ? 'Guardar' : 'Crear Marca'}
      </button>
    `;
    this.openModal(id ? 'Editar Marca' : 'Nueva Marca', form, footer);
  },

  async saveBrand(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      name: fd.get('name'),
      active: fd.get('active') ? 1 : 0
    };
    const url = id ? `/api/brands/${id}` : '/api/brands';
    const method = id ? 'PUT' : 'POST';
    const res = await this.api(url, { method, body: JSON.stringify(body) });
    if (res.ok) {
      this.toast(id ? 'Marca actualizada' : 'Marca creada');
      this.closeModal();
      this.loadBrands();
    } else {
      this.toast(res.message || res.error || 'Error', 'error');
    }
  },

  async deleteBrand(id) {
    if (!confirm('¿Eliminar esta marca?')) return;
    const res = await this.api(`/api/brands/${id}`, { method: 'DELETE' });
    if (res.ok) {
      this.toast('Marca eliminada');
      this.loadBrands();
    } else {
      this.toast(res.message || 'Error', 'error');
    }
  },

  // ============ ORDERS ============
  async loadOrders(page = 1) {
    const content = document.getElementById('mainContent');
    const searchInput = document.getElementById('orderSearchInput')?.value || '';
    const startDate = document.getElementById('orderStartDate')?.value || '';
    const endDate = document.getElementById('orderEndDate')?.value || '';
    const statusFilter = document.getElementById('orderStatusFilter')?.value || '';

    let url = `/api/orders?page=${page}&limit=10`;
    if (searchInput) url += `&search=${encodeURIComponent(searchInput)}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;

    const res = await this.api(url);
    const orders = res.data?.orders || [];
    const pagination = res.data?.pagination || { page: 1, pages: 1, total: 0 };

    let paginationHtml = '';
    if (pagination.pages > 1) {
      paginationHtml = '<div class="pagination" style="display:flex;gap:5px;margin-top:15px;justify-content:flex-end;">';
      if (pagination.page > 1) {
        paginationHtml += `<button class="btn-admin btn-admin-outline" onclick="Admin.loadOrders(${pagination.page - 1})">‹</button>`;
      }
      for (let i = 1; i <= pagination.pages; i++) {
        paginationHtml += `<button class="btn-admin ${i === pagination.page ? 'btn-admin-primary' : 'btn-admin-outline'}" onclick="Admin.loadOrders(${i})">${i}</button>`;
      }
      if (pagination.page < pagination.pages) {
        paginationHtml += `<button class="btn-admin btn-admin-outline" onclick="Admin.loadOrders(${pagination.page + 1})">›</button>`;
      }
      paginationHtml += '</div>';
    }

    const statusConfig = {
      '':          { label: 'Todos', color: 'var(--admin-text-muted)', bg: 'var(--admin-bg)' },
      pendiente:   { label: '🕐 Pendiente',   color: '#92400e', bg: '#fef3c7' },
      confirmado:  { label: '✅ Confirmado',  color: '#15803d', bg: '#dcfce7' },
      procesando:  { label: '⚙️ Procesando', color: '#1e40af', bg: '#dbeafe' },
      enviado:     { label: '🚚 Enviado',     color: '#6b21a8', bg: '#f3e8ff' },
      entregado:   { label: '🎉 Entregado',   color: '#065f46', bg: '#d1fae5' },
      cancelado:   { label: '❌ Cancelado',   color: '#991b1b', bg: '#fee2e2' },
    };


    content.innerHTML = `
      <!-- Status filter chips -->
      <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px;align-items:center">
        <span style="font-size:12px;font-weight:600;color:var(--admin-text-muted);margin-right:4px">Estado:</span>
        ${Object.entries(statusConfig).map(([val, cfg]) => `
          <button onclick="Admin._setStatusFilter('${val}')" id="sf-${val||'all'}"
            style="padding:5px 13px;border-radius:20px;border:2px solid ${val === statusFilter ? cfg.color : 'var(--admin-border)'};background:${val === statusFilter ? cfg.bg : 'transparent'};color:${val === statusFilter ? cfg.color : 'var(--admin-text-muted)'};font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s">
            ${cfg.label}
          </button>
        `).join('')}
      </div>

      <!-- Search bar -->
      <div style="margin-bottom:18px;display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center">
        <p style="color:var(--admin-text-muted);font-size:13px;margin:0">
          <strong style="color:var(--admin-text)">${pagination.total}</strong> pedidos encontrados
          ${statusFilter ? `· filtrando por <span style="color:var(--admin-primary)">${statusConfig[statusFilter]?.label||statusFilter}</span>` : ''}
        </p>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input type="text" id="orderSearchInput" placeholder="🔍 Buscar pedido o cliente..." value="${searchInput}"
            class="admin-input" style="width:210px" onkeydown="if(event.key==='Enter') Admin.loadOrders(1)">
          <input type="date" id="orderStartDate" value="${startDate}" class="admin-input" title="Fecha inicio">
          <input type="date" id="orderEndDate" value="${endDate}" class="admin-input" title="Fecha fin">
          <!-- Hidden status select for value persistence -->
          <select id="orderStatusFilter" style="display:none" onchange="Admin.loadOrders(1)">
            ${Object.keys(statusConfig).map(v => `<option value="${v}" ${v === statusFilter ? 'selected' : ''}>${v||'todos'}</option>`).join('')}
          </select>
          <button class="btn-admin btn-admin-primary" onclick="Admin.loadOrders(1)">Buscar</button>
          <button class="btn-admin btn-admin-outline" onclick="Admin._clearOrderFilters()" title="Limpiar filtros">Limpiar</button>
          <button class="btn-admin btn-admin-outline" onclick="Admin._refreshOrders(this)" title="Actualizar pedidos"
            style="display:flex;align-items:center;gap:5px;font-size:13px">
            <svg id="refreshIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15">
              <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
            Actualizar
          </button>
        </div>
      </div>

      <div class="admin-card">
        <div class="card-body" style="padding:0;overflow-x:auto">
          <table class="admin-table">
            <thead><tr>
              <th>Pedido</th><th>Cliente</th><th>Productos</th><th>Total</th><th>Estado</th><th>Fecha</th><th>Acciones</th>
            </tr></thead>
            <tbody>
              ${orders.length ? orders.map(o => `
                <tr>
                  <td><strong>#${o.order_number || o.id}</strong></td>
                  <td>${o.customer_name || 'Cliente'}</td>
                  <td>${(o.items && o.items.length) || 0} items</td>
                  <td><strong>${this.formatPrice(o.total)}</strong></td>
                  <td><span class="admin-badge status-${o.status}">${o.status}</span></td>
                  <td>${this.formatDate(o.created_at)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="edit" onclick="Admin.viewOrder(${o.id})">👁️</button>
                      <button class="edit" onclick="Admin.changeOrderStatus(${o.id},'${o.status}')">📝</button>
                    </div>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--admin-text-muted)">No hay pedidos que coincidan con los filtros</td></tr>'}
            </tbody>
          </table>
          <div style="padding:15px">
            ${paginationHtml}
          </div>
        </div>
      </div>
    `;
    // Store current page
    this._ordersPage = page;
  },

  _setStatusFilter(val) {
    const sel = document.getElementById('orderStatusFilter');
    if (sel) sel.value = val;
    this.loadOrders(1);
  },

  _clearOrderFilters() {
    const ids = ['orderSearchInput','orderStartDate','orderEndDate'];
    ids.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    const sel = document.getElementById('orderStatusFilter');
    if (sel) sel.value = '';
    this.loadOrders(1);
  },

  _refreshOrders(btn) {
    const icon = document.getElementById('refreshIcon');
    if (icon) { icon.style.animation = 'spin 0.6s linear'; setTimeout(() => icon.style.animation = '', 700); }
    this.loadOrders(this._ordersPage || 1);
    this.toast('Pedidos actualizados ✅');
  },

  _ordersPage: 1,



  async viewOrder(id) {
    const res = await this.api(`/api/orders/${id}`);
    if (!res.ok) return this.toast('Error al cargar pedido', 'error');
    const o = res.data;
    const items = o.items || [];
    const body = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
        <div>
          <h4 style="margin-bottom:8px;color:var(--admin-text-muted);font-size:12px;text-transform:uppercase">Información</h4>
          <p><strong>Pedido:</strong> #${o.order_number || o.id}</p>
          <p><strong>Fecha:</strong> ${this.formatDate(o.created_at)}</p>
          <p><strong>Estado:</strong> <span class="admin-badge status-${o.status}">${o.status}</span></p>
          <p><strong>Pago:</strong> ${o.payment_method || 'N/A'}</p>
        </div>
        <div>
          <h4 style="margin-bottom:8px;color:var(--admin-text-muted);font-size:12px;text-transform:uppercase">Cliente & Envío</h4>
          <p><strong>${o.customer_name || ''}</strong></p>
          <p>${o.customer_email || ''}</p>
          <p>${o.customer_phone || ''}</p>
          <p>${o.shipping_address || ''}</p>
          <p>${o.shipping_city || ''}</p>
        </div>
      </div>
      <h4 style="margin-bottom:8px;color:var(--admin-text-muted);font-size:12px;text-transform:uppercase">Productos</h4>
      <div style="max-height: 250px; overflow-y: auto; border: 1px solid var(--admin-border); border-radius: 6px; margin-bottom: 16px;">
        <table class="admin-table" style="margin-bottom:0">
          <thead><tr><th style="position:sticky;top:0;background:var(--admin-bg);">Producto</th><th style="position:sticky;top:0;background:var(--admin-bg);">Talla</th><th style="position:sticky;top:0;background:var(--admin-bg);">Color</th><th style="position:sticky;top:0;background:var(--admin-bg);">Cant.</th><th style="position:sticky;top:0;background:var(--admin-bg);">Precio</th></tr></thead>
          <tbody>
          ${items.map(it => `
            <tr>
              <td>${it.product_name || 'Producto'}</td>
              <td>${it.size || '-'}</td>
              <td>${it.color || '-'}</td>
              <td>${it.quantity}</td>
              <td>${this.formatPrice(it.price * it.quantity)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
      <div style="text-align:right">
        <p>Subtotal: ${this.formatPrice(o.subtotal)}</p>
        <p>Envío: ${this.formatPrice(o.shipping_cost || 0)}</p>
        <p style="font-size:18px;font-weight:700;margin-top:8px">Total: ${this.formatPrice(o.total)}</p>
      </div>
    `;
    
    this._currentOrder = { order: o, items };
    
    this.openModal(`Pedido #${o.order_number || o.id}`, body,
      `<div style="display:flex;gap:10px;justify-content:flex-end;width:100%">
         <button class="btn-admin btn-admin-outline" onclick="Admin.exportOrderPDF()" title="Descargar PDF">📄 PDF</button>
         <button class="btn-admin btn-admin-outline" onclick="Admin.exportOrderExcel()" title="Descargar Excel">📊 Excel</button>
         <div style="flex:1"></div>
         <button class="btn-admin btn-admin-outline" onclick="Admin.closeModal()">Cerrar</button>
         <button class="btn-admin btn-admin-primary" onclick="Admin.changeOrderStatus(${o.id},'${o.status}')">Cambiar Estado</button>
       </div>`
    );
  },

  exportOrderPDF() {
    if (!this._currentOrder) return;
    const { order: o, items } = this._currentOrder;
    if (!window.jspdf) return this.toast('Cargando librería PDF, intenta de nuevo...', 'error');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Configurar colores corporativos
    const primaryColor = [79, 70, 229]; // Indigo-600
    const secondaryColor = [243, 244, 246]; // Gray-100
    const textColor = [31, 41, 55]; // Gray-800
    
    // Encabezado
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("MODA STORE", 14, 25);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Factura Comercial", 140, 25);
    
    // Información del Pedido
    doc.setTextColor(...textColor);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Pedido #${o.order_number || o.id}`, 14, 55);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${this.formatDate(o.created_at)}`, 14, 62);
    doc.text(`Estado: ${o.status.toUpperCase()}`, 14, 68);
    doc.text(`Método de pago: ${o.payment_method || 'N/A'}`, 14, 74);
    
    // Información del Cliente
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Facturado a:", 110, 55);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(o.customer_name || 'Cliente', 110, 62);
    doc.text(o.customer_email || '', 110, 68);
    doc.text(o.customer_phone || '', 110, 74);
    doc.text(`${o.shipping_address}, ${o.shipping_city}`, 110, 80);
    
    // Tabla de Productos
    const tableData = items.map(it => [
      it.product_name,
      it.size || '-',
      it.color || '-',
      it.quantity.toString(),
      `$${this.formatPrice(it.price)}`,
      `$${this.formatPrice(it.price * it.quantity)}`
    ]);
    
    doc.autoTable({
      startY: 95,
      head: [['Producto', 'Talla', 'Color', 'Cant.', 'P. Unitario', 'Subtotal']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: secondaryColor },
      styles: { fontSize: 9, cellPadding: 5 },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
    });
    
    const finalY = doc.lastAutoTable.finalY || 95;
    
    // Totales
    doc.setFillColor(...secondaryColor);
    doc.rect(120, finalY + 10, 76, 35, 'F');
    
    doc.setFontSize(10);
    doc.text("Subtotal:", 125, finalY + 18);
    doc.text(`$${this.formatPrice(o.subtotal)}`, 190, finalY + 18, { align: "right" });
    
    doc.text("Envío:", 125, finalY + 26);
    doc.text(`$${this.formatPrice(o.shipping_cost || 0)}`, 190, finalY + 26, { align: "right" });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL:", 125, finalY + 38);
    doc.text(`$${this.formatPrice(o.total)}`, 190, finalY + 38, { align: "right" });
    
    // Footer
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text("Gracias por su compra en Moda Store.", 105, 280, { align: "center" });
    
    doc.save(`Pedido_${o.order_number || o.id}.pdf`);
  },

  async exportOrderExcel() {
    if (!this._currentOrder) return;
    const { order: o, items } = this._currentOrder;
    if (!window.ExcelJS) return this.toast('Cargando librería Excel, intenta de nuevo...', 'error');
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Detalle de Pedido');
    
    // Estilos globales
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
    };
    
    // Título principal
    sheet.mergeCells('A1:F2');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `MODA STORE - Pedido #${o.order_number || o.id}`;
    titleCell.font = { size: 16, bold: true, color: { argb: 'FF4F46E5' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Información General
    sheet.getCell('A4').value = 'Información del Cliente';
    sheet.getCell('A4').font = { bold: true };
    sheet.getCell('A5').value = 'Nombre:'; sheet.getCell('B5').value = o.customer_name;
    sheet.getCell('A6').value = 'Email:'; sheet.getCell('B6').value = o.customer_email;
    sheet.getCell('A7').value = 'Teléfono:'; sheet.getCell('B7').value = o.customer_phone || '-';
    sheet.getCell('A8').value = 'Dirección:'; sheet.getCell('B8').value = `${o.shipping_address}, ${o.shipping_city}`;
    
    sheet.getCell('D4').value = 'Detalles del Pedido';
    sheet.getCell('D4').font = { bold: true };
    sheet.getCell('D5').value = 'Fecha:'; sheet.getCell('E5').value = this.formatDate(o.created_at);
    sheet.getCell('D6').value = 'Estado:'; sheet.getCell('E6').value = o.status.toUpperCase();
    sheet.getCell('D7').value = 'Pago:'; sheet.getCell('E7').value = o.payment_method;
    
    // Espacio
    sheet.addRow([]);
    
    // Tabla de productos
    const tableHeader = ['Producto', 'Talla', 'Color', 'Cantidad', 'Precio Unitario', 'Subtotal'];
    const headerRow = sheet.addRow(tableHeader);
    headerRow.eachCell((cell) => { Object.assign(cell, headerStyle); });
    
    let currentRow = 11;
    items.forEach((it, index) => {
      const row = sheet.addRow([
        it.product_name,
        it.size || '-',
        it.color || '-',
        it.quantity,
        it.price,
        { formula: `D${currentRow}*E${currentRow}`, result: it.price * it.quantity }
      ]);
      // Formato numérico
      row.getCell(5).numFmt = '"$"#,##0';
      row.getCell(6).numFmt = '"$"#,##0';
      
      // Estilos de filas alternadas
      if (index % 2 === 0) {
        row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }; });
      }
      
      currentRow++;
    });
    
    // Totales
    sheet.addRow([]);
    const subtotalRow = sheet.addRow(['', '', '', '', 'SUBTOTAL:', { formula: `SUM(F11:F${currentRow-1})` }]);
    const shippingRow = sheet.addRow(['', '', '', '', 'ENVÍO:', o.shipping_cost || 0]);
    const totalRow = sheet.addRow(['', '', '', '', 'TOTAL:', { formula: `F${currentRow+1}+F${currentRow+2}` }]);
    
    subtotalRow.getCell(5).font = { bold: true }; subtotalRow.getCell(6).numFmt = '"$"#,##0';
    shippingRow.getCell(5).font = { bold: true }; shippingRow.getCell(6).numFmt = '"$"#,##0';
    totalRow.getCell(5).font = { bold: true }; totalRow.getCell(6).numFmt = '"$"#,##0';
    totalRow.getCell(6).font = { bold: true };
    
    // Ancho de columnas
    sheet.columns = [
      { width: 35 }, { width: 12 }, { width: 15 }, { width: 12 }, { width: 18 }, { width: 18 }
    ];
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pedido_${o.order_number || o.id}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  changeOrderStatus(id, current) {
    const statuses = ['pendiente','confirmado','preparando','enviado','entregado','cancelado'];
    const opts = statuses.map(s => `<option value="${s}" ${s===current?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('');
    const body = `
      <form class="admin-form" id="statusForm" onsubmit="Admin.saveOrderStatus(event,${id})">
        <div class="form-group">
          <label>Nuevo Estado</label>
          <select name="status">${opts}</select>
        </div>
      </form>
    `;
    this.openModal('Cambiar Estado', body,
      `<button class="btn-admin btn-admin-outline" onclick="Admin.closeModal()">Cancelar</button>
       <button class="btn-admin btn-admin-primary" onclick="document.getElementById('statusForm').requestSubmit()">Guardar</button>`
    );
  },

  async saveOrderStatus(e, id) {
    e.preventDefault();
    const status = new FormData(e.target).get('status');
    const res = await this.api(`/api/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    if (res.ok) {
      this.toast('Estado actualizado');
      this.closeModal();
      this.loadOrders();
    } else {
      this.toast(res.message || 'Error', 'error');
    }
  },


  // ============ USUARIOS ============
  async loadUsers() {
    const content = document.getElementById('mainContent');
    const search = document.getElementById('userSearch')?.value || '';
    const res = await this.api('/api/users?search=' + encodeURIComponent(search));
    const users = res.data?.users || res.data || [];

    content.innerHTML = `
      <div class="admin-card" style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2>Gestión de Usuarios (Staff)</h2>
          <button class="btn-admin btn-admin-primary" onclick="Admin.openUserModal()">+ Nuevo Usuario</button>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:16px">
          <input type="text" id="userSearch" value="${search}" placeholder="Buscar por nombre o email..." class="admin-input" style="width:250px" onkeydown="if(event.key==='Enter') Admin.loadUsers()">
          <button class="btn-admin btn-admin-primary" onclick="Admin.loadUsers()">Buscar</button>
        </div>
        
        <table class="admin-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${users.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--admin-text-muted)">No se encontraron usuarios.</td></tr>' : ''}
            ${users.map(u => `
              <tr>
                <td style="font-weight:600">${u.name}</td>
                <td>${u.email}</td>
                <td>
                  <span class="badge ${u.role==='admin'?'badge-purple':u.role==='editor'?'badge-info':'badge-gray'}">${(u.role || '').toUpperCase()}</span>
                </td>
                <td>
                  <button onclick="Admin.toggleUserActivity(${u.id})" class="badge ${u.active ? 'badge-success' : 'badge-danger'}" style="border:none;cursor:pointer">
                    ${u.active ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td>
                  <div class="table-actions">
                    <button class="edit" onclick="Admin.openUserModal(${u.id})" title="Editar">✏️</button>
                    ${this.user && this.user.id !== u.id ? `<button class="danger" onclick="Admin.deleteUser(${u.id})" title="Eliminar">🗑️</button>` : `<button class="danger" disabled style="opacity:0.3;cursor:not-allowed" title="No puedes eliminarte a ti mismo">🗑️</button>`}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async openUserModal(id = null) {
    let u = { name: '', email: '', phone: '', role: 'editor', active: 1, password: '' };
    if (id) {
      const res = await this.api('/api/users/' + id);
      if (res.ok && res.data.user) {
        u = res.data.user;
      }
    }
    
    document.getElementById('modalTitle').textContent = id ? 'Editar Usuario' : 'Nuevo Usuario';
    document.getElementById('modalBody').innerHTML = `
      <form id="userForm" class="admin-form" onsubmit="Admin.saveUser(event, ${id})">
        <div class="form-row">
          <div class="form-group">
            <label>Nombre Completo *</label>
            <input name="name" value="${u.name}" required class="admin-input">
          </div>
          <div class="form-group">
            <label>Email *</label>
            <input type="email" name="email" value="${u.email}" required class="admin-input">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Contraseña ${id ? '<small style="color:var(--admin-text-muted)">(Dejar en blanco para no cambiar)</small>' : '*'}</label>
            <input type="password" name="password" class="admin-input" ${!id ? 'required' : ''}>
          </div>
          <div class="form-group">
            <label>Rol *</label>
            <select name="role" class="admin-input" required>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador (Acceso Total)</option>
              <option value="editor" ${u.role === 'editor' ? 'selected' : ''}>Editor (Edita catálogo y pedidos)</option>
              <option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>Visualizador (Solo Lectura)</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Teléfono</label>
            <input name="phone" value="${u.phone || ''}" class="admin-input">
          </div>
        </div>
        <div style="margin-top:20px;text-align:right">
          <button type="submit" class="btn-admin btn-admin-primary">Guardar Usuario</button>
        </div>
      </form>
    `;
    document.getElementById('modalFooter').innerHTML = '';
    
    document.getElementById('modalOverlay').classList.add('active');
  },

  async saveUser(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    if (!data.password) delete data.password;

    const url = id ? '/api/users/' + id : '/api/users';
    const method = id ? 'PUT' : 'POST';

    const res = await this.api(url, { method, body: JSON.stringify(data) });
    if (res.ok) {
      this.toast('Usuario guardado exitosamente');
      this.closeModal();
      this.loadUsers();
    } else {
      this.toast(res.message || 'Error al guardar', 'error');
    }
  },

  async deleteUser(id) {
    if (!confirm('¿Estás seguro de eliminar a este usuario de manera permanente?')) return;
    const res = await this.api('/api/users/' + id, { method: 'DELETE' });
    if (res.ok) {
      this.toast('Usuario eliminado');
      this.loadUsers();
    } else {
      this.toast(res.message || 'Error al eliminar', 'error');
    }
  },

  async toggleUserActivity(id) {
    const resGet = await this.api('/api/users/' + id);
    if (!resGet.ok || !resGet.data.user) return;
    
    const u = resGet.data.user;
    const res = await this.api('/api/users/' + id, { 
      method: 'PUT', 
      body: JSON.stringify({ active: u.active ? 0 : 1 }) 
    });
    
    if (res.ok) {
      this.toast(u.active ? 'Usuario desactivado' : 'Usuario activado');
      this.loadUsers();
    } else {
      this.toast(res.message || 'Error cambiando estado', 'error');
    }
  },


  // ============ BANNERS ============
  async loadBanners() {
    const content = document.getElementById('mainContent');
    const res = await this.api('/api/dashboard/banners');
    const banners = res.data || [];

    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
        <p style="color:var(--admin-text-muted)">${banners.length} banners</p>
        <button class="btn-admin btn-admin-primary" onclick="Admin.showBannerForm()">＋ Nuevo Banner</button>
      </div>
      <div class="admin-card">
        <div class="card-body" style="padding:0">
          <table class="admin-table">
            <thead><tr><th>Título</th><th>Subtítulo</th><th>Enlace</th><th>Orden</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              ${banners.map(b => `
                <tr>
                  <td><strong>${b.title||''}</strong></td>
                  <td style="color:var(--admin-text-muted)">${b.subtitle||''}</td>
                  <td style="font-size:12px">${b.link||'-'}</td>
                  <td>${b.sort_order||0}</td>
                  <td><span class="admin-badge ${b.active?'badge-success':'badge-gray'}">${b.active?'Activo':'Inactivo'}</span></td>
                  <td>
                    <div class="table-actions">
                      <button class="edit" onclick="Admin.showBannerForm(${b.id})">✏️</button>
                      <button class="danger" onclick="Admin.deleteBanner(${b.id})">🗑️</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async showBannerForm(id = null) {
    let b = { title:'', subtitle:'', image:'', link:'', button_text:'Ver más', bg_color:'#6366f1', sort_order:0, active:1 };
    if (id) {
      const res = await this.api('/api/dashboard/banners');
      const found = (res.data||[]).find(x => x.id === id);
      if (found) b = found;
    }
    const form = `
      <form class="admin-form" id="bannerForm" onsubmit="Admin.saveBanner(event,${id})">
        <div class="form-row">
          <div class="form-group"><label>Título *</label><input name="title" value="${b.title||''}" required></div>
          <div class="form-group"><label>Subtítulo</label><input name="subtitle" value="${b.subtitle||''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Enlace</label><input name="link" value="${b.link||''}"></div>
          <div class="form-group"><label>Texto Botón</label><input name="button_text" value="${b.button_text||'Ver más'}"></div>
        </div>
        <div class="form-row-3">
          <div class="form-group"><label>Color Fondo</label><input type="color" name="bg_color" value="${b.bg_color||'#6366f1'}" style="height:40px"></div>
          <div class="form-group"><label>Orden</label><input type="number" name="sort_order" value="${b.sort_order||0}"></div>
          <div class="form-group" style="display:flex;align-items:center;padding-top:24px">
            <label style="display:flex;align-items:center;gap:8px;margin:0;cursor:pointer">
              <input type="checkbox" name="active" ${b.active?'checked':''} style="width:auto"> Activo
            </label>
          </div>
        </div>
        <div class="form-group">
          <label>Imagen de Fondo</label>
          ${b.image ? `<div style="margin-bottom:10px"><img src="${b.image}" style="max-width:100px;border-radius:4px;border:1px solid #ccc"></div>` : ''}
          <input type="file" name="banner_image" accept="image/*">
        </div>
      </form>
    `;
    this.openModal(id ? 'Editar Banner' : 'Nuevo Banner', form,
      `<button class="btn-admin btn-admin-outline" onclick="Admin.closeModal()">Cancelar</button>
       <button class="btn-admin btn-admin-primary" onclick="document.getElementById('bannerForm').requestSubmit()">${id?'Guardar':'Crear'}</button>`
    );
  },

  async saveBanner(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      title: fd.get('title'), subtitle: fd.get('subtitle'), link: fd.get('link'),
      button_text: fd.get('button_text'), bg_color: fd.get('bg_color'),
      sort_order: Number(fd.get('sort_order')), active: fd.get('active') ? 1 : 0
    };
    const url = id ? `/api/dashboard/banners/${id}` : '/api/dashboard/banners';
    const method = id ? 'PUT' : 'POST';
    const res = await this.api(url, { method, body: JSON.stringify(body) });
    if (res.ok) {
      const bannerId = id || res.data?.id || res.data?.lastInsertRowid;
      // Also check if res.data exists correctly, our api returns data
      const actualId = id || (res.data && res.data.id);
      const fileInput = e.target.querySelector('input[name="banner_image"]');
      if (fileInput && fileInput.files.length > 0 && actualId) {
        const imgForm = new FormData();
        imgForm.append('image', fileInput.files[0]);
        await this.apiForm(`/api/dashboard/banners/${actualId}/image`, imgForm);
      }
      this.toast(id ? 'Banner actualizado' : 'Banner creado');
      this.closeModal();
      this.loadBanners();
    } else {
      this.toast(res.message || 'Error', 'error');
    }
  },

  async deleteBanner(id) {
    if (!confirm('¿Eliminar este banner?')) return;
    const res = await this.api(`/api/dashboard/banners/${id}`, { method: 'DELETE' });
    if (res.ok) { this.toast('Banner eliminado'); this.loadBanners(); }
    else this.toast(res.message || 'Error', 'error');
  },

  // ============ COUPONS ============
  async loadCoupons() {
    const content = document.getElementById('mainContent');
    const res = await this.api('/api/dashboard/coupons');
    const coupons = res.data || [];

    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
        <p style="color:var(--admin-text-muted)">${coupons.length} cupones</p>
        <button class="btn-admin btn-admin-primary" onclick="Admin.showCouponForm()">＋ Nuevo Cupón</button>
      </div>
      <div class="admin-card">
        <div class="card-body" style="padding:0;overflow-x:auto">
          <table class="admin-table">
            <thead><tr><th>Código</th><th>Tipo</th><th>Descuento</th><th>Mín. Compra</th><th>Usos</th><th>Válido Hasta</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              ${coupons.map(c => `
                <tr>
                  <td><strong style="font-family:monospace">${c.code}</strong></td>
                  <td>${c.type === 'percentage' ? 'Porcentaje' : c.type === 'free_shipping' ? 'Envío Gratis' : 'Monto Fijo'}</td>
                  <td>${c.type === 'percentage' ? c.value + '%' : c.type === 'free_shipping' ? '🚚' : this.formatPrice(c.value)}</td>
                  <td>${c.min_purchase ? this.formatPrice(c.min_purchase) : '-'}</td>
                  <td>${c.used_count || 0}/${c.max_uses || '∞'}</td>
                  <td>${c.valid_until ? this.formatDate(c.valid_until) : 'Sin límite'}</td>
                  <td><span class="admin-badge ${c.active?'badge-success':'badge-gray'}">${c.active?'Activo':'Inactivo'}</span></td>
                  <td>
                    <div class="table-actions">
                      <button class="edit" onclick="Admin.showCouponForm(${c.id})">✏️</button>
                      <button class="danger" onclick="Admin.deleteCoupon(${c.id})">🗑️</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async showCouponForm(id = null) {
    let c = { code:'', type:'percentage', value:'', min_purchase:'', max_uses:'', valid_until:'', active:1 };
    if (id) {
      const res = await this.api('/api/dashboard/coupons');
      const found = (res.data||[]).find(x => x.id === id);
      if (found) c = found;
    }
    const form = `
      <form class="admin-form" id="couponForm" onsubmit="Admin.saveCoupon(event,${id})">
        <div class="form-row">
          <div class="form-group">
            <label>Código *</label>
            <input name="code" value="${c.code||''}" required style="text-transform:uppercase">
          </div>
          <div class="form-group">
            <label>Tipo *</label>
            <select name="type">
              <option value="percentage" ${c.type==='percentage'?'selected':''}>Porcentaje (%)</option>
              <option value="fixed" ${c.type==='fixed'?'selected':''}>Monto Fijo ($)</option>
              <option value="free_shipping" ${c.type==='free_shipping'?'selected':''}>Envío Gratis</option>
            </select>
          </div>
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label>Valor Descuento</label>
            <input type="number" name="value" value="${c.value||''}">
          </div>
          <div class="form-group">
            <label>Compra Mínima</label>
            <input type="number" name="min_purchase" value="${c.min_purchase||''}">
          </div>
          <div class="form-group">
            <label>Usos Máximos</label>
            <input type="number" name="max_uses" value="${c.max_uses||''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Válido Hasta</label>
            <input type="date" name="valid_until" value="${c.valid_until?c.valid_until.split('T')[0]:''}">
          </div>
          <div class="form-group" style="display:flex;align-items:center;padding-top:24px">
            <label style="display:flex;align-items:center;gap:8px;margin:0;cursor:pointer">
              <input type="checkbox" name="active" ${c.active?'checked':''} style="width:auto"> Activo
            </label>
          </div>
        </div>
      </form>
    `;
    this.openModal(id ? 'Editar Cupón' : 'Nuevo Cupón', form,
      `<button class="btn-admin btn-admin-outline" onclick="Admin.closeModal()">Cancelar</button>
       <button class="btn-admin btn-admin-primary" onclick="document.getElementById('couponForm').requestSubmit()">${id?'Guardar':'Crear'}</button>`
    );
  },

  async saveCoupon(e, id) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      code: fd.get('code').toUpperCase(), type: fd.get('type'),
      value: Number(fd.get('value'))||0, min_purchase: Number(fd.get('min_purchase'))||null,
      max_uses: Number(fd.get('max_uses'))||null, valid_until: fd.get('valid_until')||null,
      active: fd.get('active') ? 1 : 0
    };
    const url = id ? `/api/dashboard/coupons/${id}` : '/api/dashboard/coupons';
    const method = id ? 'PUT' : 'POST';
    const res = await this.api(url, { method, body: JSON.stringify(body) });
    if (res.ok) {
      this.toast(id ? 'Cupón actualizado' : 'Cupón creado');
      this.closeModal();
      this.loadCoupons();
    } else {
      this.toast(res.message || 'Error', 'error');
    }
  },

  async deleteCoupon(id) {
    if (!confirm('¿Eliminar este cupón?')) return;
    const res = await this.api(`/api/dashboard/coupons/${id}`, { method: 'DELETE' });
    if (res.ok) { this.toast('Cupón eliminado'); this.loadCoupons(); }
    else this.toast(res.message || 'Error', 'error');
  },

  // ============ SETTINGS ============
  async loadSettings() {
    const content = document.getElementById('mainContent');
    const res = await this.api('/api/dashboard/settings');
    const settings = res.data || {};

    content.innerHTML = `
      <div class="admin-card" style="max-width:700px">
        <div class="card-header"><h2>Configuración de la Tienda</h2></div>
        <div class="card-body">
          <form class="admin-form" id="settingsForm" onsubmit="Admin.saveSettings(event)">
            <div class="form-group">
              <label>Nombre de la Tienda</label>
              <input name="store_name" value="${settings.store_name||''}">
            </div>
            <div class="form-group">
              <label>Descripción</label>
              <textarea name="store_description" rows="2">${settings.store_description||''}</textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Email de Contacto</label>
                <input type="email" name="contact_email" value="${settings.contact_email||''}">
              </div>
              <div class="form-group">
                <label>Teléfono</label>
                <input name="contact_phone" value="${settings.contact_phone||''}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Moneda</label>
                <input name="currency" value="${settings.currency||'CLP'}">
              </div>
              <div class="form-group">
                <label>Costo de Envío</label>
                <input type="number" name="shipping_cost" value="${settings.shipping_cost||0}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Envío Gratis desde ($)</label>
                <input type="number" name="free_shipping_min" value="${settings.free_shipping_min||0}">
              </div>
              <div class="form-group">
                <label>Impuesto (%)</label>
                <input type="number" name="tax_rate" value="${settings.tax_rate||0}">
              </div>
            </div>
            <h3 style="margin-top:24px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;font-size:16px;color:#334155;">📢 Barra de Anuncios Superior</h3>

            <!-- Toggle global -->
            <div style="display:flex;align-items:center;justify-content:space-between;background:var(--admin-bg);border:1px solid var(--admin-border);border-radius:8px;padding:12px 16px;margin-bottom:16px">
              <div>
                <strong style="font-size:14px">Barra de anuncios activada</strong>
                <p style="margin:2px 0 0;font-size:12px;color:var(--admin-text-muted)">Si está desactivada, no se mostrará ningún anuncio en la tienda</p>
              </div>
              <div onclick="Admin.togglePromoBar()" style="display:flex;align-items:center;gap:8px;cursor:pointer">
                <div style="position:relative">
                  <input type="checkbox" name="promo_bar_enabled" id="promoBarEnabled" ${settings.promo_bar_enabled!=='0'?'checked':''} style="display:none;">
                  <div id="promoBarToggle" style="width:48px;height:26px;background:${settings.promo_bar_enabled!=='0'?'#22c55e':'#e2e8f0'};border-radius:13px;position:relative;cursor:pointer;transition:background 0.2s">
                    <div style="width:20px;height:20px;background:white;border-radius:50%;position:absolute;top:3px;left:${settings.promo_bar_enabled!=='0'?'25':'3'}px;transition:left 0.2s;box-shadow:0 1px 4px rgba(0,0,0,0.2);pointer-events:none;"></div>
                  </div>
                </div>
                <span id="promoBarLabel" style="font-size:13px;font-weight:600;color:${settings.promo_bar_enabled!=='0'?'#22c55e':'#94a3b8'}">${settings.promo_bar_enabled!=='0'?'Activada':'Desactivada'}</span>
              </div>
            </div>

            <!-- Lista de anuncios -->
            <div id="promo-announcements" style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
              ${(() => {
                let announcements = [];
                try { announcements = JSON.parse(settings.promo_announcements || '[]'); } catch(e) {}
                if (!announcements.length) announcements = [
                  { text: '🚚 ENVÍO GRATIS en compras sobre $50.000', active: true, color: '#1e293b', highlight: '#00b894' },
                  { text: '🏷️ Usa cupón BIENVENIDO10 para 10% OFF', active: true, color: '#1e293b', highlight: '#e94560' }
                ];
                return announcements.map((a, i) => `
                  <div class="promo-ann-item" style="display:flex;gap:10px;align-items:center;background:var(--admin-bg);border:1px solid var(--admin-border);border-radius:8px;padding:10px 14px">
                    <div style="display:flex;flex-direction:column;gap:6px;flex:1">
                      <input class="admin-input" placeholder="Texto del anuncio (usa emojis para hacerlo más visual)" value="${(a.text||'').replace(/"/g,'&quot;')}" id="pa-text-${i}" style="font-size:13px">
                      <div style="display:flex;gap:8px;align-items:center">
                        <label style="font-size:11px;color:var(--admin-text-muted);white-space:nowrap">Fondo:</label>
                        <input type="color" id="pa-color-${i}" value="${a.color||'#1e293b'}" style="width:32px;height:28px;border:none;border-radius:4px;cursor:pointer;background:none">
                        <label style="font-size:11px;color:var(--admin-text-muted);white-space:nowrap">Acento:</label>
                        <input type="color" id="pa-highlight-${i}" value="${a.highlight||'#00b894'}" style="width:32px;height:28px;border:none;border-radius:4px;cursor:pointer;background:none">
                        <div style="flex:1"></div>
                        <label style="font-size:11px;color:var(--admin-text-muted)">Activo</label>
                        <input type="checkbox" id="pa-active-${i}" ${a.active?'checked':''} style="width:16px;height:16px;cursor:pointer">
                      </div>
                    </div>
                    <button type="button" onclick="Admin.removePromoAnn(${i})" style="background:none;border:none;color:var(--admin-danger);cursor:pointer;font-size:20px;padding:4px 8px;flex-shrink:0">✕</button>
                  </div>
                `).join('');
              })()}
            </div>
            <button type="button" class="btn-admin btn-admin-outline" onclick="Admin.addPromoAnn()" style="width:100%;border-style:dashed;margin-bottom:8px">+ Agregar Anuncio</button>

            <h3 style="margin-top:24px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;font-size:16px;color:#334155;">Características (Iconos bajo el slider)</h3>
            <div class="form-row">
              <div class="form-group">
                <label>Característica 1 - Título</label>
                <input name="feature_1_title" value="${settings.feature_1_title||'Envío Gratis'}">
              </div>
              <div class="form-group">
                <label>Característica 1 - Descripción</label>
                <input name="feature_1_desc" value="${settings.feature_1_desc||'En compras sobre $50.000'}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Característica 2 - Título</label>
                <input name="feature_2_title" value="${settings.feature_2_title||'Devolución Fácil'}">
              </div>
              <div class="form-group">
                <label>Característica 2 - Descripción</label>
                <input name="feature_2_desc" value="${settings.feature_2_desc||'30 días para devolver'}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Característica 3 - Título</label>
                <input name="feature_3_title" value="${settings.feature_3_title||'Pago Seguro'}">
              </div>
              <div class="form-group">
                <label>Característica 3 - Descripción</label>
                <input name="feature_3_desc" value="${settings.feature_3_desc||'Tus datos protegidos'}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Característica 4 - Título</label>
                <input name="feature_4_title" value="${settings.feature_4_title||'Soporte 24/7'}">
              </div>
              <div class="form-group">
                <label>Característica 4 - Descripción</label>
                <input name="feature_4_desc" value="${settings.feature_4_desc||'Estamos para ayudarte'}">
              </div>
            </div>

            <h3 style="margin-top:24px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;font-size:16px;color:#334155;">Sección Newsletter</h3>
            <div class="form-row">
              <div class="form-group">
                <label>Título Newsletter</label>
                <input name="newsletter_title" value="${settings.newsletter_title||'Únete a nuestra comunidad'}">
              </div>
              <div class="form-group">
                <label>Descripción Newsletter</label>
                <input name="newsletter_desc" value="${settings.newsletter_desc||'Recibe ofertas exclusivas y las últimas tendencias directo en tu correo'}">
              </div>
            </div>

            <h3 style="margin-top:24px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;font-size:16px;color:#334155;">Métodos de Pago</h3>
            <div style="background:var(--admin-bg);border:1px solid var(--admin-border);border-radius:8px;padding:16px;margin-top:12px;display:flex;flex-direction:column;gap:12px">
              
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                <input type="checkbox" id="pmCardEnabled" ${settings.pm_card_enabled !== '0' ? 'checked' : ''} style="width:16px;height:16px">
                <span style="font-weight:600;font-size:14px">💳 Tarjeta de crédito/débito</span>
              </label>

              <div style="border-top:1px solid var(--admin-border);padding-top:12px">
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:8px">
                  <input type="checkbox" id="pmTransferEnabled" ${settings.pm_transfer_enabled !== '0' ? 'checked' : ''} style="width:16px;height:16px">
                  <span style="font-weight:600;font-size:14px">🏦 Transferencia bancaria</span>
                </label>
                <div style="padding-left:26px">
                  <label style="font-size:12px;color:var(--admin-text-muted);display:block;margin-bottom:4px">Instrucciones / Datos de la cuenta bancaria</label>
                  <textarea name="pm_transfer_instructions" class="admin-input" rows="3" placeholder="Ej: Banco Estado\nCuenta Rut: 12345678-9\nNombre: Juan Pérez\nCorreo: pagos@tienda.com">${settings.pm_transfer_instructions || ''}</textarea>
                </div>
              </div>

              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;border-top:1px solid var(--admin-border);padding-top:12px">
                <input type="checkbox" id="pmCashEnabled" ${settings.pm_cash_enabled !== '0' ? 'checked' : ''} style="width:16px;height:16px">
                <span style="font-weight:600;font-size:14px">💵 Pago contra entrega</span>
              </label>
            </div>

            <div style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px">
              <button type="submit" class="btn-admin btn-admin-primary">💾 Guardar Configuración</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async saveSettings(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const settings = {};
    fd.forEach((v, k) => { settings[k] = v; });
    // Collect promo announcements
    settings.promo_announcements = JSON.stringify(this._readPromoAnns());
    // Handle checkbox (unchecked = not in FormData)
    settings.promo_bar_enabled = document.getElementById('promoBarEnabled')?.checked ? '1' : '0';
    settings.pm_card_enabled = document.getElementById('pmCardEnabled')?.checked ? '1' : '0';
    settings.pm_transfer_enabled = document.getElementById('pmTransferEnabled')?.checked ? '1' : '0';
    settings.pm_cash_enabled = document.getElementById('pmCashEnabled')?.checked ? '1' : '0';
    
    const res = await this.api('/api/dashboard/settings', { method: 'PUT', body: JSON.stringify(settings) });
    if (res.ok) {
      this.toast('Configuración guardada');
    } else {
      this.toast(res.message || 'Error', 'error');
    }
  },

  // ============ FOOTER SETTINGS ============
  async loadFooterSettings() {
    const content = document.getElementById('mainContent');
    const res = await this.api('/api/dashboard/settings');
    const s = res || {};

    let tienda = [], ayuda = [], contacto = [];
    try { tienda = JSON.parse(s.footer_tienda || '[]'); } catch(e) {}
    try { ayuda = JSON.parse(s.footer_ayuda || '[]'); } catch(e) {}
    try { contacto = JSON.parse(s.footer_contacto || '[]'); } catch(e) {}
    if (!tienda.length) tienda = [{label:'Mujer',url:'#/categoria/mujer'},{label:'Hombre',url:'#/categoria/hombre'},{label:'Niños',url:'#/categoria/ninos'},{label:'Accesorios',url:'#/categoria/accesorios'},{label:'Ofertas',url:'#/ofertas'}];
    if (!ayuda.length) ayuda = [{label:'Preguntas frecuentes',url:'#'},{label:'Envíos y entregas',url:'#'},{label:'Devoluciones',url:'#'},{label:'Guía de tallas',url:'#'},{label:'Contáctanos',url:'#'}];
    if (!contacto.length) contacto = [{label:'📍 Av. Providencia 1234',url:'#'},{label:'📞 +56 9 8765 4321',url:'tel:+56987654321'},{label:'✉️ contacto@tiendamoda.com',url:'mailto:contacto@tiendamoda.com'},{label:'⏰ Lun - Vie: 9:00 - 18:00',url:'#'}];

    const renderLinks = (arr, prefix) => arr.map((l, i) => `
      <div class="footer-link-item" style="display:flex;gap:8px;align-items:center;background:var(--admin-bg);border:1px solid var(--admin-border);border-radius:6px;padding:7px 10px;">
        <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          <input class="admin-input" placeholder="Texto del enlace" value="${(l.label||'').replace(/"/g,'&quot;')}" id="${prefix}-label-${i}" style="font-size:12px">
          <input class="admin-input" placeholder="URL (ej: #/categoria/mujer)" value="${(l.url||'').replace(/"/g,'&quot;')}" id="${prefix}-url-${i}" style="font-size:12px">
        </div>
        <button type="button" onclick="this.closest('.footer-link-item').remove()" style="background:none;border:none;color:var(--admin-danger);cursor:pointer;font-size:18px;padding:2px 6px;">✕</button>
      </div>
    `).join('');

    content.innerHTML = `
      <form onsubmit="Admin.saveFooterSettings(event)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">

          <!-- Marca y descripción -->
          <div class="admin-card">
            <div class="card-header" style="padding:16px 20px;border-bottom:1px solid var(--admin-border)">
              <h3 style="margin:0;font-size:15px">🏪 Marca y Descripción</h3>
            </div>
            <div class="card-body">
              <div class="form-group">
                <label>Descripción del footer</label>
                <textarea name="footer_description" rows="3" style="resize:vertical">${s.footer_description||'Tu destino de moda online. Encuentra las últimas tendencias en ropa y accesorios para toda la familia.'}</textarea>
              </div>
              <div class="form-group">
                <label>Texto de copyright</label>
                <input name="footer_copyright" value="${s.footer_copyright||'© 2026 MODA STORE. Todos los derechos reservados.'}">
              </div>
            </div>
          </div>

          <!-- Redes Sociales -->
          <div class="admin-card">
            <div class="card-header" style="padding:16px 20px;border-bottom:1px solid var(--admin-border)">
              <h3 style="margin:0;font-size:15px">📱 Redes Sociales</h3>
              <p style="margin:4px 0 0;font-size:12px;color:var(--admin-text-muted)">Pega la URL completa o tu @usuario</p>
            </div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                ${[
                  {key:'instagram', icon:'📷', label:'Instagram', placeholder:'https://instagram.com/tutienda'},
                  {key:'facebook', icon:'📘', label:'Facebook', placeholder:'https://facebook.com/tutienda'},
                  {key:'tiktok', icon:'🎵', label:'TikTok', placeholder:'https://tiktok.com/@tutienda'},
                  {key:'twitter', icon:'🐦', label:'Twitter/X', placeholder:'https://twitter.com/tutienda'},
                  {key:'youtube', icon:'▶️', label:'YouTube', placeholder:'https://youtube.com/c/tutienda'},
                ].map(n => `
                  <div class="form-group">
                    <label>${n.icon} ${n.label}</label>
                    <input name="${n.key}" value="${s[n.key]||''}" placeholder="${n.placeholder}" style="font-size:12px">
                  </div>
                `).join('')}
                <div class="form-group">
                  <label>💬 WhatsApp</label>
                  <input value="${s.whatsapp_number||''}" disabled style="font-size:12px;opacity:0.6" title="Se configura en la sección WhatsApp">
                  <small style="color:var(--admin-text-muted)">Se gestiona en la sección WhatsApp</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Columnas del footer -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:20px">

          <!-- Tienda -->
          <div class="admin-card">
            <div class="card-header" style="padding:14px 16px;border-bottom:1px solid var(--admin-border)">
              <h3 style="margin:0;font-size:14px">🛍️ Columna "Tienda"</h3>
            </div>
            <div class="card-body">
              <div id="footer-tienda-links" style="display:flex;flex-direction:column;gap:7px;margin-bottom:10px">
                ${renderLinks(tienda, 'ft')}
              </div>
              <button type="button" onclick="Admin.addFooterLink('footer-tienda-links','ft')" class="btn-admin btn-admin-outline" style="width:100%;border-style:dashed;font-size:12px">+ Agregar enlace</button>
            </div>
          </div>

          <!-- Ayuda -->
          <div class="admin-card">
            <div class="card-header" style="padding:14px 16px;border-bottom:1px solid var(--admin-border)">
              <h3 style="margin:0;font-size:14px">❓ Columna "Ayuda"</h3>
            </div>
            <div class="card-body">
              <div id="footer-ayuda-links" style="display:flex;flex-direction:column;gap:7px;margin-bottom:10px">
                ${renderLinks(ayuda, 'fa')}
              </div>
              <button type="button" onclick="Admin.addFooterLink('footer-ayuda-links','fa')" class="btn-admin btn-admin-outline" style="width:100%;border-style:dashed;font-size:12px">+ Agregar enlace</button>
            </div>
          </div>

          <!-- Contacto -->
          <div class="admin-card">
            <div class="card-header" style="padding:14px 16px;border-bottom:1px solid var(--admin-border)">
              <h3 style="margin:0;font-size:14px">📍 Columna "Contacto"</h3>
            </div>
            <div class="card-body">
              <div id="footer-contacto-links" style="display:flex;flex-direction:column;gap:7px;margin-bottom:10px">
                ${renderLinks(contacto, 'fc')}
              </div>
              <button type="button" onclick="Admin.addFooterLink('footer-contacto-links','fc')" class="btn-admin btn-admin-outline" style="width:100%;border-style:dashed;font-size:12px">+ Agregar enlace</button>
            </div>
          </div>
        </div>

        <!-- Save -->
        <div class="admin-card">
          <div class="card-body" style="display:flex;align-items:center;gap:14px">
            <button type="submit" class="btn-admin btn-admin-primary">💾 Guardar Pie de Página</button>
            <span style="font-size:13px;color:var(--admin-text-muted)">Los cambios se verán reflejados en la tienda de inmediato</span>
          </div>
        </div>
      </form>
    `;
  },

  addFooterLink(containerId, prefix) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const i = container.querySelectorAll('.footer-link-item').length;
    const div = document.createElement('div');
    div.className = 'footer-link-item';
    div.style.cssText = 'display:flex;gap:8px;align-items:center;background:var(--admin-bg);border:1px solid var(--admin-border);border-radius:6px;padding:7px 10px;';
    div.innerHTML = `
      <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <input class="admin-input" placeholder="Texto del enlace" id="${prefix}-label-${i}" style="font-size:12px">
        <input class="admin-input" placeholder="URL" id="${prefix}-url-${i}" style="font-size:12px">
      </div>
      <button type="button" onclick="this.closest('.footer-link-item').remove()" style="background:none;border:none;color:var(--admin-danger);cursor:pointer;font-size:18px;padding:2px 6px">✕</button>
    `;
    container.appendChild(div);
  },

  _readFooterLinks(containerId, prefix) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const items = container.querySelectorAll('.footer-link-item');
    const links = [];
    items.forEach((_, i) => {
      const label = document.getElementById(`${prefix}-label-${i}`)?.value || '';
      const url = document.getElementById(`${prefix}-url-${i}`)?.value || '';
      if (label) links.push({ label, url });
    });
    return links;
  },

  async saveFooterSettings(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {};
    fd.forEach((v, k) => { body[k] = v; });
    // Collect link columns
    body.footer_tienda = JSON.stringify(this._readFooterLinks('footer-tienda-links', 'ft'));
    body.footer_ayuda = JSON.stringify(this._readFooterLinks('footer-ayuda-links', 'fa'));
    body.footer_contacto = JSON.stringify(this._readFooterLinks('footer-contacto-links', 'fc'));
    const res = await this.api('/api/dashboard/settings', { method: 'PUT', body: JSON.stringify(body) });
    if (res.ok || res.message) {
      this.toast('Pie de página guardado ✅');
    } else {
      this.toast(res.message || 'Error', 'error');
    }
  },

  // ============ PROMO BAR HELPERS ============

  togglePromoBar() {
    const cb = document.getElementById('promoBarEnabled');
    const toggle = document.getElementById('promoBarToggle');
    const label = document.getElementById('promoBarLabel');
    if (!cb || !toggle || !label) return;
    cb.checked = !cb.checked;
    const on = cb.checked;
    toggle.style.background = on ? '#22c55e' : '#e2e8f0';
    toggle.querySelector('div').style.left = on ? '25px' : '3px';
    label.textContent = on ? 'Activada' : 'Desactivada';
    label.style.color = on ? '#22c55e' : '#94a3b8';
  },

  _readPromoAnns() {
    const items = document.querySelectorAll('.promo-ann-item');
    const anns = [];
    items.forEach((item) => {
      const textInput = item.querySelector('input[id^="pa-text-"]');
      const colorInput = item.querySelector('input[id^="pa-color-"]');
      const highlightInput = item.querySelector('input[id^="pa-highlight-"]');
      const activeInput = item.querySelector('input[id^="pa-active-"]');
      anns.push({
        text: textInput?.value || '',
        color: colorInput?.value || '#1e293b',
        highlight: highlightInput?.value || '#00b894',
        active: activeInput?.checked ?? true
      });
    });
    return anns.filter(a => a.text);
  },

  addPromoAnn() {
    const container = document.getElementById('promo-announcements');
    if (!container) return;
    const i = container.querySelectorAll('.promo-ann-item').length;
    const div = document.createElement('div');
    div.className = 'promo-ann-item';
    div.style.cssText = 'display:flex;gap:10px;align-items:center;background:var(--admin-bg);border:1px solid var(--admin-border);border-radius:8px;padding:10px 14px';
    div.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;flex:1">
        <input class="admin-input" placeholder="Texto del anuncio (usa emojis)" id="pa-text-${i}" style="font-size:13px">
        <div style="display:flex;gap:8px;align-items:center">
          <label style="font-size:11px;color:var(--admin-text-muted)">Fondo:</label>
          <input type="color" id="pa-color-${i}" value="#1e293b" style="width:32px;height:28px;border:none;border-radius:4px;cursor:pointer">
          <label style="font-size:11px;color:var(--admin-text-muted)">Acento:</label>
          <input type="color" id="pa-highlight-${i}" value="#00b894" style="width:32px;height:28px;border:none;border-radius:4px;cursor:pointer">
          <div style="flex:1"></div>
          <label style="font-size:11px;color:var(--admin-text-muted)">Activo</label>
          <input type="checkbox" id="pa-active-${i}" checked style="width:16px;height:16px;cursor:pointer">
        </div>
      </div>
      <button type="button" onclick="this.closest('.promo-ann-item').remove()" style="background:none;border:none;color:var(--admin-danger);cursor:pointer;font-size:20px;padding:4px 8px">✕</button>
    `;
    container.appendChild(div);
  },

  removePromoAnn(idx) {
    const items = document.querySelectorAll('.promo-ann-item');
    if (items[idx]) items[idx].remove();
    // Re-index remaining items so IDs stay sequential
    document.querySelectorAll('.promo-ann-item').forEach((item, i) => {
      const textInput = item.querySelector('input[id^="pa-text-"]');
      const colorInput = item.querySelector('input[id^="pa-color-"]');
      const highlightInput = item.querySelector('input[id^="pa-highlight-"]');
      const activeInput = item.querySelector('input[id^="pa-active-"]');
      if (textInput) textInput.id = `pa-text-${i}`;
      if (colorInput) colorInput.id = `pa-color-${i}`;
      if (highlightInput) highlightInput.id = `pa-highlight-${i}`;
      if (activeInput) activeInput.id = `pa-active-${i}`;
      // Update remove button onclick
      const removeBtn = item.querySelector('button[onclick*="removePromoAnn"]');
      if (removeBtn) removeBtn.setAttribute('onclick', `Admin.removePromoAnn(${i})`);
    });
  },

  // ============ WHATSAPP ============
  async loadWhatsApp() {

    const content = document.getElementById('mainContent');
    const res = await this.api('/api/whatsapp/settings');
    const cfg = res.data || {};
    const msgs = Array.isArray(cfg.whatsapp_messages) ? cfg.whatsapp_messages : [];

    content.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">

        <!-- Tarjeta: Número y estado -->
        <div class="admin-card">
          <div class="card-header" style="background:linear-gradient(135deg,#25D366,#128C7E);color:white;border-radius:12px 12px 0 0;padding:18px 20px">
            <h3 style="margin:0;display:flex;align-items:center;gap:10px">
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Configuración de WhatsApp
            </h3>
          </div>
          <div class="card-body">
            <form class="admin-form" onsubmit="Admin.saveWhatsApp(event)">
              <div class="form-group">
                <label>Número de WhatsApp <span style="color:var(--admin-danger)">*</span></label>
                <input name="whatsapp_number" value="${cfg.whatsapp_number||''}" placeholder="+56987654321" required style="font-size:15px;font-weight:600">
                <small style="color:var(--admin-text-muted)">Incluye código de país sin espacios ni guiones. Ej: +56987654321</small>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                <div class="form-group">
                  <label>Botón flotante en tienda</label>
                  <select name="whatsapp_float_enabled">
                    <option value="1" ${cfg.whatsapp_float_enabled==='1'?'selected':''}>✅ Activado</option>
                    <option value="0" ${cfg.whatsapp_float_enabled==='0'?'selected':''}>❌ Desactivado</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Posición del botón</label>
                  <select name="whatsapp_float_position">
                    <option value="right" ${(cfg.whatsapp_float_position||'right')==='right'?'selected':''}>➡️ Derecha</option>
                    <option value="left" ${cfg.whatsapp_float_position==='left'?'selected':''}>⬅️ Izquierda</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label>WhatsApp habilitado globalmente</label>
                <select name="whatsapp_enabled">
                  <option value="1" ${cfg.whatsapp_enabled!=='0'?'selected':''}>✅ Habilitado</option>
                  <option value="0" ${cfg.whatsapp_enabled==='0'?'selected':''}>❌ Deshabilitado</option>
                </select>
              </div>

              <div class="form-group">
                <label>Mensaje de bienvenida (burbuja del chat)</label>
                <textarea name="whatsapp_greeting" rows="3" style="resize:vertical">${cfg.whatsapp_greeting||''}</textarea>
              </div>

              <div class="form-group">
                <label>Plantilla de pedido por WhatsApp</label>
                <textarea name="whatsapp_order_message" rows="10" style="resize:vertical;font-family:monospace;font-size:12px">${cfg.whatsapp_order_message||''}</textarea>
                <small style="color:var(--admin-text-muted)">Variables disponibles: <code>{{order_number}}</code> <code>{{customer_name}}</code> <code>{{customer_phone}}</code> <code>{{shipping_address}}</code> <code>{{shipping_city}}</code> <code>{{items}}</code> <code>{{subtotal}}</code> <code>{{shipping}}</code> <code>{{total}}</code> <code>{{payment_method}}</code></small>
              </div>

              <div style="margin-top:16px;border-top:1px solid var(--admin-border);padding-top:16px">
                <button type="submit" class="btn-admin btn-admin-primary" style="background:linear-gradient(135deg,#25D366,#128C7E)">💾 Guardar Configuración</button>
                <a href="https://wa.me/${(cfg.whatsapp_number||'').replace(/\D/g,'')}" target="_blank" class="btn-admin btn-admin-outline" style="margin-left:10px">🔗 Probar Número</a>
              </div>
            </form>
          </div>
        </div>

        <!-- Tarjeta: Mensajes Rápidos -->
        <div class="admin-card">
          <div class="card-header" style="padding:18px 20px;border-bottom:1px solid var(--admin-border)">
            <h3 style="margin:0;color:var(--admin-text)">💬 Mensajes Rápidos Predefinidos</h3>
            <p style="margin:4px 0 0;font-size:13px;color:var(--admin-text-muted)">Los clientes los verán como botones en el chat flotante</p>
          </div>
          <div class="card-body">
            <div id="wa-msgs-list" style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
              ${msgs.map((m,i) => `
                <div class="wa-msg-item" style="display:flex;gap:8px;align-items:flex-start;background:var(--admin-bg);border:1px solid var(--admin-border);border-radius:8px;padding:10px 12px">
                  <div style="flex:1">
                    <input class="admin-input" placeholder="Etiqueta del botón" value="${m.label||''}" id="wa-label-${i}" style="margin-bottom:6px;width:100%;font-weight:600;font-size:13px">
                    <input class="admin-input" placeholder="Texto del mensaje" value="${m.text||''}" id="wa-text-${i}" style="width:100%;font-size:12px">
                  </div>
                  <button type="button" onclick="Admin.removeWAMsg(${i})" style="background:none;border:none;color:var(--admin-danger);cursor:pointer;font-size:18px;padding:2px 6px;flex-shrink:0">✕</button>
                </div>
              `).join('')}
            </div>
            <button type="button" class="btn-admin btn-admin-outline" onclick="Admin.addWAMsg()" style="width:100%;border-style:dashed">+ Agregar Mensaje Rápido</button>
            <div style="margin-top:16px;border-top:1px solid var(--admin-border);padding-top:16px">
              <button type="button" class="btn-admin btn-admin-primary" onclick="Admin.saveWAMessages()" style="background:linear-gradient(135deg,#25D366,#128C7E)">💾 Guardar Mensajes</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Preview Widget -->
      <div class="admin-card">
        <div class="card-header" style="padding:18px 20px;border-bottom:1px solid var(--admin-border)">
          <h3 style="margin:0;color:var(--admin-text)">👁️ Vista Previa del Widget</h3>
        </div>
        <div class="card-body" style="background:#e5ddd5;padding:30px;border-radius:0 0 12px 12px">
          <div style="max-width:340px;margin:0 auto">
            <div style="background:white;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.15)">
              <div style="background:linear-gradient(135deg,#075E54,#128C7E);padding:14px 16px;display:flex;align-items:center;gap:10px;color:white">
                <div style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px">💬</div>
                <div>
                  <div style="font-weight:700;font-size:14px">MODA STORE</div>
                  <div style="font-size:11px;opacity:0.85">🟢 En línea</div>
                </div>
              </div>
              <div style="padding:14px;background:#f0f2f5">
                <div style="background:white;border-radius:10px 10px 10px 0;padding:10px 12px;max-width:85%;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
                  <p style="margin:0;font-size:13px;color:#111">¡Hola! 👋 ¿En qué podemos ayudarte?</p>
                  <span style="font-size:10px;color:#999">${new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              </div>
              <div style="padding:8px 12px 10px;background:#f0f2f5">
                <p style="font-size:10px;color:#777;margin:0 0 6px;font-weight:600;text-transform:uppercase">Mensajes rápidos:</p>
                <div style="display:flex;flex-wrap:wrap;gap:5px">
                  ${msgs.slice(0,3).map(m=>`<span style="background:white;border:1.5px solid #25D366;color:#128C7E;border-radius:20px;padding:4px 10px;font-size:11px;font-weight:500">💬 ${m.label}</span>`).join('')}
                </div>
              </div>
              <div style="background:white;display:flex;align-items:center;gap:8px;padding:8px 10px;border-top:1px solid #e5e7eb">
                <div style="flex:1;border:1.5px solid #e5e7eb;border-radius:20px;padding:6px 12px;font-size:12px;color:#999">Escribe un mensaje...</div>
                <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#25D366,#128C7E);display:flex;align-items:center;justify-content:center;color:white;font-size:14px">➤</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    this._waMsgs = [...msgs];
  },

  _waMsgs: [],

  addWAMsg() {
    this._waMsgs.push({ label: '', text: '' });
    this.loadWhatsApp();
  },

  removeWAMsg(idx) {
    this._waMsgs.splice(idx, 1);
    const list = document.getElementById('wa-msgs-list');
    list.querySelectorAll('.wa-msg-item').forEach((el, i) => { if (i === idx) el.remove(); });
    this._waMsgs = this._readWAMsgs();
    this._waMsgs.splice(idx, 1);
    this.loadWhatsApp();
  },

  _readWAMsgs() {
    const items = document.querySelectorAll('.wa-msg-item');
    const msgs = [];
    items.forEach((_, i) => {
      const lbl = document.getElementById(`wa-label-${i}`)?.value || '';
      const txt = document.getElementById(`wa-text-${i}`)?.value || '';
      msgs.push({ id: i+1, label: lbl, text: txt });
    });
    return msgs;
  },

  async saveWAMessages() {
    const msgs = this._readWAMsgs().filter(m => m.label || m.text);
    const current = await this.api('/api/whatsapp/settings');
    const cfg = current.data || {};
    const res = await this.api('/api/whatsapp/settings', {
      method: 'PUT',
      body: JSON.stringify({ ...cfg, whatsapp_messages: msgs })
    });
    if (res.ok) this.toast('Mensajes guardados ✅');
    else this.toast(res.message || 'Error', 'error');
  },

  async saveWhatsApp(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {};
    fd.forEach((v, k) => { body[k] = v; });
    // Preserve messages
    body.whatsapp_messages = this._readWAMsgs().filter(m => m.label || m.text);
    const res = await this.api('/api/whatsapp/settings', { method: 'PUT', body: JSON.stringify(body) });
    if (res.ok) {
      this.toast('Configuración de WhatsApp guardada ✅');
      this.loadWhatsApp();
    } else {
      this.toast(res.message || 'Error', 'error');
    }
  }
};

// Init on load
document.addEventListener('DOMContentLoaded', () => Admin.init());
