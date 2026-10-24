const { esc } = require("../../src/templates");
module.exports = {
  id: "hero", type: "ui", name: "Hero",
  description: "Portada principal con título, bajada y llamado a la acción.",
  html: (cfg) => `  <section class="hero">
    <div class="container">
      <h1>${esc(cfg.texts.heroTitle)}</h1>
      <p>${esc(cfg.texts.heroSubtitle)}</p>
      <a class="btn" href="/about.html">${esc(cfg.texts.heroCta)}</a>
    </div>
  </section>`,
};
