module.exports = {
  id: 'search', type: 'ui', name: 'Buscador',
  description: 'Búsqueda en vivo sobre el contenido de la página.',
  html: () => `  <section id="buscador" style="padding:36px 0;border-bottom:1px solid var(--line)">
    <div class="container" style="display:flex;gap:10px;align-items:center">
      <input id="site-search" type="search" placeholder="Buscar en esta página…" style="max-width:420px">
      <span class="muted" id="search-count"></span>
    </div>
  </section>`,
  clientJs: () => `/* Módulo buscador: filtra tarjetas en vivo */
(function () {
  const input = document.getElementById('site-search');
  if (!input) return;
  const count = document.getElementById('search-count');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    let hits = 0;
    document.querySelectorAll('.card, article').forEach(el => {
      const show = !q || el.textContent.toLowerCase().includes(q);
      el.style.display = show ? '' : 'none';
      if (show && q) hits++;
    });
    count.textContent = q ? hits + ' resultado(s)' : '';
  });
})();`,
};
