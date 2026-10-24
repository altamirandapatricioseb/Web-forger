const { esc } = require('../../src/templates');

// Bloque repetido al pie de ambas páginas: aclara que el texto es un modelo a revisar
const AVISO = `      <div class="card" style="margin-top:28px">
        <p class="muted" style="margin:0;font-size:.85rem">Este documento es un modelo de referencia generado automáticamente.
        Adaptalo a tu actividad y jurisdicción y hacelo revisar por un profesional antes de publicarlo.</p>
      </div>`;

module.exports = {
  id: 'legal', type: 'ui', name: 'Páginas legales',
  description: 'Páginas de Términos y Condiciones y Política de Privacidad con texto modelo editable, enlazadas desde el footer de todas las páginas.',
  pages: (cfg) => ({
    terms: {
      title: 'Términos y condiciones',
      html: `  <section>
    <div class="container" style="max-width:760px">
      <h2>Términos y condiciones</h2>
      <p class="section-sub">Última actualización: [completar fecha]</p>
      <h3>1. Aceptación</h3>
      <p class="muted">Al usar el sitio de ${esc(cfg.brand.name)} (en adelante, "el Sitio") aceptás estos términos.
      Si no estás de acuerdo con alguna de sus condiciones, no utilices el Sitio.</p>
      <h3>2. Sobre el servicio</h3>
      <p class="muted">${esc(cfg.brand.name)} ofrece [describir la actividad: venta de productos, prestación de servicios, etc.].
      La información publicada tiene carácter orientativo y puede modificarse sin previo aviso.</p>
      <h3>3. Uso permitido</h3>
      <p class="muted">Te comprometés a usar el Sitio de buena fe, a no vulnerar su seguridad ni la de terceros,
      y a que los datos que cargues (formularios, comentarios, cuentas) sean veraces.</p>
      <h3>4. Cuentas de usuario</h3>
      <p class="muted">Si el Sitio permite crear una cuenta, sos responsable de mantener la confidencialidad de tu
      contraseña y de la actividad realizada con tu usuario. Podemos suspender cuentas que incumplan estos términos.</p>
      <h3>5. Precios y pagos</h3>
      <p class="muted">[Completar si aplica: moneda, medios de pago, política de cambios y devoluciones, plazos de entrega.]</p>
      <h3>6. Propiedad intelectual</h3>
      <p class="muted">El contenido del Sitio (textos, marcas, logos, imágenes) pertenece a ${esc(cfg.brand.name)} o a sus
      licenciantes y no puede reproducirse sin autorización.</p>
      <h3>7. Responsabilidad</h3>
      <p class="muted">${esc(cfg.brand.name)} no garantiza la disponibilidad ininterrumpida del Sitio ni se hace responsable
      por daños derivados de su uso, en la medida permitida por la ley aplicable.</p>
      <h3>8. Ley aplicable</h3>
      <p class="muted">Estos términos se rigen por las leyes de [completar país/provincia]. Cualquier controversia se
      someterá a los tribunales de [completar jurisdicción].</p>
      <h3>9. Contacto</h3>
      <p class="muted">Por consultas sobre estos términos escribinos a [completar email de contacto].</p>
${AVISO}
    </div>
  </section>`,
    },
    privacy: {
      title: 'Política de privacidad',
      html: `  <section>
    <div class="container" style="max-width:760px">
      <h2>Política de privacidad</h2>
      <p class="section-sub">Última actualización: [completar fecha]</p>
      <h3>1. Responsable</h3>
      <p class="muted">${esc(cfg.brand.name)} ([completar razón social y domicilio]) es responsable del tratamiento de los
      datos personales recolectados a través del Sitio.</p>
      <h3>2. Qué datos recolectamos</h3>
      <p class="muted">Los que cargás voluntariamente en formularios del Sitio: nombre, email, teléfono y el contenido de
      tus mensajes${cfg.moduleIds.includes('auth') ? ', y los datos de tu cuenta de usuario (la contraseña se guarda cifrada, nunca en texto plano)' : ''}.</p>
      <h3>3. Para qué los usamos</h3>
      <p class="muted">Para responder tus consultas, prestar el servicio solicitado y, solo si lo aceptaste, enviarte
      novedades. No vendemos ni cedemos tus datos a terceros con fines publicitarios.</p>
      <h3>4. Cookies</h3>
      <p class="muted">El Sitio usa almacenamiento local del navegador para recordar tus preferencias (por ejemplo, tema
      o idioma)${cfg.moduleIds.includes('cookies') ? ' y muestra un aviso de cookies en tu primera visita' : ''}. Podés borrarlo desde la configuración de tu navegador.</p>
      <h3>5. Conservación y seguridad</h3>
      <p class="muted">Conservamos los datos mientras sean necesarios para la finalidad indicada y aplicamos medidas
      razonables de seguridad para protegerlos.</p>
      <h3>6. Tus derechos</h3>
      <p class="muted">Podés pedir el acceso, la rectificación o la eliminación de tus datos escribiendo a
      [completar email de contacto]. [Completar según la normativa aplicable, p. ej. Ley 25.326 en Argentina o RGPD en Europa.]</p>
${AVISO}
    </div>
  </section>`,
    },
  }),
  // Los links van al footer (no a la navbar) para no competir con las páginas principales
  clientJs: () => `/* Módulo páginas legales: links en el footer de todas las páginas */
(function () {
  var footer = document.querySelector('footer .container');
  if (!footer) return;
  var bloque = document.createElement('nav');
  bloque.setAttribute('aria-label', 'Páginas legales');
  bloque.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap';
  [
    { label: 'Términos y condiciones', href: '/terms.html' },
    { label: 'Política de privacidad', href: '/privacy.html' },
  ].forEach(function (l) {
    var a = document.createElement('a');
    a.href = l.href;
    a.textContent = l.label;
    a.style.cssText = 'color:var(--muted);font-size:.85rem';
    bloque.appendChild(a);
  });
  footer.appendChild(bloque);
})();`,
  readmeNotes: () => [
    '**Páginas legales**: los textos de `public/terms.html` y `public/privacy.html` son modelos con campos `[completar…]` (razón social, jurisdicción, email); completalos y hacelos revisar por un profesional antes de publicar.',
  ],
};
