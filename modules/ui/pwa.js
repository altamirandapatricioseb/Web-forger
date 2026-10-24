// Ícono de la app: la inicial de la marca sobre el acento, mismo criterio que el módulo favicon
const iconoSvg = (cfg) => {
  const m = String(cfg.brand.name).match(/[a-zA-Z0-9À-ÿÑñ]/);
  const inicial = (m ? m[0] : '·').toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${cfg.brand.colors.accent}"/>
  <text x="256" y="352" font-family="Arial, sans-serif" font-size="288" font-weight="bold" text-anchor="middle" fill="#ffffff">${inicial}</text>
</svg>
`;
};

module.exports = {
  id: 'pwa', type: 'ui', name: 'App instalable (PWA)',
  description: 'Manifest, ícono y service worker: el sitio se puede instalar como app en el celular o la PC, y las páginas ya visitadas siguen funcionando sin conexión.',
  head: () => `  <link rel="manifest" href="/manifest.webmanifest">`,
  files: (cfg) => ({
    'public/manifest.webmanifest': JSON.stringify({
      name: cfg.brand.name,
      short_name: cfg.brand.name.slice(0, 12),
      description: cfg.brand.tagline,
      start_url: '/index.html',
      scope: '/',
      display: 'standalone',
      background_color: cfg.brand.colors.bg,
      theme_color: cfg.brand.colors.accent,
      icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    }, null, 2) + '\n',
    'public/icon.svg': iconoSvg(cfg),
    'public/sw.js': `/* Service worker generado por WebForge Builder.
   Estrategia: red primero con respaldo en cache. Online siempre se ve lo último;
   offline se sirve la copia guardada (y la home como último recurso al navegar). */
const CACHE = '${cfg.slug}-v1';
const CORE = ['/index.html', '/css/styles.css', '/js/app.js', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // Limpia caches de versiones anteriores
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // La API y todo lo externo nunca se cachean: siempre van a la red
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copia = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copia));
      return res;
    }).catch(() =>
      caches.match(e.request).then((hit) => hit || (e.request.mode === 'navigate' ? caches.match('/index.html') : Response.error()))
    )
  );
});
`,
  }),
  clientJs: () => `/* Módulo PWA: registra el service worker (solo funciona en HTTPS o localhost) */
(function () {
  if (!('serviceWorker' in navigator) || window.__PREVIEW__) return;
  var seguro = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!seguro) return;
  addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
})();`,
  readmeNotes: () => [
    '**PWA**: el sitio es instalable (menú del navegador → "Instalar app") y funciona offline con lo ya visitado. En producción requiere HTTPS (Vercel ya lo da). Si al desarrollar no ves un cambio, recargá con Ctrl+Shift+R o subí la versión de `CACHE` en `public/sw.js`.',
  ],
};
