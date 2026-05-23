/* ============================================
   MODA STORE - Main Application JavaScript
   ============================================ */

const App = {
  cart: JSON.parse(localStorage.getItem('cart') || '[]'),
  user: null,
  settings: {},
  currentPage: 'home',

  async init() {
    await this.loadSettings();
    this.setupRouter();
    this.setupHeader();
    this.setupCartSidebar();
    this.updateCartCount();
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  },

  // ============ SETTINGS ============
  async loadSettings() {
    try {
      const res = await fetch('/api/settings/public');
      this.settings = await res.json();
    } catch (e) {
      this.settings = {};
    }
  },



  // ============ ROUTER ============
  setupRouter() { },

  handleRoute() {
    const hash = location.hash || '#/';
    const [path, queryString] = hash.slice(2).split('?');
    const params = new URLSearchParams(queryString || '');
    const segments = path.split('/').filter(Boolean);

    const main = document.getElementById('mainContent');
    if (!main) return;

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (path === '' || path === '/') this.renderHome(main);
    else if (path === 'productos' || path === 'ofertas') this.renderProducts(main, params, path === 'ofertas');
    else if (segments[0] === 'producto') this.renderProductDetail(main, segments[1]);
    else if (segments[0] === 'categoria') this.renderProducts(main, params, false, segments[1]);
    else if (path === 'carrito') this.renderCart(main);
    else if (path === 'checkout') this.renderCheckout(main);
    else if (segments[0] === 'buscar') this.renderProducts(main, params);
    else this.renderHome(main);
  },

  // ============ HEADER ============
  setupHeader() {
    const header = document.querySelector('.header');
    if (!header) return;

    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 50);
    });

    // Mobile navigation
    const menuToggle = document.getElementById('menuToggle');
    const mobileNav = document.getElementById('mobileNav');
    const mobileNavOverlay = document.getElementById('mobileNavOverlay');
    const mobileNavClose = document.getElementById('mobileNavClose');

    const openMobileNav = () => {
      mobileNav?.classList.add('active');
      mobileNavOverlay?.classList.add('active');
      document.body.style.overflow = 'hidden';
    };
    const closeMobileNav = () => {
      mobileNav?.classList.remove('active');
      mobileNavOverlay?.classList.remove('active');
      document.body.style.overflow = '';
    };

    if (menuToggle) menuToggle.addEventListener('click', openMobileNav);
    if (mobileNavClose) mobileNavClose.addEventListener('click', closeMobileNav);
    if (mobileNavOverlay) mobileNavOverlay.addEventListener('click', closeMobileNav);

    // Close mobile nav on link click
    document.querySelectorAll('.mobile-nav-links a').forEach(link => {
      link.addEventListener('click', closeMobileNav);
    });

    // Mobile search toggle
    const searchToggle = document.getElementById('searchToggle');
    const searchBar = document.querySelector('.search-bar');
    if (searchToggle && searchBar) {
      searchToggle.addEventListener('click', () => {
        searchBar.classList.toggle('mobile-open');
      });
    }

    // Search form
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchForm.querySelector('input').value.trim();
        if (query) location.hash = `#/buscar?q=${encodeURIComponent(query)}`;
      });
    }
  },

  // ============ CART SIDEBAR ============
  setupCartSidebar() {
    const overlay = document.getElementById('cartOverlay');
    const sidebar = document.getElementById('cartSidebar');
    const closeBtn = document.getElementById('cartClose');

    if (overlay) overlay.addEventListener('click', () => this.closeCart());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeCart());
  },

  openCart() {
    document.getElementById('cartOverlay')?.classList.add('open');
    document.getElementById('cartSidebar')?.classList.add('open');
    document.body.style.overflow = 'hidden';
    this.renderCartSidebar();
  },

  closeCart() {
    document.getElementById('cartOverlay')?.classList.remove('open');
    document.getElementById('cartSidebar')?.classList.remove('open');
    document.body.style.overflow = '';
  },

  renderCartSidebar() {
    const container = document.getElementById('cartItems');
    const footer = document.getElementById('cartFooter');
    if (!container || !footer) return;

    if (this.cart.length === 0) {
      container.innerHTML = `
        <div class="cart-empty">
          <div class="empty-icon">🛒</div>
          <h4>Tu carrito está vacío</h4>
          <p>Agrega productos para comenzar</p>
          <button class="btn btn-primary btn-sm" onclick="App.closeCart(); location.hash='#/productos'">Ver productos</button>
        </div>`;
      footer.style.display = 'none';
      return;
    }

    footer.style.display = 'block';
    container.innerHTML = this.cart.map((item, i) => {
      const sizes = item.availableSizes || [];
      const colors = item.availableColors || [];
      const colorVal = typeof item.color === 'object' ? (item.color?.name || '') : (item.color || '');

      const sizeSelector = sizes.length > 1 ? `
        <div class="cart-variant-row">
          <span class="cart-variant-label">Talla:</span>
          <select class="cart-variant-select" onchange="App.updateCartVariant(${i},'size',this.value)">
            ${sizes.map(s => `<option value="${s}" ${s === item.size ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>` : (item.size ? `<span class="item-variant-tag">Talla: ${item.size}</span>` : '');

      const colorSelector = colors.length > 1 ? `
        <div class="cart-variant-row">
          <span class="cart-variant-label">Color:</span>
          <div class="cart-color-picker">
            ${colors.map(c => {
              const cName = typeof c === 'object' ? c.name : c;
              const cHex = typeof c === 'object' ? c.hex : '#ccc';
              return `<button type="button" class="cart-color-dot ${cName === colorVal ? 'active' : ''}" style="background:${cHex}" title="${cName}" onclick="App.updateCartVariant(${i},'color','${cName}')"></button>`;
            }).join('')}
          </div>
        </div>` : (colorVal ? `<span class="item-variant-tag">${colorVal}</span>` : '');

      return `
        <div class="cart-item">
          <div class="cart-item-image">
            ${item.image ? `<img src="${item.image}" alt="${item.name}">` : `<span style="font-size:28px;color:#ccc;">👕</span>`}
          </div>
          <div class="cart-item-info">
            <h4>${item.name}</h4>
            <div class="cart-variants">
              ${sizeSelector}
              ${colorSelector}
            </div>
            <div class="item-price">$${this.formatPrice(item.price)}</div>
            <div class="cart-item-qty">
              <button onclick="App.updateCartQty(${i}, -1)">−</button>
              <span>${item.quantity}</span>
              <button onclick="App.updateCartQty(${i}, 1)">+</button>
            </div>
          </div>
          <button class="cart-item-remove" onclick="App.removeFromCart(${i})">✕</button>
        </div>
      `;
    }).join('');

    const subtotal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shippingMin = parseInt(this.settings.free_shipping_min || 50000);
    const shippingCost = subtotal >= shippingMin ? 0 : parseInt(this.settings.shipping_cost || 3990);

    footer.innerHTML = `
      <div class="cart-totals">
        <div class="cart-total-row"><span>Subtotal</span><span>$${this.formatPrice(subtotal)}</span></div>
        <div class="cart-total-row"><span>Envío</span><span>${shippingCost === 0 ? '<span style="color:var(--primary);font-weight:600;">Gratis</span>' : '$' + this.formatPrice(shippingCost)}</span></div>
        ${subtotal < shippingMin ? `<div style="font-size:12px;color:var(--primary);margin-top:4px;">Envío gratis desde $${this.formatPrice(shippingMin)}</div>` : ''}
        <div class="cart-total-row total"><span>Total</span><span>$${this.formatPrice(subtotal + shippingCost)}</span></div>
      </div>
      <button class="btn btn-primary btn-lg" onclick="App.closeCart(); location.hash='#/checkout'">Ir a pagar</button>
      <button class="btn btn-outline" onclick="App.closeCart(); location.hash='#/carrito'">Ver carrito completo</button>
    `;
  },

  addToCart(product, size = '', color = '', quantity = 1) {
    const existing = this.cart.findIndex(item =>
      item.id === product.id && item.size === size && item.color === color
    );

    const sizes = Array.isArray(product.sizes) ? product.sizes : (typeof product.sizes === 'string' ? JSON.parse(product.sizes || '[]') : []);
    const colors = Array.isArray(product.colors) ? product.colors : (typeof product.colors === 'string' ? JSON.parse(product.colors || '[]') : []);

    if (existing >= 0) {
      this.cart[existing].quantity += quantity;
    } else {
      this.cart.push({
        id: product.id,
        name: product.name,
        price: product.sale_price || product.price,
        image: product.images?.[0] || '',
        size,
        color,
        quantity,
        stock: product.stock,
        availableSizes: sizes,
        availableColors: colors
      });
    }

    this.saveCart();
    this.openCart();
    this.showToast('Producto agregado al carrito', 'success');
  },

  updateCartQty(index, delta) {
    if (this.cart[index]) {
      this.cart[index].quantity += delta;
      if (this.cart[index].quantity <= 0) this.cart.splice(index, 1);
      this.saveCart();
      this.renderCartSidebar();
    }
  },

  updateCartVariant(index, field, value) {
    if (!this.cart[index]) return;
    // If changing size/color creates a duplicate, merge quantities
    const newSize = field === 'size' ? value : this.cart[index].size;
    const newColor = field === 'color' ? value : this.cart[index].color;
    const dupIdx = this.cart.findIndex((it, i) =>
      i !== index && it.id === this.cart[index].id && it.size === newSize && it.color === newColor
    );
    if (dupIdx >= 0) {
      this.cart[dupIdx].quantity += this.cart[index].quantity;
      this.cart.splice(index, 1);
    } else {
      this.cart[index][field] = value;
    }
    this.saveCart();
    this.renderCartSidebar();
  },

  removeFromCart(index) {
    this.cart.splice(index, 1);
    this.saveCart();
    this.renderCartSidebar();
  },

  saveCart() {
    localStorage.setItem('cart', JSON.stringify(this.cart));
    this.updateCartCount();
  },

  updateCartCount() {
    const count = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cartCount');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  },

  // ============ HOME PAGE ============
  async renderHome(container) {
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    const [bannersRes, categoriesRes, featuredRes, newArrivalsRes] = await Promise.all([
      fetch('/api/dashboard/banners'),
      fetch('/api/categories'),
      fetch('/api/products?featured=1&limit=8'),
      fetch('/api/products?sort=newest&limit=8')
    ]);

    const banners = await bannersRes.json();
    const categoriesData = await categoriesRes.json();
    const featuredData = await featuredRes.json();
    const newArrivalsData = await newArrivalsRes.json();

    const categories = categoriesData.categories || [];
    const featured = featuredData.products || [];
    const newArrivals = newArrivalsData.products || [];

    container.innerHTML = `
      <!-- Promo Bar -->
      ${(() => {
        if (this.settings.promo_bar_enabled === '0') return '';
        let anns = [];
        try { anns = JSON.parse(this.settings.promo_announcements || '[]'); } catch(e) {}
        const activeAnns = anns.filter(a => a.active);
        if (!activeAnns.length) {
          // Fallback to legacy or default
          const txt = this.settings.promo_text || `🚚 <strong>ENVÍO GRATIS</strong> en compras sobre $${this.formatPrice(this.settings.free_shipping_min || 50000)}`;
          return `<div class="promo-bar"><div class="container">${txt}</div></div>`;
        }
        if (activeAnns.length === 1) {
          const a = activeAnns[0];
          return `<div class="promo-bar" style="background:${a.color||'#1e293b'};--promo-accent:${a.highlight||'#00b894'}"><div class="container">${a.text}</div></div>`;
        }
        // Multiple: rotating with animation
        return `
          <div id="promoBarWrap" style="overflow:hidden">
            ${activeAnns.map((a,i) => `
              <div class="promo-bar promo-slide" id="promo-slide-${i}" style="background:${a.color||'#1e293b'};display:${i===0?'block':'none'};--promo-accent:${a.highlight||'#00b894'}">
                <div class="container" style="display:flex;align-items:center;justify-content:center;gap:20px">
                  <span>${a.text}</span>
                  ${activeAnns.length > 1 ? `<span style="opacity:0.5;font-size:11px">${i+1}/${activeAnns.length}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      })()}

      <!-- Category Bar -->
      <div class="category-bar">
        <div class="container">
          <div class="category-bar-inner">
            <a href="#/productos" class="active">Todos</a>
            ${categories.map(cat => `
              <span class="separator"></span>
              <a href="#/categoria/${cat.slug}">${cat.name}</a>
            `).join('')}
            <span class="separator"></span>
            <a href="#/ofertas" style="color:var(--accent);font-weight:700;">🔥 Ofertas</a>
          </div>
        </div>
      </div>

      <!-- Hero Carousel -->
      <div class="hero" id="heroCarousel">
        <div class="hero-slides" id="heroSlides">
          ${banners.map(b => `
            <div class="hero-slide" style="background:${b.image ? `url('${b.image}') center/cover no-repeat` : b.bg_color};color:${b.text_color}">
              ${b.image ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,0.4);z-index:1;"></div>` : ''}
              <div class="hero-content" style="position:relative;z-index:2;">
                <h1>${b.title}</h1>
                <p>${b.subtitle}</p>
                <a href="${b.link || '#/productos'}" class="btn btn-white btn-lg">${b.button_text}</a>
              </div>
            </div>
          `).join('')}
        </div>
        ${banners.length > 1 ? `
          <button class="hero-nav prev" onclick="App.slideHero(-1)">‹</button>
          <button class="hero-nav next" onclick="App.slideHero(1)">›</button>
          <div class="hero-dots">
            ${banners.map((_, i) => `<button class="hero-dot ${i === 0 ? 'active' : ''}" onclick="App.goToSlide(${i})"></button>`).join('')}
          </div>
        ` : ''}
      </div>

      <!-- Features Bar -->
      <div class="features-bar">
        <div class="container">
          <div class="features-grid">
            <div class="feature-item">
              <div class="feature-icon">🚚</div>
              <div class="feature-text"><h4>${this.settings.feature_1_title || 'Envío Gratis'}</h4><p>${this.settings.feature_1_desc || `En compras sobre $${this.formatPrice(this.settings.free_shipping_min || 50000)}`}</p></div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🔄</div>
              <div class="feature-text"><h4>${this.settings.feature_2_title || 'Devolución Fácil'}</h4><p>${this.settings.feature_2_desc || '30 días para devolver'}</p></div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🔒</div>
              <div class="feature-text"><h4>${this.settings.feature_3_title || 'Pago Seguro'}</h4><p>${this.settings.feature_3_desc || 'Tus datos protegidos'}</p></div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">💬</div>
              <div class="feature-text"><h4>${this.settings.feature_4_title || 'Soporte 24/7'}</h4><p>${this.settings.feature_4_desc || 'Estamos para ayudarte'}</p></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Categories Section -->
      <div class="section">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title">Busca por categorías</h2>
            <a href="#/productos" class="btn btn-outline btn-sm">Ver todo</a>
          </div>
          <div class="categories-grid">
            ${categories.map(cat => {
              const icons = { 'Mujer': '👗', 'Hombre': '👔', 'Niños': '🧒', 'Accesorios': '👜' };
              return `
                <div class="category-card" onclick="location.hash='#/categoria/${cat.slug}'">
                  <div class="category-card-icon">${icons[cat.name] || '🏷️'}</div>
                  <h3>${cat.name}</h3>
                  <p>${cat.children?.length || 0} subcategorías</p>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Featured Products -->
      <div class="section" style="background:white;">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title">Productos Destacados</h2>
            <a href="#/productos?featured=1" class="btn btn-outline btn-sm">Ver más</a>
          </div>
          <div class="products-grid">
            ${featured.map(p => this.renderProductCard(p)).join('')}
          </div>
        </div>
      </div>

      <!-- New Arrivals -->
      <div class="section">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title">Recién Llegados</h2>
            <a href="#/productos?sort=newest" class="btn btn-outline btn-sm">Ver más</a>
          </div>
          <div class="products-grid">
            ${newArrivals.map(p => this.renderProductCard(p)).join('')}
          </div>
        </div>
      </div>

      <!-- Newsletter -->
      <div class="newsletter">
        <div class="container">
          <h2>${this.settings.newsletter_title || 'Únete a nuestra comunidad'}</h2>
          <p>${this.settings.newsletter_desc || 'Recibe ofertas exclusivas y las últimas tendencias directo en tu correo'}</p>
          <form class="newsletter-form" onsubmit="event.preventDefault(); App.showToast('¡Gracias por suscribirte!','success')">
            <input type="email" placeholder="Tu correo electrónico" required>
            <button type="submit">Suscribirse</button>
          </form>
        </div>
      </div>
    `;

    // Start hero auto-slide
    this.heroSlide = 0;
    this.heroTotal = banners.length;
    if (this.heroInterval) clearInterval(this.heroInterval);
    if (this.heroTotal > 1) {
      this.heroInterval = setInterval(() => this.slideHero(1), 5000);
    }

    // Start promo bar auto-slide
    if (this.promoInterval) clearInterval(this.promoInterval);
    const promoSlides = container.querySelectorAll('.promo-slide');
    if (promoSlides.length > 1) {
      let curPromo = 0;
      this.promoInterval = setInterval(() => {
        promoSlides[curPromo].style.display = 'none';
        curPromo = (curPromo + 1) % promoSlides.length;
        promoSlides[curPromo].style.display = 'block';
      }, 4000);
    }
  },

  heroSlide: 0,
  heroTotal: 0,

  slideHero(dir) {
    this.heroSlide = (this.heroSlide + dir + this.heroTotal) % this.heroTotal;
    this.goToSlide(this.heroSlide);
  },

  goToSlide(index) {
    this.heroSlide = index;
    const slides = document.getElementById('heroSlides');
    if (slides) slides.style.transform = `translateX(-${index * 100}%)`;

    document.querySelectorAll('.hero-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  },

  // ============ PRODUCTS PAGE ============
  async renderProducts(container, params = new URLSearchParams(), isOffers = false, categorySlug = '') {
    container.innerHTML = '<div class="page-content"><div class="container"><div class="loading-spinner"><div class="spinner"></div></div></div></div>';

    const searchQuery = params.get('q') || '';
    const sort = params.get('sort') || 'newest';
    const page = params.get('page') || 1;
    const featured = params.get('featured') || '';

    let apiUrl = `/api/products?page=${page}&limit=12&sort=${sort}`;
    if (searchQuery) apiUrl += `&search=${encodeURIComponent(searchQuery)}`;
    if (categorySlug) apiUrl += `&category=${categorySlug}`;
    if (isOffers) apiUrl += '&on_sale=1';
    if (featured) apiUrl += '&featured=1';

    const [productsRes, categoriesRes, brandsRes] = await Promise.all([
      fetch(apiUrl),
      fetch('/api/categories'),
      fetch('/api/products/brands')
    ]);

    const data = await productsRes.json();
    const cats = await categoriesRes.json();
    const brands = await brandsRes.json();
    const products = data.products || [];
    const pagination = data.pagination || {};

    const title = isOffers ? 'Ofertas' : categorySlug ? categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1).replace(/-/g, ' ') : searchQuery ? `Resultados: "${searchQuery}"` : 'Todos los productos';

    container.innerHTML = `
      <div class="page-content">
        <div class="container">
          <div class="breadcrumb">
            <a href="#/">Inicio</a> <span class="separator">›</span>
            <span>${title}</span>
          </div>
          <div class="products-page">
            <aside class="filters-sidebar" id="filtersSidebar">
              <button class="btn btn-sm" style="display:none;margin-bottom:16px;width:100%;" id="closeFilters" onclick="document.getElementById('filtersSidebar').classList.remove('open')">Cerrar filtros</button>
              <div class="filter-group">
                <h3>Categorías</h3>
                ${(cats.all || []).filter(c => !c.parent_id).map(c => `
                  <label class="filter-option">
                    <input type="checkbox" value="${c.slug}" ${categorySlug === c.slug ? 'checked' : ''} onchange="App.filterByCategory(this.value)">
                    ${c.name} <small style="color:var(--text-muted)">(${c.product_count})</small>
                  </label>
                `).join('')}
              </div>
              <div class="filter-group">
                <h3>Marcas</h3>
                ${brands.map(b => `
                  <label class="filter-option">
                    <input type="checkbox" value="${b}"> ${b}
                  </label>
                `).join('')}
              </div>
              <div class="filter-group">
                <h3>Precio</h3>
                <div class="price-range">
                  <input type="number" placeholder="Min" id="priceMin">
                  <span>-</span>
                  <input type="number" placeholder="Max" id="priceMax">
                </div>
                <button class="btn btn-sm btn-primary" style="width:100%;margin-top:10px;" onclick="App.applyPriceFilter()">Aplicar</button>
              </div>
              <div class="filter-group">
                <h3>Ofertas</h3>
                <label class="filter-option">
                  <input type="checkbox" ${isOffers ? 'checked' : ''} onchange="location.hash = this.checked ? '#/ofertas' : '#/productos'">
                  Solo productos en oferta
                </label>
              </div>
            </aside>
            <div class="products-main">
              <div class="toolbar">
                <span class="results-count">${pagination.total || 0} productos encontrados</span>
                <div style="display:flex;gap:10px;align-items:center;">
                  <button class="btn btn-sm" style="display:none;" id="filterToggle" onclick="document.getElementById('filtersSidebar').classList.add('open')">☰ Filtros</button>
                  <select onchange="App.changeSortOrder(this.value)" id="sortSelect">
                    <option value="newest" ${sort === 'newest' ? 'selected' : ''}>Más recientes</option>
                    <option value="price_asc" ${sort === 'price_asc' ? 'selected' : ''}>Menor precio</option>
                    <option value="price_desc" ${sort === 'price_desc' ? 'selected' : ''}>Mayor precio</option>
                    <option value="popular" ${sort === 'popular' ? 'selected' : ''}>Más vendidos</option>
                    <option value="name_asc" ${sort === 'name_asc' ? 'selected' : ''}>A - Z</option>
                  </select>
                </div>
              </div>
              ${products.length > 0 ? `
                <div class="products-grid">
                  ${products.map(p => this.renderProductCard(p)).join('')}
                </div>
                ${pagination.pages > 1 ? this.renderPagination(pagination) : ''}
              ` : `
                <div class="empty-state">
                  <div class="icon">🔍</div>
                  <h3>No se encontraron productos</h3>
                  <p>Intenta con otros filtros o busca algo diferente</p>
                  <a href="#/productos" class="btn btn-primary">Ver todos los productos</a>
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;

    // Show filter toggle on mobile
    if (window.innerWidth <= 768) {
      const toggle = document.getElementById('filterToggle');
      const closeBtn = document.getElementById('closeFilters');
      if (toggle) toggle.style.display = 'block';
      if (closeBtn) closeBtn.style.display = 'block';
    }
  },

  filterByCategory(slug) {
    location.hash = `#/categoria/${slug}`;
  },

  changeSortOrder(sort) {
    const hash = location.hash || '#/productos';
    const url = new URL('http://x' + hash.slice(1));
    url.searchParams.set('sort', sort);
    location.hash = '#' + url.pathname + url.search;
  },

  applyPriceFilter() {
    const min = document.getElementById('priceMin')?.value;
    const max = document.getElementById('priceMax')?.value;
    let hash = location.hash.includes('productos') ? location.hash : '#/productos';
    if (min) hash += (hash.includes('?') ? '&' : '?') + `min_price=${min}`;
    if (max) hash += (hash.includes('?') ? '&' : '?') + `max_price=${max}`;
    location.hash = hash;
  },

  renderPagination(pagination) {
    let html = '<div class="pagination">';
    if (pagination.page > 1) html += `<button onclick="App.goPage(${pagination.page - 1})">‹</button>`;
    for (let i = 1; i <= pagination.pages; i++) {
      if (i === 1 || i === pagination.pages || Math.abs(i - pagination.page) <= 2) {
        html += `<button class="${i === pagination.page ? 'active' : ''}" onclick="App.goPage(${i})">${i}</button>`;
      } else if (Math.abs(i - pagination.page) === 3) {
        html += `<button disabled>…</button>`;
      }
    }
    if (pagination.page < pagination.pages) html += `<button onclick="App.goPage(${pagination.page + 1})">›</button>`;
    html += '</div>';
    return html;
  },

  goPage(page) {
    const hash = location.hash || '#/productos';
    const url = new URL('http://x' + hash.slice(1));
    url.searchParams.set('page', page);
    location.hash = '#' + url.pathname + url.search;
  },

  // ============ PRODUCT CARD ============
  renderProductCard(product) {
    const hasDiscount = product.sale_price && product.sale_price < product.price;
    const discountPercent = hasDiscount ? Math.round((1 - product.sale_price / product.price) * 100) : 0;
    const displayPrice = hasDiscount ? product.sale_price : product.price;
    const colors = product.colors || [];
    const mainImage = product.images?.[0];

    return `
      <div class="product-card">
        <div class="product-card-image" onclick="location.hash='#/producto/${product.id}'" style="cursor:pointer">
          ${mainImage ? `<img src="${mainImage}" alt="${product.name}" loading="lazy">` : `<span class="placeholder-icon">👕</span>`}
          <div class="product-card-badges">
            ${hasDiscount ? `<span class="badge badge-sale">-${discountPercent}%</span>` : ''}
            ${product.stock <= 0 ? `<span class="badge badge-out">Agotado</span>` : ''}
          </div>
          <div class="product-card-actions">
            <button class="product-card-action" onclick="event.stopPropagation(); App.quickAdd(${product.id})" title="Agregar al carrito">🛒</button>
            <button class="product-card-action" onclick="event.stopPropagation(); location.hash='#/producto/${product.id}'" title="Ver detalle">👁️</button>
          </div>
        </div>
        <div class="product-card-body">
          <div class="product-card-category">${product.category_name || ''}</div>
          <h3 class="product-card-name" onclick="location.hash='#/producto/${product.id}'" style="cursor:pointer">${product.name}</h3>
          <div class="product-card-brand">${product.brand || ''}</div>
          ${colors.length > 0 ? `
            <div class="product-card-colors">
              ${colors.slice(0, 4).map(c => `<span class="color-dot" style="background:${c.hex}" title="${c.name}"></span>`).join('')}
              ${colors.length > 4 ? `<span style="font-size:11px;color:var(--text-muted)">+${colors.length - 4}</span>` : ''}
            </div>
          ` : ''}
          <div class="product-card-prices">
            <span class="price-current">$${this.formatPrice(displayPrice)}</span>
            ${hasDiscount ? `<span class="price-original">$${this.formatPrice(product.price)}</span>` : ''}
          </div>
          <button class="btn-add-cart" onclick="App.quickAdd(${product.id})" ${product.stock <= 0 ? 'disabled style="opacity:0.5"' : ''}>
            🛒 ${product.stock <= 0 ? 'Agotado' : 'Agregar al carrito'}
          </button>
        </div>
      </div>
    `;
  },

  async quickAdd(productId) {
    try {
      const res = await fetch(`/api/products/${productId}`);
      const product = await res.json();
      if (product.stock <= 0) return this.showToast('Producto agotado', 'error');
      const size = product.sizes?.[0] || '';
      const color = product.colors?.[0]?.name || '';
      this.addToCart(product, size, color);
    } catch (e) {
      this.showToast('Error al agregar producto', 'error');
    }
  },

  // ============ PRODUCT DETAIL ============
  async renderProductDetail(container, productId) {
    container.innerHTML = '<div class="page-content"><div class="container"><div class="loading-spinner"><div class="spinner"></div></div></div></div>';

    try {
      const res = await fetch(`/api/products/${productId}`);
      if (!res.ok) throw new Error();
      const product = await res.json();

      const hasDiscount = product.sale_price && product.sale_price < product.price;
      const discountPercent = hasDiscount ? Math.round((1 - product.sale_price / product.price) * 100) : 0;
      const colors = product.colors || [];
      const sizes = product.sizes || [];
      const images = product.images || [];
      const related = product.related || [];

      container.innerHTML = `
        <div class="page-content">
          <div class="container">
            <div class="breadcrumb">
              <a href="#/">Inicio</a> <span class="separator">›</span>
              ${product.category_name ? `<a href="#/categoria/${product.category_slug}">${product.category_name}</a> <span class="separator">›</span>` : ''}
              <span>${product.name}</span>
            </div>
            <div class="product-detail">
              <div class="product-detail-grid">
                <div class="product-gallery">
                  <div class="product-gallery-main" id="mainImage">
                    ${images.length > 0 ? `<img src="${images[0]}" alt="${product.name}">` : `<span style="font-size:80px;opacity:0.3;">👕</span>`}
                  </div>
                  ${images.length > 1 ? `
                    <div class="product-gallery-thumbs">
                      ${images.map((img, i) => `
                        <div class="product-gallery-thumb ${i === 0 ? 'active' : ''}" onclick="App.changeImage('${img}', this)">
                          <img src="${img}" alt="">
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
                <div class="product-info">
                  <h1>${product.name}</h1>
                  <div class="product-brand">${product.brand || ''} ${product.sku ? `• SKU: ${product.sku}` : ''}</div>
                  <div class="product-prices">
                    <span class="current">$${this.formatPrice(hasDiscount ? product.sale_price : product.price)}</span>
                    ${hasDiscount ? `<span class="original">$${this.formatPrice(product.price)}</span><span class="discount-badge">-${discountPercent}%</span>` : ''}
                  </div>
                  <p class="product-description">${product.description}</p>

                  ${sizes.length > 0 ? `
                    <div class="product-option-group">
                      <label>Talla: <span id="selectedSize">${sizes[0]}</span></label>
                      <div class="size-options">
                        ${sizes.map((s, i) => `<button class="size-option ${i === 0 ? 'active' : ''}" onclick="App.selectSize(this, '${s}')">${s}</button>`).join('')}
                      </div>
                    </div>
                  ` : ''}

                  ${colors.length > 0 ? `
                    <div class="product-option-group">
                      <label>Color: <span id="selectedColor">${colors[0].name}</span></label>
                      <div class="color-options">
                        ${colors.map((c, i) => `<button class="color-option ${i === 0 ? 'active' : ''}" style="background:${c.hex}" title="${c.name}" onclick="App.selectColor(this, '${c.name}')"></button>`).join('')}
                      </div>
                    </div>
                  ` : ''}

                  <div class="product-option-group">
                    <label>Cantidad</label>
                    <div class="quantity-selector">
                      <button class="quantity-btn" onclick="App.changeQty(-1)">−</button>
                      <input type="number" class="quantity-input" id="productQty" value="1" min="1" max="${product.stock}">
                      <button class="quantity-btn" onclick="App.changeQty(1)">+</button>
                    </div>
                  </div>

                  <div class="product-actions-main">
                    <button class="btn btn-primary btn-lg" onclick="App.addProductToCart()" ${product.stock <= 0 ? 'disabled' : ''} id="addToCartBtn">
                      🛒 ${product.stock <= 0 ? 'Agotado' : 'Agregar al carrito'}
                    </button>
                    <button class="btn btn-secondary btn-lg" onclick="App.addProductToCart(); App.closeCart(); location.hash='#/checkout';" ${product.stock <= 0 ? 'disabled' : ''}>
                      ⚡ Comprar ahora
                    </button>
                  </div>

                  <div class="product-stock">
                    <span class="stock-indicator ${product.stock > 10 ? 'stock-in' : product.stock > 0 ? 'stock-low' : 'stock-out'}"></span>
                    ${product.stock > 10 ? 'En stock' : product.stock > 0 ? `¡Solo quedan ${product.stock} unidades!` : 'Agotado'}
                  </div>
                </div>
              </div>
            </div>

            ${related.length > 0 ? `
              <div class="section">
                <h2 class="section-title">Productos Relacionados</h2>
                <div class="products-grid">
                  ${related.map(p => this.renderProductCard(p)).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      // Store current product data
      this._currentProduct = product;
      this._selectedSize = sizes[0] || '';
      this._selectedColor = colors[0]?.name || '';

    } catch (e) {
      container.innerHTML = `<div class="page-content"><div class="container"><div class="empty-state"><div class="icon">😕</div><h3>Producto no encontrado</h3><a href="#/productos" class="btn btn-primary">Ver productos</a></div></div></div>`;
    }
  },

  changeImage(src, thumb) {
    const main = document.getElementById('mainImage');
    if (main) main.innerHTML = `<img src="${src}" alt="">`;
    document.querySelectorAll('.product-gallery-thumb').forEach(t => t.classList.remove('active'));
    thumb?.classList.add('active');
  },

  selectSize(btn, size) {
    document.querySelectorAll('.size-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this._selectedSize = size;
    const label = document.getElementById('selectedSize');
    if (label) label.textContent = size;
  },

  selectColor(btn, color) {
    document.querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this._selectedColor = color;
    const label = document.getElementById('selectedColor');
    if (label) label.textContent = color;
  },

  changeQty(delta) {
    const input = document.getElementById('productQty');
    if (!input) return;
    let val = parseInt(input.value) + delta;
    const max = parseInt(input.max) || 99;
    if (val < 1) val = 1;
    if (val > max) val = max;
    input.value = val;
  },

  addProductToCart() {
    if (!this._currentProduct) return;
    const qty = parseInt(document.getElementById('productQty')?.value || 1);
    this.addToCart(this._currentProduct, this._selectedSize, this._selectedColor, qty);
  },

  // ============ CART PAGE ============
  renderCart(container) {
    if (this.cart.length === 0) {
      container.innerHTML = `
        <div class="page-content"><div class="container">
          <div class="empty-state" style="padding:100px 20px;">
            <div class="icon">🛒</div>
            <h3>Tu carrito está vacío</h3>
            <p>¡Explora nuestra colección y encuentra algo que te encante!</p>
            <a href="#/productos" class="btn btn-primary btn-lg">Explorar productos</a>
          </div>
        </div></div>`;
      return;
    }

    const subtotal = this.cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const shippingMin = parseInt(this.settings.free_shipping_min || 50000);
    const shippingCost = subtotal >= shippingMin ? 0 : parseInt(this.settings.shipping_cost || 3990);

    container.innerHTML = `
      <div class="page-content"><div class="container">
        <div class="breadcrumb"><a href="#/">Inicio</a> <span class="separator">›</span> <span>Carrito</span></div>
        <h1 style="font-family:'Playfair Display',serif;font-size:28px;margin-bottom:24px;">Mi Carrito (${this.cart.length})</h1>
        <div class="checkout-grid">
          <div>
            ${this.cart.map((item, i) => `
              <div class="cart-item" style="background:white;padding:20px;border-radius:var(--radius);margin-bottom:12px;box-shadow:var(--shadow-sm);">
                <div class="cart-item-image" style="width:100px;height:120px;">
                  ${item.image ? `<img src="${item.image}" alt="${item.name}">` : `<span style="font-size:36px;color:#ccc;">👕</span>`}
                </div>
                <div class="cart-item-info" style="flex:1;">
                  <h4 style="font-size:16px;">${item.name}</h4>
                  <div class="item-variant">${item.size ? 'Talla: ' + item.size : ''} ${item.color ? '• Color: ' + item.color : ''}</div>
                  <div class="item-price" style="font-size:18px;margin-top:8px;">$${this.formatPrice(item.price)}</div>
                  <div class="cart-item-qty" style="margin-top:10px;">
                    <button onclick="App.updateCartItem(${i}, -1)">−</button>
                    <span>${item.quantity}</span>
                    <button onclick="App.updateCartItem(${i}, 1)">+</button>
                  </div>
                </div>
                <div style="text-align:right;">
                  <div style="font-weight:700;font-size:18px;margin-bottom:12px;">$${this.formatPrice(item.price * item.quantity)}</div>
                  <button class="cart-item-remove" onclick="App.removeCartItem(${i})" style="font-size:14px;color:var(--accent);">Eliminar</button>
                </div>
              </div>
            `).join('')}
          </div>
          <div>
            <div class="order-summary-card">
              <h3>Resumen del pedido</h3>
              <div class="cart-totals">
                <div class="cart-total-row"><span>Subtotal</span><span>$${this.formatPrice(subtotal)}</span></div>
                <div class="cart-total-row"><span>Envío</span><span>${shippingCost === 0 ? '<span style="color:var(--primary);">Gratis</span>' : '$' + this.formatPrice(shippingCost)}</span></div>
                <div class="cart-total-row total"><span>Total</span><span>$${this.formatPrice(subtotal + shippingCost)}</span></div>
              </div>
              <button class="btn btn-primary btn-lg" style="width:100%;margin-bottom:10px;" onclick="location.hash='#/checkout'">Ir a pagar</button>
              <button class="btn btn-outline" style="width:100%;" onclick="location.hash='#/productos'">Seguir comprando</button>
            </div>
          </div>
        </div>
      </div></div>`;
  },

  updateCartItem(index, delta) {
    this.updateCartQty(index, delta);
    this.renderCart(document.getElementById('mainContent'));
  },

  removeCartItem(index) {
    this.removeFromCart(index);
    this.renderCart(document.getElementById('mainContent'));
  },

  // ============ CHECKOUT ============
  renderCheckout(container) {
    if (this.cart.length === 0) {
      location.hash = '#/carrito';
      return;
    }

    const subtotal = this.cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const shippingMin = parseInt(this.settings.free_shipping_min || 50000);
    const shippingCost = subtotal >= shippingMin ? 0 : parseInt(this.settings.shipping_cost || 3990);

    container.innerHTML = `
      <div class="page-content"><div class="container">
        <div class="breadcrumb"><a href="#/">Inicio</a> <span class="separator">›</span> <a href="#/carrito">Carrito</a> <span class="separator">›</span> <span>Checkout</span></div>
        <h1 style="font-family:'Playfair Display',serif;font-size:28px;margin-bottom:24px;">Finalizar Compra</h1>
        <div class="checkout-grid">
          <div>
            <div class="checkout-form-section">
              <h2>📦 Información de envío</h2>
              <div class="form-row">
                <div class="form-group"><label>Nombre completo *</label><input type="text" id="ckName" value="${this.user?.name || ''}" required></div>
                <div class="form-group"><label>Email *</label><input type="email" id="ckEmail" value="${this.user?.email || ''}" required></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label>Teléfono</label><input type="tel" id="ckPhone" value="${this.user?.phone || ''}"></div>
                <div class="form-group"><label>Ciudad</label><input type="text" id="ckCity" value="${this.user?.city || ''}"></div>
              </div>
              <div class="form-group"><label>Dirección de envío *</label><input type="text" id="ckAddress" value="${this.user?.address || ''}" placeholder="Calle, número, depto..." required></div>
              <div class="form-group"><label>Notas (opcional)</label><textarea id="ckNotes" rows="3" placeholder="Instrucciones de entrega..."></textarea></div>
            </div>
            <div class="checkout-form-section">
              <h2>💳 Método de pago</h2>
              <div style="display:flex;flex-direction:column;gap:10px;">
                ${(() => {
                  let opts = [];
                  if (this.settings.pm_card_enabled !== '0') {
                    opts.push(`<label class="filter-option" style="padding:14px;border:2px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;"><input type="radio" name="payment" value="tarjeta" ${opts.length===0?'checked':''}> 💳 Tarjeta de crédito/débito</label>`);
                  }
                  if (this.settings.pm_transfer_enabled !== '0') {
                    const desc = this.settings.pm_transfer_instructions;
                    const details = desc ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px;margin-left:24px;line-height:1.4">${desc.replace(/\n/g, '<br>')}</div>` : '';
                    opts.push(`<label class="filter-option" style="padding:14px;border:2px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;"><input type="radio" name="payment" value="transferencia" ${opts.length===0?'checked':''}> 🏦 Transferencia bancaria${details}</label>`);
                  }
                  if (this.settings.pm_cash_enabled !== '0') {
                    opts.push(`<label class="filter-option" style="padding:14px;border:2px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;"><input type="radio" name="payment" value="efectivo" ${opts.length===0?'checked':''}> 💵 Pago contra entrega</label>`);
                  }
                  if (opts.length === 0) {
                    return `<p style="font-size:13px;color:var(--danger)">Contacte al administrador. No hay métodos de pago disponibles.</p>`;
                  }
                  return opts.join('');
                })()}
              </div>
            </div>
            <div class="checkout-form-section">
              <h2>🏷️ Cupón de descuento</h2>
              <div style="display:flex;gap:10px;">
                <input type="text" id="couponCode" placeholder="Ingresa tu cupón" style="flex:1;padding:10px 14px;border:1.5px solid var(--border);border-radius:var(--radius-sm);">
                <button class="btn btn-outline" onclick="App.applyCoupon()">Aplicar</button>
              </div>
              <div id="couponResult" style="margin-top:10px;"></div>
            </div>
          </div>
          <div>
            <div class="order-summary-card">
              <h3>Resumen del pedido</h3>
              ${this.cart.map(item => `
                <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border-light);">
                  <div style="width:50px;height:60px;background:var(--bg);border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">
                    ${item.image ? `<img src="${item.image}" style="width:100%;height:100%;object-fit:cover;">` : '👕'}
                  </div>
                  <div style="flex:1;">
                    <div style="font-size:13px;font-weight:600;">${item.name}</div>
                    <div style="font-size:11px;color:var(--text-muted);">${item.size || ''} ${item.color ? '• ' + item.color : ''} × ${item.quantity}</div>
                  </div>
                  <div style="font-weight:600;">$${this.formatPrice(item.price * item.quantity)}</div>
                </div>
              `).join('')}
              <div class="cart-totals" style="margin-top:16px;">
                <div class="cart-total-row"><span>Subtotal</span><span>$${this.formatPrice(subtotal)}</span></div>
                <div class="cart-total-row"><span>Envío</span><span>${shippingCost === 0 ? '<span style="color:var(--primary);">Gratis</span>' : '$' + this.formatPrice(shippingCost)}</span></div>
                <div class="cart-total-row" id="discountRow" style="display:none;"><span>Descuento</span><span id="discountAmount" style="color:var(--primary);">-$0</span></div>
                <div class="cart-total-row total"><span>Total</span><span id="checkoutTotal">$${this.formatPrice(subtotal + shippingCost)}</span></div>
              </div>
              <button class="btn btn-primary btn-lg" style="width:100%;margin-top:16px;" onclick="App.placeOrder()">Confirmar pedido</button>
              <p style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:12px;">Al confirmar, aceptas nuestros términos y condiciones</p>
            </div>
          </div>
        </div>
      </div></div>`;

    this._couponDiscount = 0;
    this._couponCode = '';
  },

  async applyCoupon() {
    const code = document.getElementById('couponCode')?.value?.trim();
    if (!code) return;

    const subtotal = this.cart.reduce((s, i) => s + i.price * i.quantity, 0);

    try {
      const res = await fetch('/api/orders/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal })
      });
      const data = await res.json();

      if (!res.ok) {
        document.getElementById('couponResult').innerHTML = `<span style="color:var(--accent);font-size:13px;">❌ ${data.error}</span>`;
        return;
      }

      this._couponDiscount = data.discount_amount || 0;
      this._couponCode = code;

      const shippingMin = parseInt(this.settings.free_shipping_min || 50000);
      const shippingCost = subtotal >= shippingMin ? 0 : parseInt(this.settings.shipping_cost || 3990);

      document.getElementById('couponResult').innerHTML = `<span style="color:var(--primary);font-size:13px;">✅ ${data.description}</span>`;
      document.getElementById('discountRow').style.display = 'flex';
      document.getElementById('discountAmount').textContent = `-$${this.formatPrice(this._couponDiscount)}`;
      document.getElementById('checkoutTotal').textContent = `$${this.formatPrice(subtotal + shippingCost - this._couponDiscount)}`;
    } catch (e) {
      document.getElementById('couponResult').innerHTML = `<span style="color:var(--accent);font-size:13px;">❌ Error al validar cupón</span>`;
    }
  },

  async placeOrder() {
    const name = document.getElementById('ckName')?.value?.trim();
    const email = document.getElementById('ckEmail')?.value?.trim();
    const phone = document.getElementById('ckPhone')?.value?.trim();
    const address = document.getElementById('ckAddress')?.value?.trim();
    const city = document.getElementById('ckCity')?.value?.trim();
    const notes = document.getElementById('ckNotes')?.value?.trim();
    const payment = document.querySelector('input[name="payment"]:checked')?.value;

    if (!name || !email || !address) {
      return this.showToast('Completa los campos obligatorios', 'error');
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = localStorage.getItem('token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          customer_name: name,
          customer_email: email,
          customer_phone: phone,
          shipping_address: address,
          shipping_city: city,
          payment_method: payment,
          notes,
          coupon_code: this._couponCode || '',
          items: this.cart.map(item => ({
            product_id: item.id,
            quantity: item.quantity,
            size: item.size,
            color: item.color
          }))
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Clear cart
      this.cart = [];
      this.saveCart();

      // Show success
      const waConfig = (typeof WAWidget !== 'undefined' && WAWidget.config) ? WAWidget.config : {};
      const waEnabled = waConfig.whatsapp_enabled === '1' && waConfig.whatsapp_number;

      document.getElementById('mainContent').innerHTML = `
        <div class="page-content"><div class="container">
          <div style="max-width:560px;margin:60px auto;text-align:center;">
            
            <!-- Confetti Header -->
            <div style="font-size:80px;margin-bottom:16px;animation:wa-bounce 0.6s ease">🎉</div>
            <h3 style="font-size:26px;color:var(--secondary);margin-bottom:8px;">¡Pedido realizado con éxito!</h3>
            <p style="font-size:15px;color:var(--text-muted);margin-bottom:24px;">
              Te enviaremos los detalles a <strong>${email}</strong>
            </p>

            <!-- Order Summary Card -->
            <div style="background:white;border-radius:16px;border:1px solid var(--border);box-shadow:0 4px 20px rgba(0,0,0,0.06);padding:24px;margin-bottom:24px;text-align:left;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
                <div>
                  <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Número de pedido</div>
                  <div style="font-size:20px;font-weight:700;color:var(--secondary)">#${data.order_number}</div>
                </div>
                <span style="background:#dcfce7;color:#15803d;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;">✅ Confirmado</span>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;">
                <div><span style="color:var(--text-muted)">Cliente:</span><br><strong>${data.customer_name || name}</strong></div>
                <div><span style="color:var(--text-muted)">Pago:</span><br><strong>${data.payment_method || payment}</strong></div>
                <div><span style="color:var(--text-muted)">Total:</span><br><strong style="font-size:16px;color:var(--primary)">$${Number(data.total).toLocaleString('es-CL')}</strong></div>
                <div><span style="color:var(--text-muted)">Dirección:</span><br><strong>${address}, ${city}</strong></div>
              </div>
            </div>

            <!-- WhatsApp Button -->
            ${waEnabled ? `
              <div style="background:linear-gradient(135deg,#dcfce7,#bbf7d0);border:1px solid #86efac;border-radius:14px;padding:18px;margin-bottom:20px">
                <p style="margin:0 0 12px;font-size:14px;color:#15803d;font-weight:600;">📱 ¿Quieres confirmar tu pedido por WhatsApp?</p>
                <p style="margin:0 0 14px;font-size:12px;color:#166534;">Envía tu pedido directamente a nuestra tienda y recibe atención personalizada</p>
                <button onclick="App._sendOrderWhatsApp()" style="width:100%;padding:14px;background:linear-gradient(135deg,#25D366,#128C7E);color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                  <svg viewBox="0 0 24 24" fill="white" width="20" height="20"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Enviar pedido por WhatsApp
                </button>
              </div>
            ` : ''}

            <!-- Back to store -->
            <div style="display:flex;gap:12px;justify-content:center;">
              <a href="#/" class="btn btn-primary btn-lg">🛍️ Seguir comprando</a>
            </div>
          </div>
        </div></div>`;

      // Store order data for WA button
      App._lastOrder = data;
      App._lastOrderEmail = email;

    } catch (e) {
      this.showToast(e.message || 'Error al procesar el pedido', 'error');
    }
  },

  _lastOrder: null,

  _sendOrderWhatsApp() {
    const order = App._lastOrder;
    if (!order) return;

    if (typeof WAWidget !== 'undefined' && WAWidget.config?.whatsapp_number) {
      WAWidget.sendOrder({
        order_number: order.order_number || order.id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        shipping_address: order.shipping_address,
        shipping_city: order.shipping_city,
        items: order.items || [],
        subtotal: order.subtotal,
        shipping_cost: order.shipping_cost,
        total: order.total,
        payment_method: order.payment_method
      });
    }
  },

  // ============ AUTH PAGES ============

  renderLogin(container) {
    container.innerHTML = `
      <div class="page-content"><div class="auth-page">
        <div class="auth-card">
          <h1>Bienvenido</h1>
          <p class="subtitle">Inicia sesión en tu cuenta</p>
          <form onsubmit="event.preventDefault(); App.doLogin()">
            <div class="form-group"><label>Email</label><input type="email" id="loginEmail" required placeholder="tu@email.com"></div>
            <div class="form-group"><label>Contraseña</label><input type="password" id="loginPass" required placeholder="••••••"></div>
            <button type="submit" class="btn btn-primary">Iniciar Sesión</button>
          </form>
          <p class="auth-link">¿No tienes cuenta? <a href="#/registro">Regístrate aquí</a></p>
        </div>
      </div></div>`;
  },

  async doLogin() {
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPass')?.value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      this.user = data.user;
      this.updateAuthUI();
      this.showToast('¡Bienvenido!', 'success');

      if (this.user.role === 'admin') {
        window.location.href = '/admin';
      } else {
        location.hash = '#/';
      }
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  renderRegister(container) {
    container.innerHTML = `
      <div class="page-content"><div class="auth-page">
        <div class="auth-card">
          <h1>Crear cuenta</h1>
          <p class="subtitle">Regístrate para comprar</p>
          <form onsubmit="event.preventDefault(); App.doRegister()">
            <div class="form-group"><label>Nombre completo</label><input type="text" id="regName" required placeholder="Tu nombre"></div>
            <div class="form-group"><label>Email</label><input type="email" id="regEmail" required placeholder="tu@email.com"></div>
            <div class="form-group"><label>Teléfono</label><input type="tel" id="regPhone" placeholder="+56 9 1234 5678"></div>
            <div class="form-group"><label>Contraseña</label><input type="password" id="regPass" required minlength="6" placeholder="Mínimo 6 caracteres"></div>
            <button type="submit" class="btn btn-primary">Crear cuenta</button>
          </form>
          <p class="auth-link">¿Ya tienes cuenta? <a href="#/login">Inicia sesión</a></p>
        </div>
      </div></div>`;
  },

  async doRegister() {
    const name = document.getElementById('regName')?.value;
    const email = document.getElementById('regEmail')?.value;
    const phone = document.getElementById('regPhone')?.value;
    const password = document.getElementById('regPass')?.value;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, phone, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      this.user = data.user;
      this.updateAuthUI();
      this.showToast('¡Cuenta creada exitosamente!', 'success');
      location.hash = '#/';
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  // ============ ACCOUNT PAGE ============
  async renderAccount(container) {
    if (!this.user) {
      location.hash = '#/login';
      return;
    }

    let ordersHtml = '<div class="loading-spinner"><div class="spinner"></div></div>';

    container.innerHTML = `
      <div class="page-content"><div class="container">
        <div class="breadcrumb"><a href="#/">Inicio</a> <span class="separator">›</span> <span>Mi cuenta</span></div>
        <div class="account-grid">
          <div class="account-sidebar">
            <div class="user-info">
              <div class="user-avatar">${this.user.name.charAt(0).toUpperCase()}</div>
              <h3>${this.user.name}</h3>
              <p>${this.user.email}</p>
            </div>
            <nav>
              <a href="#" class="active" onclick="event.preventDefault(); App.showAccountTab('orders')">📦 Mis pedidos</a>
              <a href="#" onclick="event.preventDefault(); App.showAccountTab('profile')">👤 Mi perfil</a>
              <a href="#" onclick="event.preventDefault(); App.showAccountTab('password')">🔒 Cambiar contraseña</a>
              <a href="#" onclick="event.preventDefault(); App.doLogout()" style="color:var(--accent);">🚪 Cerrar sesión</a>
            </nav>
          </div>
          <div class="account-content" id="accountContent">${ordersHtml}</div>
        </div>
      </div></div>`;

    this.showAccountTab('orders');
  },

  async showAccountTab(tab) {
    const content = document.getElementById('accountContent');
    if (!content) return;

    // Update active nav
    document.querySelectorAll('.account-sidebar nav a').forEach(a => a.classList.remove('active'));

    if (tab === 'orders') {
      content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
      try {
        const res = await fetch('/api/orders', { credentials: 'include' });
        const data = await res.json();
        const orders = data.orders || [];

        if (orders.length === 0) {
          content.innerHTML = `<div class="empty-state"><div class="icon">📦</div><h3>No tienes pedidos aún</h3><p>¡Haz tu primera compra!</p><a href="#/productos" class="btn btn-primary">Explorar productos</a></div>`;
        } else {
          content.innerHTML = `
            <h2 style="font-size:20px;margin-bottom:20px;">Mis Pedidos</h2>
            <table class="orders-table">
              <thead><tr><th>Pedido</th><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead>
              <tbody>
                ${orders.map(o => `
                  <tr>
                    <td><strong>${o.order_number}</strong></td>
                    <td>${new Date(o.created_at).toLocaleDateString('es')}</td>
                    <td><strong>$${this.formatPrice(o.total)}</strong></td>
                    <td><span class="status-badge status-${o.status}">${o.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`;
        }
      } catch (e) {
        content.innerHTML = '<p>Error al cargar pedidos</p>';
      }
    } else if (tab === 'profile') {
      content.innerHTML = `
        <h2 style="font-size:20px;margin-bottom:20px;">Mi Perfil</h2>
        <form onsubmit="event.preventDefault(); App.updateProfile()">
          <div class="form-row">
            <div class="form-group"><label>Nombre</label><input type="text" id="profName" value="${this.user.name}"></div>
            <div class="form-group"><label>Teléfono</label><input type="tel" id="profPhone" value="${this.user.phone || ''}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Ciudad</label><input type="text" id="profCity" value="${this.user.city || ''}"></div>
            <div class="form-group"><label>Dirección</label><input type="text" id="profAddress" value="${this.user.address || ''}"></div>
          </div>
          <button type="submit" class="btn btn-primary">Guardar cambios</button>
        </form>`;
    } else if (tab === 'password') {
      content.innerHTML = `
        <h2 style="font-size:20px;margin-bottom:20px;">Cambiar Contraseña</h2>
        <form onsubmit="event.preventDefault(); App.changePassword()" style="max-width:400px;">
          <div class="form-group"><label>Contraseña actual</label><input type="password" id="curPass" required></div>
          <div class="form-group"><label>Nueva contraseña</label><input type="password" id="newPass" required minlength="6"></div>
          <button type="submit" class="btn btn-primary">Cambiar contraseña</button>
        </form>`;
    }
  },

  async updateProfile() {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: document.getElementById('profName')?.value,
          phone: document.getElementById('profPhone')?.value,
          address: document.getElementById('profAddress')?.value,
          city: document.getElementById('profCity')?.value
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      this.user = data.user;
      this.updateAuthUI();
      this.showToast('Perfil actualizado', 'success');
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  async changePassword() {
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: document.getElementById('curPass')?.value,
          newPassword: document.getElementById('newPass')?.value
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      this.showToast('Contraseña actualizada', 'success');
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  async doLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    this.user = null;
    this.updateAuthUI();
    location.hash = '#/';
    this.showToast('Sesión cerrada', 'success');
  },

  // ============ UTILITIES ============
  formatPrice(price) {
    return Math.round(price).toLocaleString('es-CL');
  },

  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️' };
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

// Initialize when DOM loaded
document.addEventListener('DOMContentLoaded', () => App.init());
