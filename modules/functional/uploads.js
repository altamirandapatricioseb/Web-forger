// Biblioteca de archivos con subida REAL: cierra el pendiente histórico "las imágenes/archivos
// van por URL". El administrador sube archivos desde /archivos-admin.html (input o arrastrar y
// soltar) y obtiene una URL propia del sitio (/api/uploads/f/<id>) lista para pegar en cualquier
// módulo que pida una URL (galería administrable, centro de descargas, portafolio, blog, avisos…).
// El archivo viaja como cuerpo binario crudo (application/octet-stream) así no pisa el límite del
// express.json global, con nombre y tipo en headers; el servidor valida extensión (lista blanca
// sin svg/html por XSS) y tamaño (5 MB). Persistencia según el modo del proyecto: local guarda el
// binario en data/uploads/ y la colección files sólo lleva metadatos; con Supabase el binario va
// en base64 a la colección filedata (una fila por archivo, separada de files para que el listado
// nunca cargue los binarios). Servido con Content-Type saneado y Content-Disposition inline.
// Requiere autenticación (sólo el negocio sube archivos). Animado con Anime.js (aparición de la
// grilla con stagger, pop al subir) + red de seguridad.

// Extensiones aceptadas y su Content-Type (lista blanca: nada ejecutable ni svg/html por XSS)
const TIPOS = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
  pdf: 'application/pdf', zip: 'application/zip', mp3: 'audio/mpeg', mp4: 'video/mp4', webm: 'video/webm',
  txt: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

