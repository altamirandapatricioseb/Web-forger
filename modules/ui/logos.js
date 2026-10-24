// Marcas placeholder como "wordmarks" tipográficos: cero imágenes, el cliente
// las reemplaza por sus logos reales (o deja el texto con los nombres verdaderos)
const MARCAS = ['Nova Group', 'Altura SA', 'Vector', 'Prisma Studio', 'Faro Digital', 'Cumbre'];

module.exports = {
  id: 'logos', type: 'ui', name: 'Logos de clientes',
  description: 'Franja "Confían en nosotros" con las marcas que trabajaron con vos. Placeholders tipográficos listos para reemplazar por logos reales.',
  html: () => `  <section id="clientes" style="padding:40px 0">
    <div class="container" style="text-align:center">
      <p class="muted" style="margin:0 0 20px;font-size:.85rem;text-transform:uppercase;letter-spacing:.12em;font-weight:600">Confían en nosotros</p>
      <div class="logos-franja">
${MARCAS.map(m => `        <span class="logo-marca">${m}</span>`).join('\n')}
      </div>
    </div>
  </section>`,
  clientJs: () => `/* Módulo logos de clientes: solo estilos (grises que toman color al pasar el mouse). */
(function () {
  var style = document.createElement('style');
  style.textContent = '.logos-franja{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:18px 44px}' +
    '.logo-marca{font-weight:800;font-size:1.25rem;letter-spacing:-0.02em;color:var(--muted);opacity:.75;transition:color .2s,opacity .2s;cursor:default}' +
    '.logo-marca:hover{color:var(--accent);opacity:1}' +
    '.logos-franja img{height:36px;width:auto;filter:grayscale(1);opacity:.7;transition:filter .2s,opacity .2s}' +
    '.logos-franja img:hover{filter:none;opacity:1}';
  document.head.appendChild(style);
})();`,
  readmeNotes: () => [
    '**Logos de clientes**: los nombres de la franja `#clientes` son placeholders; reemplazalos por tus clientes reales, o poné `<img>` con sus logos (los estilos de grisado ya están incluidos).',
  ],
};
