/* WebForge Builder — lógica del panel */
(function () {
  const $ = (id) => document.getElementById(id);
  let currentPage = 'index';
  let knownPages = ['index'];

  const PAGE_LABELS = {
    index: 'HOME', about: 'NOSOTROS', contact: 'CONTACTO',
    catalog: 'CATALOGO', dashboard: 'DASHBOARD', admin: 'ADMIN', auth: 'AUTH',
  };

  // Módulos activados por defecto al abrir el Builder (arranque con preview poblado)
  const DEFAULTS = ['hero', 'reveal', 'testimonials', 'faq', 'pricing', 'gallery', 'contact', 'auth', 'cart', 'newsletter', 'bookings'];

  /* ---- categorías del catálogo ----
     Agrupan el catálogo para que se pueda encontrar un módulo sin recorrer una lista de 228.
     La categoría de cada módulo y el ORDEN de las categorías vienen del server
     (src/categorias.js, expuesto por /api/modules y /api/categorias): antes estaban duplicadas
     acá y sólo cubrían una parte del catálogo. Si /api/categorias no responde, se cae al orden
     alfabético de lo que traigan los módulos: el panel sigue funcionando. */
  let CAT_ORDER = { ui: [], functional: [] };
  const catFor = (m) => m.category || 'Otros';
  const catOrder = (type, presentes) => {
    const orden = CAT_ORDER[type] || [];
    const extra = presentes.filter(c => !orden.includes(c)).sort();
    return [...orden, ...extra];
  };

  // Presets: puntos de partida frecuentes. Reemplazan la selección actual.
  const PRESETS = [
    { name: 'Landing', mods: ['hero', 'reveal', 'features', 'services', 'testimonials', 'pricing', 'faq', 'cta', 'contact', 'seo', 'navmobile', 'darkmode'] },
    { name: 'Tienda', mods: ['hero', 'reveal', 'catalogo', 'pricing', 'cart', 'auth', 'coupons', 'reviews', 'currency', 'payments', 'testimonials', 'contact', 'seo', 'navmobile'] },
    { name: 'Reservas', mods: ['hero', 'reveal', 'services', 'bookings', 'callback', 'hours', 'map', 'faq', 'testimonials', 'contact', 'seo', 'navmobile'] },
    { name: 'Blog', mods: ['hero', 'reveal', 'blog', 'blogpages', 'rss', 'newsletter', 'search', 'faq', 'social', 'seo', 'navmobile', 'contact'] },
  ];

  // Índice de módulos: id -> { name, description, type, requires, fields, input, item, cat<details> }
  const MODS = {};

  /* ---- textos por sección ----
     Overrides que escribe el usuario, por módulo: { modId: { campo: valor } }. Sólo guarda lo
     que se escribió; un campo vacío significa "usá el default del módulo" y por eso NO se
     borra la entrada al vaciarlo (el generador ya resuelve vacío → default). Se conserva
     aunque el módulo se desmarque: volver a tildarlo recupera lo escrito. */
  const SECTION_TEXTS = {};
  // Qué grupos quedaron abiertos, para no cerrarlos al re-renderizar tras cambiar la selección
  const openSectionTexts = new Set();

  /* ---- animaciones del panel (Motion) ----
     Todo pasa por la librería Motion vendorizada en /vendor/motion.js.
     Si no cargó, o el usuario pidió menos movimiento, FX.on es false y cada
     método es un no-op: la interfaz queda estática pero 100% funcional. */
  const FX = (function () {
    const M = window.Motion;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const on = !!(M && M.animate) && !reduce;
    const animate = on ? M.animate : function () {};
    const stagger = on ? M.stagger : function () { return 0; };
    const spring = { type: 'spring', stiffness: 380, damping: 26 };
    const outExpo = [0.22, 1, 0.36, 1];

    // Entrada de la interfaz al abrir el builder (corre antes del primer paint)
    function entrance() {
      if (!on) return;
      animate('.topbar', { opacity: [0, 1], y: [-16, 0] }, { duration: 0.5, ease: outExpo });
      const blocks = document.querySelectorAll('.panel-block');
      if (blocks.length) animate(blocks, { opacity: [0, 1], x: [-14, 0] },
        { duration: 0.45, delay: stagger(0.05, { startDelay: 0.08 }), ease: outExpo });
      animate('.preview-frame-wrap', { opacity: [0, 1], scale: [0.985, 1] }, { duration: 0.5, delay: 0.1, ease: 'ease-out' });
    }

    // Aparición en cascada de una lista recién revelada (módulos de una categoría al abrirla)
    function staggerIn(nodes) {
      const list = nodes && nodes.length ? nodes : [];
      if (!on || !list.length) return;
      animate(list, { opacity: [0, 1], y: [8, 0] }, { duration: 0.3, delay: stagger(0.022), ease: 'ease-out' });
    }

    // Rebote breve al marcar/desmarcar un módulo
    function pulse(el) { if (on && el) animate(el, { scale: [0.96, 1] }, spring); }

    // Fundido del iframe cuando entra un preview nuevo
    function previewSwap(el) { if (on && el) animate(el, { opacity: [0.4, 1] }, { duration: 0.35, ease: 'ease-out' }); }

    // Estado "trabajando": respiración sutil de opacidad mientras se empaqueta el .zip.
    // Comunica progreso (no es decoración) y se apaga al terminar. Devuelve una función stop().
    function working(el) {
      if (!on || !el) return function () {};
      const anim = animate(el, { opacity: [1, 0.68, 1] }, { duration: 1.1, repeat: Infinity, ease: 'ease-in-out' });
      return function () { if (anim && anim.stop) anim.stop(); el.style.opacity = ''; };
    }

    // Microinteracciones (hover/press con spring) sobre elementos actuales del selector
    function interactive(sel) {
      if (!on) return;
      M.hover(sel, function (el) {
        animate(el, { scale: 1.03 }, spring);
        return function () { animate(el, { scale: 1 }, spring); };
      });
      M.press(sel, function (el) {
        animate(el, { scale: 0.95 }, { duration: 0.12 });
        return function () { animate(el, { scale: 1 }, spring); };
      });
    }

    return { on, entrance, staggerIn, pulse, previewSwap, interactive, working };
  })();

  /* ---- tipografías del sitio generado ----
     El catálogo viene del server (/api/fonts) para no duplicarlo. El panel muestra una
     muestra en vivo con la familia real; las web fonts (Google Fonts) se cargan en el Builder
     sólo cuando se eligen, así la vista previa del selector es fiel a lo que se exporta. */
  let FONT_CATALOG = [];
  const loadedWebFonts = new Set();

  function ensureWebFont(f) {
    if (!f || !f.google || loadedWebFonts.has(f.id)) return;
    loadedWebFonts.add(f.id);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + f.google + '&display=swap';
    document.head.appendChild(link);
  }

  function updateFontSample() {
    const id = $('font-select').value;
    const f = FONT_CATALOG.find(x => x.id === id);
    if (!f) return;
    ensureWebFont(f);
    const sample = $('font-sample');
    if (sample) sample.style.fontFamily = f.stack;
    const note = $('font-web-note');
    if (note) note.hidden = !f.google;
  }

  async function setupFonts() {
    try {
      FONT_CATALOG = await (await fetch('/api/fonts')).json();
    } catch { return; } // sin catálogo, el <select> estático del HTML sigue sirviendo
    const sel = $('font-select');
    const prev = sel.value;
    sel.innerHTML = FONT_CATALOG.map(f => `<option value="${f.id}">${f.label}</option>`).join('');
    if (FONT_CATALOG.some(f => f.id === prev)) sel.value = prev;
    // Precargar las web fonts elegibles para que la muestra no parpadee al abrir el select
    FONT_CATALOG.forEach(ensureWebFont);
    sel.addEventListener('change', updateFontSample);
    updateFontSample();
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 2800);
  }

  const checkedIds = () => [...document.querySelectorAll('#ui-cats input:checked, #functional-cats input:checked')].map(i => i.value);

  function config() {
    return {
      brand: {
        name: $('brand-name').value,
        tagline: $('brand-tagline').value,
        domain: $('brand-domain').value,
        colors: {
          primary: $('color-primary').value,
          accent: $('color-accent').value,
          bg: $('color-bg').value,
        },
        font: $('font-select').value,
      },
      texts: {
        heroTitle: $('text-hero-title').value,
        heroSubtitle: $('text-hero-sub').value,
        heroCta: $('text-hero-cta').value,
        about: $('text-about').value,
      },
      // Sólo lo que el usuario escribió de verdad: un campo vacío no viaja (el generador
      // lo resolvería igual al default, pero mandarlo ensuciaría la clave de caché del
      // preview y haría que cada campo tocado y vuelto a vaciar cuente como config nueva).
      moduleTexts: cleanSectionTexts(),
      modules: checkedIds(),
      persistence: $('persistence-select').value,
      deploy: $('deploy-select').value,
      docs: { saas: $('saas-doc').checked },
      design: {
        ...fxValues(),
        faqAnim: $('faqfx-select').value,
        faqText: $('faqtext-check').checked,
      },
    };
  }

  /* ---- movimiento y efectos ----
     Los ejes y sus opciones vienen del server (/api/efectos → src/motion.js). El panel no
     conoce ningún efecto por nombre: agregar una variante allá la hace aparecer acá sola. */
  let FX_EJES = [];

  async function setupEfectos() {
    try {
      FX_EJES = await (await fetch('/api/efectos')).json();
    } catch { return; } // sin catálogo el bloque queda vacío y el resto del panel sigue igual
    const host = $('fx-axes');
    host.innerHTML = FX_EJES.map(eje => {
      const opts = eje.options.map(([v, label]) => `<option value="${escHtml(v)}">${escHtml(label)}</option>`).join('');
      const hint = eje.hint ? `<p class="muted-note">${escHtml(eje.hint)}</p>` : '';
      return `<label for="fx-${escHtml(eje.id)}">${escHtml(eje.label)}</label>
        <select id="fx-${escHtml(eje.id)}" data-fx="${escHtml(eje.id)}">${opts}</select>${hint}`;
    }).join('');
    host.querySelectorAll('[data-fx]').forEach(sel => sel.addEventListener('change', refresh));
  }

  // Valores actuales de los ejes, listos para el bloque `design` de la config
  function fxValues() {
    const out = {};
    document.querySelectorAll('#fx-axes [data-fx]').forEach(sel => { out[sel.dataset.fx] = sel.value; });
    return out;
  }

  function cleanSectionTexts() {
    const out = {};
    for (const mod in SECTION_TEXTS) {
      const campos = {};
      for (const k in SECTION_TEXTS[mod]) {
        const v = String(SECTION_TEXTS[mod][k] || '').trim();
        if (v) campos[k] = v;
      }
      if (Object.keys(campos).length) out[mod] = campos;
    }
    return out;
  }

  /* ---- dependencias entre módulos ----
     Resuelve en cadena los `requires` (igual que el generador) para poder avisar qué módulos
     se agregan solos. Devuelve el set efectivo (elegidos + los que traen sus dependencias). */
  function resolveEffective(chosen) {
    const eff = new Set(chosen);
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of [...eff]) {
        const m = MODS[id];
        if (!m) continue;
        for (const dep of m.requires) if (!eff.has(dep)) { eff.add(dep); changed = true; }
      }
    }
    return eff;
  }

  /* ---- catálogo de módulos ---- */
  async function loadModules() {
    const [mods, orden] = await Promise.all([
      fetch('/api/modules').then(r => r.json()),
      fetch('/api/categorias').then(r => r.json()).catch(() => null),
    ]);
    if (orden) CAT_ORDER = orden;
    mods.forEach(m => { MODS[m.id] = { id: m.id, name: m.name, description: m.description, type: m.type, requires: m.requires || [], fields: m.fields || [] }; });

    for (const type of ['ui', 'functional']) {
      const host = $(type + '-cats');
      const groups = new Map(); // categoría -> [módulos]
      mods.filter(m => m.type === type).forEach(m => {
        const c = catFor(m);
        if (!groups.has(c)) groups.set(c, []);
        groups.get(c).push(m);
      });
      // Render en el orden declarado de categorías
      for (const cat of catOrder(type, [...groups.keys()])) {
        const list = groups.get(cat);
        if (!list || !list.length) continue;
        const det = document.createElement('details');
        det.className = 'mod-cat';
        det.dataset.cat = cat;
        const total = list.length;
        det.innerHTML = `<summary class="mod-cat-head">${cat}<span class="mod-cat-count" data-count>0/${total}</span></summary>`;
        const body = document.createElement('div');
        body.className = 'mod-cat-body';
        list.forEach(m => {
          const on = DEFAULTS.includes(m.id);
          const label = document.createElement('label');
          label.className = 'module-item' + (on ? ' on' : '');
          const reqNames = (m.requires || []).map(r => (MODS[r] && MODS[r].name) || r);
          label.innerHTML = `
            <input type="checkbox" value="${m.id}" ${on ? 'checked' : ''}>
            <span>
              <span class="mod-id">${m.id}</span>
              <span class="mod-name">${m.name}</span>
              <span class="mod-desc">${m.description}</span>
              ${reqNames.length ? `<span class="mod-req">requiere: ${reqNames.join(', ')}</span>` : ''}
            </span>`;
          const input = label.querySelector('input');
          input.addEventListener('change', () => {
            label.classList.toggle('on', input.checked);
            FX.pulse(label);
            onSelectionChanged();
          });
          MODS[m.id].input = input;
          MODS[m.id].item = label;
          MODS[m.id].catEl = det;
          body.appendChild(label);
        });
        det.appendChild(body);
        // Cascada al abrir la categoría (progressive disclosure con movimiento)
        det.addEventListener('toggle', () => { if (det.open) FX.staggerIn(det.querySelectorAll('.module-item')); });
        host.appendChild(det);
      }
    }
    buildPresets();
    updateCatCounts();
    updateSummary();
    renderSectionTexts();
    FX.interactive('.module-item');
    FX.interactive('.btn-export');
    FX.interactive('.preset-btn');
  }

  /* ---- presets ---- */
  function buildPresets() {
    const row = $('preset-row');
    row.innerHTML = PRESETS.map(p => `<button type="button" class="preset-btn" data-preset="${p.name}">${p.name}</button>`).join('');
    row.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
    });
  }

  function applyPreset(name) {
    const p = PRESETS.find(x => x.name === name);
    if (!p) return;
    const want = new Set(p.mods);
    for (const id in MODS) if (MODS[id].input) MODS[id].input.checked = want.has(id);
    syncItemStates();
    onSelectionChanged();
    toast('Preset "' + name + '" aplicado — ajustá lo que quieras');
  }

  function syncItemStates() {
    for (const id in MODS) {
      const m = MODS[id];
      if (m.item && m.input) m.item.classList.toggle('on', m.input.checked);
    }
  }

  /* ---- resumen de selección + contadores ---- */
  function updateCatCounts() {
    document.querySelectorAll('.mod-cat').forEach(det => {
      const inputs = det.querySelectorAll('input');
      const on = det.querySelectorAll('input:checked').length;
      const badge = det.querySelector('[data-count]');
      if (badge) { badge.textContent = on + '/' + inputs.length; badge.classList.toggle('has-on', on > 0); }
    });
  }

  function updateSummary() {
    const chosen = checkedIds();
    const box = $('selected-summary');
    const eff = resolveEffective(chosen);
    const deps = [...eff].filter(id => !chosen.includes(id));

    const chip = (id, isDep) => {
      const m = MODS[id];
      const name = m ? m.name : id;
      if (isDep) return `<span class="sel-chip is-dep" title="Se agrega solo porque otro módulo lo necesita">${name}<span class="sel-tag">auto</span></span>`;
      return `<span class="sel-chip">${name}<button type="button" class="sel-x" data-remove="${id}" aria-label="Quitar ${name}">×</button></span>`;
    };

    if (!chosen.length) {
      box.innerHTML = '<span class="sel-empty">Sin módulos elegidos todavía. Tocá un preset o abrí una categoría.</span>';
    } else {
      box.innerHTML = chosen.map(id => chip(id, false)).join('') + deps.map(id => chip(id, true)).join('');
      box.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.remove;
        if (MODS[id] && MODS[id].input) {
          MODS[id].input.checked = false;
          MODS[id].item.classList.remove('on');
        }
        onSelectionChanged();
      }));
    }

    const total = Object.keys(MODS).length;
    $('modules-count').textContent = chosen.length + ' / ' + total;
    $('spec-count').textContent = chosen.length + ' módulos';
  }

  // Un único punto por el que pasa todo cambio de selección
  function onSelectionChanged() {
    updateCatCounts();
    updateSummary();
    renderSectionTexts();
    refresh();
  }

  /* ---- bloque "Textos por sección" ----
     Se arma solo con lo que declara cada módulo en `fields` (que llega por /api/modules):
     el panel no sabe nada de ningún módulo en particular, así que un módulo nuevo aparece
     acá con sólo declarar sus campos. Se re-renderiza al cambiar la SELECCIÓN, nunca al
     tipear (tipear sólo actualiza SECTION_TEXTS y pide preview): si se rearmara en cada
     tecla, el campo perdería el foco. */
  function renderSectionTexts() {
    const host = $('section-texts');
    if (!host) return;
    // Módulos elegidos + los que entran por dependencia (esos también renderizan sección)
    const eff = [...resolveEffective(checkedIds())];
    const conCampos = eff.map(id => MODS[id]).filter(m => m && m.fields && m.fields.length);
    conCampos.sort((a, b) => a.name.localeCompare(b.name, 'es'));

    $('section-texts-empty').hidden = conCampos.length > 0;
    $('section-texts-count').textContent = conCampos.length ? conCampos.length + ' secciones' : '';

    host.innerHTML = conCampos.map(m => {
      const campos = m.fields.map(f => {
        const val = (SECTION_TEXTS[m.id] || {})[f.key] || '';
        const idAttr = 'sect-' + m.id + '-' + f.key;
        const ayuda = f.hint ? `<span class="sec-hint">${escHtml(f.hint)}</span>` : '';
        const ph = escHtml(String(f.default == null ? '' : f.default).split('\n')[0]);
        const comun = `id="${idAttr}" data-mod="${m.id}" data-key="${f.key}" placeholder="${ph}"` +
          (f.max ? ` maxlength="${f.max}"` : '');
        // select: opciones cerradas declaradas por el módulo ([[valor, etiqueta], …]);
        // sin valor elegido se muestra el default del campo
        const control = f.type === 'select'
          ? `<select id="${idAttr}" data-mod="${m.id}" data-key="${f.key}">${(f.options || []).map(o => {
              const [ov, ol] = Array.isArray(o) ? o : [o, o];
              const sel = (val || f.default) === ov ? ' selected' : '';
              return `<option value="${escHtml(ov)}"${sel}>${escHtml(ol)}</option>`;
            }).join('')}</select>`
          : (f.type === 'textarea' || f.type === 'list')
            ? `<textarea rows="${f.type === 'list' ? 4 : 2}" ${comun}>${escHtml(val)}</textarea>`
            : `<input type="text" value="${escHtml(val)}" ${comun}>`;
        return `<label for="${idAttr}">${escHtml(f.label)}</label>${ayuda}${control}`;
      }).join('');
      const abierto = openSectionTexts.has(m.id) ? ' open' : '';
      return `<details class="sec-text" data-mod="${m.id}"${abierto}>
        <summary class="sec-text-head">${escHtml(m.name)}<span class="sec-text-count">${m.fields.length}</span></summary>
        <div class="sec-text-body">${campos}</div>
      </details>`;
    }).join('');

    host.querySelectorAll('details.sec-text').forEach(det => {
      det.addEventListener('toggle', () => {
        if (det.open) openSectionTexts.add(det.dataset.mod); else openSectionTexts.delete(det.dataset.mod);
      });
    });
    host.querySelectorAll('[data-mod][data-key]').forEach(el => {
      el.addEventListener('input', () => {
        const mod = el.dataset.mod;
        if (!SECTION_TEXTS[mod]) SECTION_TEXTS[mod] = {};
        SECTION_TEXTS[mod][el.dataset.key] = el.value;
        refresh();
      });
    });
    filterSectionTexts($('section-texts-search') ? $('section-texts-search').value : '');
  }

  // Filtro del bloque: por nombre del módulo o por label de alguno de sus campos
  function filterSectionTexts(qRaw) {
    const q = (qRaw || '').trim().toLowerCase();
    document.querySelectorAll('#section-texts details.sec-text').forEach(det => {
      const m = MODS[det.dataset.mod];
      const heno = (m ? m.id + ' ' + m.name + ' ' + m.fields.map(f => f.label).join(' ') : '').toLowerCase();
      det.hidden = !!q && !heno.includes(q);
      if (q && !det.hidden) det.open = true;
    });
  }

  // Escape para armar el HTML del panel con datos que vienen del server
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---- buscador de módulos ---- */
  function runSearch(qRaw) {
    const q = (qRaw || '').trim().toLowerCase();
    $('module-search-clear').hidden = !q;
    let anyVisible = false;
    document.querySelectorAll('.mod-cat').forEach(det => {
      let visibleInCat = 0;
      det.querySelectorAll('.module-item').forEach(item => {
        const id = item.querySelector('input').value;
        const m = MODS[id];
        const hit = !q || (id + ' ' + m.name + ' ' + m.description).toLowerCase().includes(q);
        item.hidden = !hit;
        if (hit) visibleInCat++;
      });
      det.hidden = q && visibleInCat === 0;
      // Con búsqueda activa, abrí las categorías con coincidencias; sin búsqueda, colapsá
      if (q) det.open = visibleInCat > 0; else det.open = false;
      if (visibleInCat > 0) anyVisible = true;
    });
    $('mod-empty').hidden = !(q && !anyVisible);
  }

  /* ---- preview con debounce ---- */
  let timer;
  function refresh() {
    clearTimeout(timer);
    timer = setTimeout(doPreview, 220);
  }

  async function doPreview() {
    const cfg = config();
    $('spec-count').textContent = cfg.modules.length + ' módulos';
    $('preview-status').textContent = 'generando…';
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: cfg, page: currentPage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      knownPages = data.pages;
      renderTabs();
      const frame = $('preview');
      frame.onload = () => FX.previewSwap(frame);
      frame.srcdoc = data.html;
      $('preview-status').textContent = 'preview en vivo · ' + currentPage + '.html';
    } catch (err) {
      // Si la página actual dejó de existir (ej: se desmarcó el módulo), volver a Home
      if (currentPage !== 'index') { currentPage = 'index'; return doPreview(); }
      $('preview-status').textContent = 'error';
      toast(err.message);
    }
  }

  function renderTabs() {
    const order = ['index', 'about', 'contact', 'catalog', 'auth', 'dashboard', 'admin'];
    // Las páginas clásicas primero en su orden; las que aportan los módulos (jobs, quote,
    // portfolio, artículos del blog…) después, en orden alfabético, para poder previsualizarlas
    const pages = [...order.filter(p => knownPages.includes(p)), ...knownPages.filter(p => !order.includes(p)).sort()];
    $('page-tabs').innerHTML = pages.map(p =>
      `<button class="page-tab${p === currentPage ? ' active' : ''}" data-page="${p}">${PAGE_LABELS[p] || p.toUpperCase()}</button>`
    ).join('');
    document.querySelectorAll('.page-tab').forEach(b => b.addEventListener('click', () => {
      currentPage = b.dataset.page;
      doPreview();
    }));
    FX.interactive('.page-tab');
  }

  /* ---- exportación ---- */
  $('export-btn').addEventListener('click', async () => {
    const btn = $('export-btn');
    btn.disabled = true;
    btn.textContent = 'Empaquetando…';
    const stopWorking = FX.working(btn);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: config() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al exportar');
      const blob = await res.blob();
      const name = (res.headers.get('Content-Disposition') || '').match(/filename="(.+)"/)?.[1] || 'proyecto.zip';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Proyecto exportado: ' + name);
    } catch (err) {
      toast(err.message);
    } finally {
      stopWorking();
      btn.disabled = false;
      btn.textContent = 'Exportar proyecto .zip';
    }
  });

  /* ---- buscador: input, limpiar y atajo "/" ---- */
  $('module-search').addEventListener('input', (e) => runSearch(e.target.value));
  $('section-texts-search').addEventListener('input', (e) => filterSectionTexts(e.target.value));

  /* ---- atajos del bloque de efectos ---- */
  $('fx-reset').addEventListener('click', () => {
    // La primera opción de cada eje ES su default (así lo define src/motion.js)
    document.querySelectorAll('#fx-axes [data-fx]').forEach(sel => { sel.selectedIndex = 0; });
    refresh();
    toast('Efectos vueltos a los valores por defecto');
  });
  $('fx-random').addEventListener('click', () => {
    document.querySelectorAll('#fx-axes [data-fx]').forEach(sel => {
      sel.selectedIndex = Math.floor(Math.random() * sel.options.length);
    });
    refresh();
    toast('Combinación al azar — si te gusta, quedátela');
  });
  $('module-search-clear').addEventListener('click', () => {
    const s = $('module-search');
    s.value = '';
    runSearch('');
    s.focus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    if (typing) return;
    e.preventDefault();
    $('modules-block').open = true;
    $('module-search').focus();
  });

  /* ---- seleccionar / limpiar por tipo ---- */
  document.querySelectorAll('[data-selall]').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('#' + btn.dataset.selall + '-cats input').forEach(i => { i.checked = true; });
    syncItemStates(); onSelectionChanged();
  }));
  document.querySelectorAll('[data-clear]').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('#' + btn.dataset.clear + '-cats input').forEach(i => { i.checked = false; });
    syncItemStates(); onSelectionChanged();
  }));

  /* ---- inputs reactivos (excluye el buscador, que no regenera el preview) ---- */
  document.querySelectorAll('.panel input:not([data-no-preview]), .panel textarea, .panel select').forEach(el =>
    el.addEventListener('input', refresh)
  );

  /* ---- infraestructura: Vercel fuerza Supabase ---- */
  $('deploy-select').addEventListener('change', () => {
    const vercel = $('deploy-select').value === 'vercel';
    $('deploy-note').style.display = vercel ? 'block' : 'none';
    if (vercel) $('persistence-select').value = 'supabase';
  });

  /* ---- compartir proyecto por link (opcional, requiere Supabase en el server) ---- */
  function applyConfig(cfg) {
    if (!cfg) return;
    const set = (id, v) => { if (v !== undefined && $(id)) $(id).value = v; };
    if (cfg.brand) {
      set('brand-name', cfg.brand.name); set('brand-tagline', cfg.brand.tagline); set('brand-domain', cfg.brand.domain);
      if (cfg.brand.colors) { set('color-primary', cfg.brand.colors.primary); set('color-accent', cfg.brand.colors.accent); set('color-bg', cfg.brand.colors.bg); }
      set('font-select', cfg.brand.font);
      updateFontSample();
    }
    if (cfg.texts) { set('text-hero-title', cfg.texts.heroTitle); set('text-hero-sub', cfg.texts.heroSubtitle); set('text-hero-cta', cfg.texts.heroCta); set('text-about', cfg.texts.about); }
    if (cfg.moduleTexts && typeof cfg.moduleTexts === 'object') {
      for (const mod in SECTION_TEXTS) delete SECTION_TEXTS[mod];
      for (const mod in cfg.moduleTexts) SECTION_TEXTS[mod] = { ...cfg.moduleTexts[mod] };
    }
    set('persistence-select', cfg.persistence); set('deploy-select', cfg.deploy);
    // Configs viejas sin bloque design: set() ignora undefined y cada control queda en su default
    if (cfg.design) {
      document.querySelectorAll('#fx-axes [data-fx]').forEach(sel => {
        const v = cfg.design[sel.dataset.fx];
        // Un valor que este Builder no conoce (config de una versión más nueva) se ignora:
        // el select queda en su default en vez de mostrar una opción vacía
        if (v && [...sel.options].some(o => o.value === v)) sel.value = v;
      });
    }
    set('faqfx-select', cfg.design && cfg.design.faqAnim);
    if (cfg.design && cfg.design.faqText !== undefined) $('faqtext-check').checked = !!cfg.design.faqText;
    if (cfg.docs) $('saas-doc').checked = !!cfg.docs.saas;
    if (Array.isArray(cfg.modules)) {
      document.querySelectorAll('#ui-cats input, #functional-cats input').forEach(i => { i.checked = cfg.modules.includes(i.value); });
      syncItemStates();
      updateCatCounts();
      updateSummary();
    }
    renderSectionTexts();
  }

  $('share-btn').addEventListener('click', async () => {
    try {
      const r = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: config() }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'No se pudo guardar');
      const url = location.origin + location.pathname + '?p=' + data.id;
      await navigator.clipboard.writeText(url).catch(() => {});
      $('share-btn').textContent = 'Link copiado';
      setTimeout(() => $('share-btn').textContent = 'Compartir link', 2200);
      history.replaceState(null, '', url);
    } catch (err) { alert(err.message); }
  });

  async function initShare() {
    // el botón solo aparece si el server tiene Supabase configurado
    const probe = await fetch('/api/projects/probe').then(r => r.status).catch(() => 0);
    if (probe !== 503) $('share-btn').style.display = '';
    const id = new URLSearchParams(location.search).get('p');
    if (!id) return;
    try {
      const r = await fetch('/api/projects/' + encodeURIComponent(id));
      if (!r.ok) return;
      applyConfig((await r.json()).config);
      refresh();
    } catch {}
  }

  FX.entrance();
  setupFonts();
  // Los efectos se arman antes del primer preview: si no, la primera generación saldría con
  // un bloque design vacío y el preview tendría que rehacerse entero al llegar el catálogo.
  setupEfectos().then(loadModules).then(doPreview).then(initShare);
})();