module.exports = {
  id: 'uploads', type: 'functional', name: 'Biblioteca de archivos',
  description: 'Subida real de archivos (imágenes, PDF, ZIP, audio, video, planillas; hasta 5 MB) con biblioteca solo-admin en /archivos-admin.html: subís por input o arrastrar y soltar y obtenés una URL del propio sitio para pegar en cualquier módulo que pida una URL (galería, descargas, portafolio, blog…). Persistencia local en data/uploads/ o en Supabase (base64 en tabla separada). Lista blanca de extensiones sin svg/html (anti-XSS). Animado con Anime.js.',
  usesAnime: true,
  requires: ['auth'],
  mounts: [{ route: '/api/uploads', file: 'routes/uploads.js' }],
  collections: ['files', 'filedata'],
  nav: () => [{ label: 'Archivos (admin)', href: '/archivos-admin.html', id: 'nav-uploads-admin' }],
  head: () => `  <style>
    .up-drop{border:2px dashed var(--line);border-radius:var(--radius);padding:34px 20px;text-align:center;cursor:pointer;transition:border-color .2s ease,background .2s ease}
    .up-drop.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,var(--surface))}
    .up-thumb{width:52px;height:52px;border-radius:var(--radius);object-fit:cover;background:var(--surface);border:1px solid var(--line)}
    .up-ext{width:52px;height:52px;border-radius:var(--radius);background:color-mix(in srgb,var(--accent) 16%,var(--surface));color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.75rem;text-transform:uppercase}
    .up-url{font-size:.8rem;color:var(--muted);word-break:break-all}
  </style>`,
  files: (cfg) => ({
    'routes/uploads.js': `const router = require('express').Router();
const express = require('express');
const db = require('../src/db');
const { requireAdmin } = require('../src/middleware/auth');
${cfg.persistence === 'supabase' ? '' : `const fs = require('fs');
const path = require('path');

// Los binarios viven en data/uploads/ (la colección files sólo guarda metadatos)
const DIR = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
`}
// Lista blanca de extensiones y su Content-Type (sin svg/html: podrían ejecutar scripts)
const TIPOS = ${JSON.stringify(TIPOS, null, 2)};
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB por archivo

// Nombre seguro: sólo letras/números/punto/guión, sin rutas ni caracteres raros
function nombreSeguro(raw) {
  const limpio = String(raw || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-').replace(/^[.-]+|[.-]+$/g, '').slice(0, 80);
  return limpio || 'archivo';
}

// POST /api/uploads/admin — sube un archivo (solo admin). El binario viaja crudo en el body
// (application/octet-stream, así no pasa por el parser JSON global) y el nombre en el header
// x-file-name. express.raw limita el tamaño a 5 MB.
router.post('/admin', requireAdmin, express.raw({ type: 'application/octet-stream', limit: MAX_BYTES }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(422).json({ error: 'No llegó ningún archivo' });
  const name = nombreSeguro(req.headers['x-file-name']);
  const ext = name.includes('.') ? name.split('.').pop() : '';
  if (!TIPOS[ext]) return res.status(422).json({ error: 'Tipo de archivo no permitido. Aceptamos: ' + Object.keys(TIPOS).join(', ') });
  if (req.body.length > MAX_BYTES) return res.status(413).json({ error: 'El archivo supera el máximo de 5 MB' });
  const meta = await db.insert('files', { name, type: TIPOS[ext], size: req.body.length });
${cfg.persistence === 'supabase' ? `  // El binario va en base64 a su propia colección: el listado de files nunca lo carga
  await db.insert('filedata', { fileId: meta.id, b64: req.body.toString('base64') });
` : `  fs.writeFileSync(path.join(DIR, meta.id + '-' + name), req.body);
`}  res.status(201).json({ ...meta, url: '/api/uploads/f/' + meta.id });
});

// GET /api/uploads/f/:id — sirve un archivo subido (público: la URL se pega en otros módulos)
router.get('/f/:id', async (req, res) => {
  const meta = await db.get('files', req.params.id);
  if (!meta) return res.status(404).json({ error: 'Archivo inexistente' });
  res.setHeader('Content-Type', meta.type);
  res.setHeader('Content-Disposition', 'inline; filename="' + meta.name + '"');
  res.setHeader('Cache-Control', 'public, max-age=86400');
${cfg.persistence === 'supabase' ? `  const dataRow = (await db.find('filedata', r => r.fileId === meta.id))[0];
  if (!dataRow) return res.status(404).json({ error: 'Contenido no encontrado' });
  res.send(Buffer.from(dataRow.b64, 'base64'));
` : `  const ruta = path.join(DIR, meta.id + '-' + meta.name);
  if (!fs.existsSync(ruta)) return res.status(404).json({ error: 'Contenido no encontrado' });
  res.send(fs.readFileSync(ruta));
`}});

// GET /api/uploads/admin/list — metadatos de todos los archivos, más recientes primero (solo admin)
router.get('/admin/list', requireAdmin, async (req, res) => {
  res.json((await db.all('files')).reverse().map(f => ({ ...f, url: '/api/uploads/f/' + f.id })));
});

// DELETE /api/uploads/admin/:id — borra un archivo y su contenido (solo admin)
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const meta = await db.get('files', req.params.id);
  if (!meta) return res.status(404).json({ error: 'Archivo inexistente' });
${cfg.persistence === 'supabase' ? `  for (const r of await db.find('filedata', x => x.fileId === meta.id)) await db.remove('filedata', r.id);
` : `  const ruta = path.join(DIR, meta.id + '-' + meta.name);
  if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
`}  await db.remove('files', req.params.id);
  res.json({ ok: true });
});

module.exports = router;
`,
  }),
  pages: () => ({
    'archivos-admin': {
      title: 'Biblioteca de archivos',
      html: `  <section>
    <div class="container" style="max-width:860px">
      <h2>Biblioteca de archivos</h2>
      <p class="section-sub">Subí imágenes y documentos y usá su URL en cualquier módulo del sitio (galería, descargas, portafolio, blog…). Hasta 5 MB por archivo. Solo visible para administradores.</p>
      <div id="up-drop" class="up-drop card" role="button" tabindex="0" aria-label="Subir un archivo">
        <p style="margin:0 0 6px;font-weight:700">Arrastrá un archivo acá o hacé clic para elegirlo</p>
        <p class="muted" style="margin:0;font-size:.85rem">Imágenes (jpg, png, webp, gif, avif), pdf, zip, mp3, mp4, webm, txt, csv y planillas de Office</p>
        <input type="file" id="up-input" hidden>
      </div>
      <p id="up-status" class="muted" style="margin:10px 0 0" hidden></p>
      <h3 style="margin:30px 0 10px">Archivos subidos</h3>
      <div id="up-list"><p class="muted">Cargando…</p></div>
    </div>
  </section>`,
    },
  }),
  clientJs: () => `/* Módulo biblioteca de archivos: subida real por input o arrastrar y soltar (el binario viaja
   crudo con el nombre en un header) y listado con copiar URL y borrar. Sólo admin. Animado con
   Anime.js (grilla con stagger, pop al subir) + red de seguridad. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var drop = document.getElementById('up-drop');
  if (drop) {
    var input = document.getElementById('up-input');
    var listBox = document.getElementById('up-list');
    var statusBox = document.getElementById('up-status');
    var me = JSON.parse(localStorage.getItem('user') || 'null');
    var archivos = [];

    function tamano(bytes) {
      if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    }

    function pintar() {
      if (!archivos.length) { listBox.innerHTML = '<p class="muted">Todavía no subiste archivos.</p>'; return; }
      listBox.innerHTML = App.table(archivos, [
        { label: 'Vista', render: function (f) {
          if (f.type.indexOf('image/') === 0) return '<img class="up-thumb" src="' + App.esc(f.url) + '" alt="">';
          return '<span class="up-ext">' + App.esc(f.name.split('.').pop()) + '</span>';
        } },
        { label: 'Archivo', render: function (f) { return '<strong>' + App.esc(f.name) + '</strong><br><span class="up-url">' + App.esc(location.origin + f.url) + '</span>'; } },
        { label: 'Peso', render: function (f) { return tamano(f.size); } },
        { label: 'Subido', render: function (f) { return new Date(f.createdAt).toLocaleDateString('es-AR'); } },
        { label: 'Acciones', render: function (f) {
          return '<button class="btn ghost" type="button" data-copy="' + f.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px">Copiar URL</button>' +
            '<a class="btn ghost" href="' + App.esc(f.url) + '" target="_blank" style="padding:3px 9px;font-size:.8rem;margin:2px">Abrir</a>' +
            '<button class="btn ghost" type="button" data-del="' + f.id + '" style="padding:3px 9px;font-size:.8rem;margin:2px;color:#c0392b;border-color:#c0392b">Borrar</button>';
        } },
      ]);
      listBox.querySelectorAll('[data-copy]').forEach(function (b) { b.addEventListener('click', function () { copiar(b.getAttribute('data-copy')); }); });
      listBox.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { borrar(b.getAttribute('data-del')); }); });
      var filas = [].slice.call(listBox.querySelectorAll('tbody tr'));
      var anime = window.anime;
      if (anime && anime.animate && !reduce && filas.length) {
        anime.animate(filas, { opacity: [0, 1], translateY: [8, 0], duration: 350, delay: anime.stagger ? anime.stagger(50) : 0, ease: 'outCubic' });
        // Red de seguridad: si el loop está pausado (pestaña oculta), fija el estado final
        setTimeout(function () { filas.forEach(function (n) { n.style.opacity = 1; n.style.transform = 'none'; }); }, 900);
      }
    }

    function copiar(id) {
      var f = archivos.filter(function (x) { return x.id === id; })[0];
      if (!f) return;
      var url = location.origin + f.url;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { App.toast('URL copiada: pegala en cualquier módulo'); });
      } else { prompt('Copiá la URL:', url); }
    }

    async function borrar(id) {
      if (window.__PREVIEW__) { App.toast('Vista previa: se borraría'); return; }
      if (!confirm('¿Borrar este archivo? Las páginas que usen su URL dejarán de verlo.')) return;
      try {
        await App.api('/api/uploads/admin/' + id, { method: 'DELETE' });
        archivos = archivos.filter(function (x) { return x.id !== id; });
        pintar();
        App.toast('Archivo borrado');
      } catch (err) { if (err.message !== 'preview') App.toast(err.message); }
    }

    // Subida real: el archivo viaja crudo (octet-stream) con su nombre en el header x-file-name.
    // No usa App.api porque el body no es JSON.
    function subir(file) {
      if (!file) return;
      if (window.__PREVIEW__) { App.toast('Vista previa: el archivo se subiría en el proyecto exportado'); return; }
      if (file.size > 5 * 1024 * 1024) { App.toast('El archivo supera el máximo de 5 MB'); return; }
      statusBox.hidden = false;
      statusBox.textContent = 'Subiendo ' + file.name + '…';
      // El header viaja en ASCII: se pliegan los acentos acá para que "Júlio.csv" llegue como
      // "julio.csv" y no como caracteres escapados (el server igual vuelve a sanear el nombre)
      var nombreAscii = file.name.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^\\x20-\\x7E]/g, '-');
      file.arrayBuffer().then(function (buf) {
        return fetch('/api/uploads/admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'x-file-name': nombreAscii,
            Authorization: 'Bearer ' + (localStorage.getItem('token') || ''),
          },
          body: buf,
        });
      }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); }).then(function (r) {
        if (!r.ok) throw new Error(r.data.error || 'No se pudo subir');
        archivos.unshift(r.data);
        statusBox.textContent = 'Listo: ' + r.data.name + ' subido.';
        pintar();
        App.toast('Archivo subido: copiá su URL desde la lista');
        var anime = window.anime;
        if (anime && anime.animate && !reduce) {
          anime.animate(drop, { scale: [1, 1.02, 1], duration: 400, ease: 'outBack' });
          setTimeout(function () { drop.style.transform = 'none'; }, 500);
        }
      }).catch(function (err) {
        statusBox.textContent = '';
        statusBox.hidden = true;
        App.toast(err.message);
      });
    }

    drop.addEventListener('click', function () { input.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', function () { subir(input.files[0]); input.value = ''; });
    ['dragover', 'dragenter'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('on'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('on'); }); });
    drop.addEventListener('drop', function (e) { subir(e.dataTransfer.files && e.dataTransfer.files[0]); });

    if (window.__PREVIEW__) {
      archivos = [{ id: 'd1', name: 'catalogo-2026.pdf', type: 'application/pdf', size: 480000, url: '/api/uploads/f/d1', createdAt: new Date().toISOString() }];
      pintar();
    } else if (!me || me.role !== 'admin') {
      location.href = '/auth.html';
    } else {
      App.api('/api/uploads/admin/list').then(function (rows) { archivos = rows; pintar(); }).catch(function (err) { listBox.innerHTML = '<p class="muted">' + App.esc(err.message) + '</p>'; });
    }
  }

  // Oculta el link admin de la navbar para quien no es admin
  (function () {
    var meNav = JSON.parse(localStorage.getItem('user') || 'null');
    var navU = document.getElementById('nav-uploads-admin');
    if (navU && (!meNav || meNav.role !== 'admin') && !window.__PREVIEW__) navU.style.display = 'none';
  })();
})();`,
  readmeNotes: (cfg) => [
    `**Biblioteca de archivos**: los administradores suben archivos (hasta 5 MB; imágenes, pdf, zip, audio, video, planillas — nunca svg/html, por seguridad) en \`/archivos-admin.html\` y copian su URL (\`/api/uploads/f/<id>\`) para pegarla en cualquier módulo que pida una URL de imagen o archivo (galería administrable, centro de descargas, portafolio, blog…). ${cfg.persistence === 'supabase' ? 'Con persistencia Supabase el binario se guarda en base64 en la tabla `filedata` (una fila por archivo, separada de los metadatos en `files`): funciona en Vercel sin servicios extra, pero conviene mantener los archivos livianos; si necesitás muchos archivos pesados, migrá a Supabase Storage.' : 'Los binarios se guardan en `data/uploads/` (los metadatos en `data/files.json`); hacé backup de esa carpeta junto con el resto de `data/`.'}`,
  ],
};
