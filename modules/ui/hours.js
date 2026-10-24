// Horarios placeholder de un comercio tipo; el cliente los edita en su HTML.
// data-dias usa los números de Date.getDay() (0=domingo … 6=sábado), como rango "1-5" o lista "6".
const FILAS = [
  { dias: 'Lunes a viernes', rango: '1-5', abre: '09:00', cierra: '18:00' },
  { dias: 'Sábados', rango: '6', abre: '09:00', cierra: '13:00' },
  { dias: 'Domingos y feriados', rango: '0', abre: null, cierra: null },
];

module.exports = {
  id: 'hours', type: 'ui', name: 'Horarios de atención',
  description: 'Tabla de horarios semanales con indicador "Abierto ahora / Cerrado" calculado en vivo en el navegador del visitante.',
  html: () => `  <section id="horarios">
    <div class="container">
      <h2>Horarios de atención</h2>
      <p class="section-sub">Te esperamos en estos horarios. <span id="estado-abierto"></span></p>
      <div class="card" style="max-width:520px;padding:0;overflow:hidden">
        <table id="tabla-horarios">
          <tbody>
${FILAS.map(f => `            <tr data-dias="${f.rango}"${f.abre ? ` data-abre="${f.abre}" data-cierra="${f.cierra}"` : ''}><td>${f.dias}</td><td style="text-align:right">${f.abre ? `${f.abre} a ${f.cierra}` : 'Cerrado'}</td></tr>`).join('\n')}
          </tbody>
        </table>
      </div>
    </div>
  </section>`,
  clientJs: () => `/* Módulo horarios: calcula "Abierto ahora / Cerrado" con la hora local del visitante
   leyendo los data-dias / data-abre / data-cierra de la tabla (una sola fuente de verdad).
   Si el JS no corre, la tabla estática sigue informando los horarios. */
(function () {
  var tabla = document.getElementById('tabla-horarios');
  var estado = document.getElementById('estado-abierto');
  if (!tabla || !estado) return;
  function minutos(hhmm) {
    var p = String(hhmm || '').split(':');
    return parseInt(p[0], 10) * 60 + (parseInt(p[1], 10) || 0);
  }
  // ¿El día d (0-6) entra en la spec "1-5" o "0,6"?
  function cubre(spec, d) {
    return String(spec).split(',').some(function (parte) {
      var r = parte.split('-');
      return r.length === 2 ? d >= +r[0] && d <= +r[1] : d === +parte;
    });
  }
  function actualizar() {
    var ahora = new Date();
    var abierta = false;
    Array.prototype.forEach.call(tabla.querySelectorAll('tr[data-dias]'), function (fila) {
      var hoy = cubre(fila.dataset.dias, ahora.getDay());
      // La fila del día actual queda resaltada
      fila.style.fontWeight = hoy ? '700' : '';
      if (!hoy || !fila.dataset.abre) return;
      var m = ahora.getHours() * 60 + ahora.getMinutes();
      if (m >= minutos(fila.dataset.abre) && m < minutos(fila.dataset.cierra)) abierta = true;
    });
    // Punto de estado como círculo CSS (hereda el color que ya fija el módulo), sin glifos
    var punto = '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:currentColor;vertical-align:middle;margin-right:6px"></span>';
    estado.innerHTML = punto + (abierta ? 'Abierto ahora' : 'Cerrado en este momento');
    estado.style.color = abierta ? '#1a9c4b' : '#c0392b';
    estado.style.fontWeight = '700';
  }
  actualizar();
  // Se recalcula cada minuto por si la página queda abierta a la hora del cambio
  setInterval(actualizar, 60000);
  // Punto de entrada para quien reescriba la tabla en vivo (módulo "horarios", que trae los
  // horarios y los feriados del backend): el cartel tiene que recalcularse en ese momento y no
  // esperar hasta el próximo minuto, o el sitio muestra "Abierto ahora" sobre una tabla que ya
  // dice "Cerrado (feriado)" — que es exactamente la contradicción que hay que evitar.
  window.WFHorarios = { actualizar: actualizar };
})();`,
  readmeNotes: () => [
    '**Horarios**: los horarios de la sección `#horarios` son placeholders; editá las filas de la tabla en `public/index.html` manteniendo los atributos `data-dias` (0=domingo … 6=sábado), `data-abre` y `data-cierra` para que el cartel "Abierto ahora" siga funcionando.',
  ],
};
