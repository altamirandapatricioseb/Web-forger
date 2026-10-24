const { esc, txt } = require('../../src/templates');

// ID placeholder de YouTube (video libre de Blender); el cliente pone el suyo.
// Se usa youtube-nocookie.com y el iframe se crea recién al hacer clic:
// la página no le pide nada a YouTube (ni cookies ni tracking) hasta que el visitante decide ver el video.
const VIDEO_ID = 'aqz-KE-bpKQ';

// El ID viaja a un atributo y de ahí a la URL del embed, así que se normaliza:
// si pegaron la URL entera de YouTube se le saca el ID (de "?v=" o del último tramo),
// y después se deja sólo lo que YouTube usa en un ID (letras, números, guion y guion bajo).
// Si no queda nada usable, vuelve al placeholder en vez de hornear un embed roto.
function videoId(cfg) {
  const crudo = String(txt(cfg, 'video', 'videoId', VIDEO_ID)).trim();
  let id = crudo;
  if (/^https?:\/\//i.test(crudo)) {
    const v = /[?&]v=([^&]+)/.exec(crudo);
    id = v ? v[1] : (crudo.split(/[?#]/)[0].split('/').filter(Boolean).pop() || '');
  }
  return id.replace(/[^A-Za-z0-9_-]/g, '') || VIDEO_ID;
}

module.exports = {
  id: 'video', type: 'ui', name: 'Video institucional',
  description: 'Sección con un video de YouTube que carga recién al hacer clic (modo sin cookies): la página no contacta a YouTube hasta que el visitante lo reproduce.',
  fields: [
    { key: 'titulo', label: 'Título de la sección', default: 'Conocenos en un minuto', max: 80 },
    { key: 'bajada', label: 'Bajada', default: 'Mirá cómo trabajamos y qué podemos hacer por vos.', max: 220 },
    {
      // El max tiene que dar para una URL entera: el generador recorta ANTES de que el
      // módulo extraiga el ID, y con un tope corto la URL pegada llegaría mutilada.
      key: 'videoId', label: 'ID del video de YouTube', default: VIDEO_ID, max: 200,
      hint: 'El ID, lo que sigue a "watch?v=" en la URL de YouTube. Si pegás la URL entera, se le extrae el ID solo.',
    },
    {
      key: 'pie', label: 'Texto del botón de reproducir', type: 'textarea', max: 220,
      default: 'Hacé clic para reproducir · el video se carga desde YouTube recién al tocar',
    },
  ],
  html: (cfg) => `  <section id="video">
    <div class="container">
      <h2>${esc(txt(cfg, 'video', 'titulo', 'Conocenos en un minuto'))}</h2>
      <p class="section-sub">${esc(txt(cfg, 'video', 'bajada', 'Mirá cómo trabajamos y qué podemos hacer por vos.'))}</p>
      <button class="video-placeholder" data-video-id="${esc(videoId(cfg))}" aria-label="Reproducir video">
        <span class="video-play" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>
        </span>
        <span class="muted" style="font-size:.9rem">${esc(txt(cfg, 'video', 'pie', 'Hacé clic para reproducir · el video se carga desde YouTube recién al tocar'))}</span>
      </button>
    </div>
  </section>`,
  clientJs: () => `/* Módulo video: reemplaza el placeholder por el iframe de youtube-nocookie al hacer clic. */
(function () {
  var ph = document.querySelector('.video-placeholder');
  if (!ph) return;
  var style = document.createElement('style');
  style.textContent = '.video-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;width:100%;max-width:840px;margin:0 auto;aspect-ratio:16/9;border:1px solid var(--line);border-radius:var(--radius);cursor:pointer;font:inherit;background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 20%,var(--surface)),var(--surface))}' +
    '.video-placeholder:hover .video-play{transform:scale(1.08)}' +
    '.video-play{display:flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:50%;background:var(--accent);transition:transform .2s;box-shadow:0 8px 24px rgba(0,0,0,.25)}' +
    '.video-marco{width:100%;max-width:840px;margin:0 auto;aspect-ratio:16/9;border:0;border-radius:var(--radius);display:block}';
  document.head.appendChild(style);
  ph.addEventListener('click', function () {
    var iframe = document.createElement('iframe');
    // autoplay=1 arranca el video con el mismo clic que lo cargó
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(ph.dataset.videoId) + '?autoplay=1&rel=0';
    iframe.className = 'video-marco';
    iframe.title = 'Video institucional';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    ph.replaceWith(iframe);
  });
})();`,
  readmeNotes: () => [
    '**Video institucional**: el ID del video sale del bloque *Textos por sección* del Builder; si no lo cambiaste, es un placeholder (corto libre de Blender). También podés reemplazar el `data-video-id` en `public/index.html` por el ID de tu propio video de YouTube (lo que sigue a `watch?v=` en la URL).',
  ],
};
