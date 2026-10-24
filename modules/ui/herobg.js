module.exports = {
  id: 'herobg', type: 'ui', name: 'Fondo animado del hero',
  description: 'Fondo decorativo del hero con manchas de color difuminadas que flotan suavemente (estilo aurora), animadas con Anime.js. Puramente estético: respeta "menos movimiento" y no tapa el texto.',
  usesAnime: true,
  requires: ['hero'],
  // No aporta html propio: inyecta la capa de manchas dentro de .hero (si existe) desde el JS.
  // Las manchas ya se ven quietas con solo CSS; Anime.js les da el movimiento de flotado.
  head: () => `  <style>
    .hero{position:relative;overflow:hidden}
    .hero>.container{position:relative;z-index:1}
    .herobg-capa{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
    .herobg-mancha{position:absolute;border-radius:50%;filter:blur(60px);opacity:.5;will-change:transform}
    .herobg-mancha.m1{width:340px;height:340px;top:-80px;left:-60px;background:var(--accent)}
    .herobg-mancha.m2{width:300px;height:300px;bottom:-90px;right:-40px;background:color-mix(in srgb, var(--primary) 60%, var(--accent))}
    .herobg-mancha.m3{width:220px;height:220px;top:40%;left:55%;background:color-mix(in srgb, var(--accent) 55%, var(--bg))}
    @media (prefers-reduced-motion: reduce){.herobg-mancha{opacity:.35}}
  </style>`,
  clientJs: () => `// Módulo fondo animado del hero: crea una capa de manchas difuminadas dentro de .hero
// y las hace flotar con Anime.js (window.anime) en bucle. Es decorativo: sin JS o sin la
// librería, o con "menos movimiento", quedan quietas y el texto del hero se lee igual.
(function () {
  var hero = document.querySelector('.hero');
  if (!hero) return;
  // Construye la capa y las manchas (no van en el HTML para no ensuciar el markup)
  var capa = document.createElement('div');
  capa.className = 'herobg-capa';
  capa.setAttribute('aria-hidden', 'true');
  var clases = ['m1', 'm2', 'm3'];
  var manchas = clases.map(function (c) {
    var d = document.createElement('span');
    d.className = 'herobg-mancha ' + c;
    capa.appendChild(d);
    return d;
  });
  hero.insertBefore(capa, hero.firstChild);
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var anime = window.anime;
  if (!anime || !anime.animate || reduce) return;   // quietas: la capa CSS ya se ve bien
  // Cada mancha flota con un recorrido y ritmo distinto, en bucle de ida y vuelta
  var recorridos = [
    { translateX: [0, 40], translateY: [0, 30], scale: [1, 1.15], duration: 6000 },
    { translateX: [0, -35], translateY: [0, -25], scale: [1, 1.2], duration: 7000 },
    { translateX: [0, 25], translateY: [0, -30], scale: [1, 0.9], duration: 5500 }
  ];
  manchas.forEach(function (m, i) {
    var r = recorridos[i] || recorridos[0];
    anime.animate(m, { translateX: r.translateX, translateY: r.translateY, scale: r.scale, duration: r.duration, loop: true, alternate: true, ease: 'inOutSine' });
  });
})();`,
};
