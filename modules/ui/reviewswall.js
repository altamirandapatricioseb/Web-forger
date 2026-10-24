const { esc } = require('../../src/templates');
const { phStars } = require('../../src/icons');

// Muro de reseñas (masonry de texto): opiniones de clientes con estrellas, autor y
// origen, acomodadas en columnas tipo mosaico con CSS "columns" (layout puro CSS, sin
// JS ni dependencias: deployable gratis). Distinto de "Testimonios" (grilla fija de 3):
// este es un muro con muchas reseñas de largos variables. Las reseñas se editan en la
// constante RESENAS. Mejora progresiva total: es HTML + CSS, sin comportamiento.
const RESENAS = [
  { texto: 'Excelente atención de principio a fin. El equipo entendió lo que necesitábamos y lo entregó antes de tiempo.', autor: 'María González', origen: 'Google', estrellas: 5 },
  { texto: 'Muy profesionales y claros con los tiempos. Recomiendo sin dudarlo.', autor: 'Julián Pérez', origen: 'Facebook', estrellas: 5 },
  { texto: 'El resultado superó lo que esperábamos. Volveríamos a contratarlos.', autor: 'Carla Sosa', origen: 'Google', estrellas: 5 },
  { texto: 'Buena relación precio-calidad. Un par de ajustes al inicio, resueltos rápido.', autor: 'Diego Romero', origen: 'Instagram', estrellas: 4 },
  { texto: 'Atención personalizada y seguimiento después de la entrega. Se nota que les importa el cliente.', autor: 'Lucía Fernández', origen: 'Google', estrellas: 5 },
  { texto: 'Cumplieron con todo lo pactado. Comunicación fluida en todo el proceso.', autor: 'Martín Álvarez', origen: 'Facebook', estrellas: 5 },
  { texto: 'Rápidos y ordenados. Nos ayudaron a resolver un tema urgente el mismo día.', autor: 'Sofía Díaz', origen: 'Google', estrellas: 5 },
];

module.exports = {
  id: 'reviewswall', type: 'ui', name: 'Muro de reseñas',
  description: 'Muro tipo mosaico (masonry) con muchas reseñas de clientes: estrellas, autor y origen. Layout con CSS columns, sin JS ni dependencias. Las reseñas se editan en el HTML.',
  html: () => {
    const cards = RESENAS.map(r => `        <figure class="review-card">
          <p class="review-stars">${phStars(r.estrellas, { size: 17 })}</p>
          <blockquote>“${esc(r.texto)}”</blockquote>
          <figcaption><strong>${esc(r.autor)}</strong><span class="muted"> · ${esc(r.origen)}</span></figcaption>
        </figure>`).join('\n');
    return `  <section id="muro-resenas" style="background:var(--surface)">
    <div class="container">
      <h2>Lo que opinan nuestros clientes</h2>
      <p class="section-sub">Reseñas reales de quienes ya confiaron en nosotros.</p>
      <div class="reviews-wall">
${cards}
      </div>
    </div>
  </section>`;
  },
  head: () => `  <style>
    .reviews-wall{columns:3 280px;column-gap:18px}
    .review-card{break-inside:avoid;margin:0 0 18px;padding:18px 20px;background:var(--bg);border:1px solid var(--line);border-radius:var(--radius)}
    .review-card blockquote{margin:.4rem 0 .8rem;line-height:1.5}
    .review-stars{margin:0;color:var(--accent)}
    .review-card figcaption{font-size:.92rem}
    @media (max-width:560px){.reviews-wall{columns:1}}
  </style>`,
  readmeNotes: () => [
    '**Muro de reseñas**: las reseñas (texto, autor, origen y cantidad de estrellas) se editan en la constante `RESENAS` de `modules/ui/reviewswall.js`. Es HTML + CSS puro, sin JS.',
  ],
};
