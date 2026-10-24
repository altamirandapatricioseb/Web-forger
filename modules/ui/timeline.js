// Hitos placeholder de una empresa tipo; el cliente los edita en su HTML
const HITOS = [
  { anio: '2015', titulo: 'Los comienzos', texto: 'Arrancamos con un local chico y una idea clara: hacer las cosas bien desde el primer día.' },
  { anio: '2018', titulo: 'Crecimiento', texto: 'Sumamos equipo y duplicamos la capacidad para responder a una demanda que no paraba de crecer.' },
  { anio: '2021', titulo: 'Nueva etapa', texto: 'Renovamos nuestras instalaciones y dimos el salto digital para atender a todo el país.' },
  { anio: 'Hoy', titulo: 'Mirando adelante', texto: 'Seguimos invirtiendo en calidad y en las personas que hacen posible cada entrega.' },
];

module.exports = {
  id: 'timeline', type: 'ui', name: 'Nuestra historia',
  description: 'Línea de tiempo vertical con los hitos de la empresa (año, título y descripción). Clásica de las páginas "Nosotros".',
  html: () => `  <section id="historia">
    <div class="container">
      <h2>Nuestra historia</h2>
      <p class="section-sub">El camino que nos trajo hasta acá.</p>
      <div id="historia-linea" style="border-left:2px solid var(--line);margin-left:9px;padding-left:30px;display:grid;gap:30px;max-width:640px">
${HITOS.map(h => `        <div style="position:relative">
          <span aria-hidden="true" style="position:absolute;left:-39px;top:7px;width:12px;height:12px;border-radius:50%;background:var(--accent);border:3px solid var(--bg);box-shadow:0 0 0 1px var(--line)"></span>
          <span style="color:var(--accent);font-weight:800;font-size:.9rem;letter-spacing:.04em">${h.anio}</span>
          <h3 style="margin:2px 0 4px">${h.titulo}</h3>
          <p class="muted" style="margin:0">${h.texto}</p>
        </div>`).join('\n')}
      </div>
    </div>
  </section>`,
  readmeNotes: () => [
    '**Nuestra historia**: los hitos de la línea de tiempo son placeholders; editá años, títulos y textos en la sección `#historia` de `public/index.html`.',
  ],
};
