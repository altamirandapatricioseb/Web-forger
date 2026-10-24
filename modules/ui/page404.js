const { esc } = require('../../src/templates');

module.exports = {
  id: 'page404', type: 'ui', name: 'Página 404',
  description: 'Página "no encontrada" con el diseño del sitio y fallback en Express: cualquier ruta inexistente la muestra con status 404 (la API sigue respondiendo JSON).',
  mounts: [{ route: '/', file: 'routes/notfound.js' }],
  pages: (cfg) => ({
    '404': {
      title: 'Página no encontrada',
      html: `  <section>
    <div class="container" style="text-align:center;padding:48px 20px">
      <p style="font-size:clamp(4rem,14vw,7rem);font-weight:800;letter-spacing:-0.04em;color:var(--accent);margin:0;line-height:1">404</p>
      <h2 style="margin:8px 0 10px">Esta página no existe</h2>
      <p class="section-sub" style="margin:0 auto 28px">Puede que el link esté vencido o mal escrito. Lo importante: ${esc(cfg.brand.name)} sigue acá.</p>
      <a class="btn" href="/index.html">Volver al inicio</a>
    </div>
  </section>`,
    },
  }),
  files: () => ({
    'routes/notfound.js': `/** Fallback 404: las rutas que no matchearon ningún archivo ni API muestran la página amigable. */
const path = require('path');
const router = require('express').Router();

router.use((req, res, next) => {
  // Las rutas de API no se tocan: su 404 responde JSON (definido en src/app.js)
  if (req.path.startsWith('/api')) return next();
  res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
});

module.exports = router;
`,
  }),
};
