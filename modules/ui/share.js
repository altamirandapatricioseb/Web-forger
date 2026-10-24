module.exports = {
  id: 'share', type: 'ui', name: 'Botones de compartir',
  description: 'Sección para compartir la página: WhatsApp, X, Facebook, copiar link y compartir nativo del celular.',
  html: () => `  <section id="compartir" style="padding:36px 0;border-top:1px solid var(--line)">
    <div class="container" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <span class="muted">Compartí esta página:</span>
      <a class="btn ghost" data-share="whatsapp" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn ghost" data-share="x" target="_blank" rel="noopener">X</a>
      <a class="btn ghost" data-share="facebook" target="_blank" rel="noopener">Facebook</a>
      <button class="btn ghost" id="share-copy" type="button">Copiar link</button>
      <button class="btn" id="share-native" type="button" hidden>Compartir…</button>
    </div>
  </section>`,
  clientJs: () => `/* Módulo compartir: arma los links en runtime con la URL real de la página.
   Sin SDKs de terceros: solo los share-URLs públicos de cada red. */
(function () {
  const section = document.getElementById('compartir');
  if (!section) return;
  const url = encodeURIComponent(location.href);
  const text = encodeURIComponent(document.title);
  const redes = {
    whatsapp: 'https://wa.me/?text=' + text + '%20' + url,
    x: 'https://twitter.com/intent/tweet?text=' + text + '&url=' + url,
    facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + url,
  };
  section.querySelectorAll('[data-share]').forEach(a => { a.href = redes[a.dataset.share]; });
  const copy = document.getElementById('share-copy');
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      App.toast('Link copiado al portapapeles');
    } catch { App.toast('No se pudo copiar el link'); }
  });
  // Compartir nativo (celulares y navegadores compatibles)
  const native = document.getElementById('share-native');
  if (navigator.share) {
    native.hidden = false;
    native.addEventListener('click', () => {
      navigator.share({ title: document.title, url: location.href }).catch(() => {});
    });
  }
})();`,
};
