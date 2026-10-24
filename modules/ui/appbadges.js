const { esc, txt } = require('../../src/templates');
const { phIcon } = require('../../src/icons');

// Título por defecto. {marca} se reemplaza por el nombre del negocio al generar: así el
// default declarado puede ser una constante (lo exige el contrato `fields`) y el texto
// horneado sigue nombrando a la marca igual que antes.
const TITULO_DEFAULT = 'Llevá {marca} en tu bolsillo';

// Sección "Descargá nuestra app": título, bajada y los dos badges de tienda
// (App Store y Google Play) como SVG inline, sin pedir imágenes externas ni requests.
// Estática, sin JS. Los enlaces son placeholders (#) hasta que existan las apps.
module.exports = {
  id: 'appbadges', type: 'ui', name: 'Descarga de app',
  description: 'Sección con botones de App Store y Google Play para descargar tu app móvil. Badges en SVG inline (sin imágenes externas). Estática, sin JS.',
  fields: [
    {
      key: 'titulo', label: 'Título de la sección', default: TITULO_DEFAULT, max: 80,
      hint: 'Escribí {marca} donde quieras que aparezca el nombre del negocio.',
    },
    { key: 'bajada', label: 'Bajada', default: 'Descargá nuestra app y gestioná todo desde el celular, estés donde estés.', max: 220 },
    { key: 'urlIos', label: 'Enlace a la ficha del App Store', default: '#', max: 300, hint: 'URL completa de tu app en el App Store. Con # el botón no lleva a ningún lado.' },
    { key: 'urlAndroid', label: 'Enlace a la ficha de Google Play', default: '#', max: 300, hint: 'URL completa de tu app en Google Play. Con # el botón no lleva a ningún lado.' },
  ],
  html: (cfg) => {
    const urlIos = txt(cfg, 'appbadges', 'urlIos', '#');
    const urlAndroid = txt(cfg, 'appbadges', 'urlAndroid', '#');
    return `  <section id="app-descarga">
    <div class="container">
      <div class="app-box">
        <div class="app-texto">
          <h2>${esc(txt(cfg, 'appbadges', 'titulo', TITULO_DEFAULT).replace(/\{marca\}/g, cfg.brand.name))}</h2>
          <p class="section-sub">${esc(txt(cfg, 'appbadges', 'bajada', 'Descargá nuestra app y gestioná todo desde el celular, estés donde estés.'))}</p>
          <div class="app-badges">
            <a class="app-badge" href="${esc(urlIos)}" aria-label="Descargar en el App Store">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2 1.6-3 1.7-3-.9-1.4-2.4-1.5-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.2 2-1.4 2.4-.4 6 1 8 .7 1 1.4 2 2.4 2 1 0 1.3-.6 2.5-.6s1.5.6 2.5.6 1.7-1 2.3-2c.7-1.1 1-2.2 1-2.3 0 0-1.9-.8-2.2-3.1zM14.6 6.1c.5-.6.9-1.5.8-2.4-.8 0-1.7.5-2.3 1.2-.5.6-.9 1.5-.8 2.3.9.1 1.7-.5 2.3-1.1z"/></svg>
              <span><small>Descargar en</small><strong>App Store</strong></span>
            </a>
            <a class="app-badge" href="${esc(urlAndroid)}" aria-label="Disponible en Google Play">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M4 3.3v17.4c0 .4.4.6.7.4l9.6-8.7-9.6-8.9c-.3-.2-.7 0-.7.4zM16 11.3l2.8-1.6c.6-.4.6-1.2 0-1.6L16 6.5l-2.6 2.4L16 11.3zm-2.6 3.8L16 12.7l2.8 1.6c.6.4.6 1.2 0 1.6L16 17.5l-2.6-2.4zM5.8 21l8.1-4.7-2.3-2.1L5.8 21zm0-18l5.8 6.8 2.3-2.1L5.8 3z"/></svg>
              <span><small>Disponible en</small><strong>Google Play</strong></span>
            </a>
          </div>
        </div>
        <div class="app-mockup" aria-hidden="true">
          <div class="app-phone">${phIcon('device-mobile', { size: 64, color: 'var(--accent)' })}</div>
        </div>
      </div>
    </div>
  </section>`;
  },
  head: () => `  <style>
    #app-descarga .app-box{display:flex;flex-wrap:wrap;align-items:center;gap:40px;justify-content:space-between}
    #app-descarga .app-texto{flex:1 1 320px}
    #app-descarga .app-badges{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px}
    #app-descarga .app-badge{display:inline-flex;align-items:center;gap:10px;padding:10px 18px;border-radius:12px;background:var(--text);color:var(--bg);text-decoration:none}
    #app-descarga .app-badge:hover{filter:brightness(1.15)}
    #app-descarga .app-badge span{display:flex;flex-direction:column;line-height:1.15;text-align:left}
    #app-descarga .app-badge small{font-size:.68rem;opacity:.85}
    #app-descarga .app-badge strong{font-size:1.05rem;font-weight:700}
    #app-descarga .app-mockup{flex:0 0 auto}
    #app-descarga .app-phone{width:150px;height:290px;border-radius:28px;border:3px solid var(--line);background:linear-gradient(160deg,color-mix(in srgb,var(--accent) 22%,var(--bg)),color-mix(in srgb,var(--primary) 14%,var(--bg)));display:flex;align-items:center;justify-content:center;box-shadow:0 20px 50px rgba(0,0,0,.14)}
    @media (max-width:640px){#app-descarga .app-mockup{display:none}}
  </style>`,
  readmeNotes: () => [
    '**Descarga de app**: el título, la bajada y los enlaces de App Store y Google Play salen del bloque *Textos por sección* del Builder; si no los editaste, los enlaces apuntan a `#`. También podés reemplazarlos después por las URLs reales de tus fichas en las tiendas dentro de la sección `#app-descarga` de `public/index.html`.',
  ],
};
