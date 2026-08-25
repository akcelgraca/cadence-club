// O idioma segue o browser e pode ser trocado. Fica guardado para a próxima visita.
(function () {
  var guardado = null;
  try { guardado = localStorage.getItem('cc-lang'); } catch (e) {}
  var inicial = guardado || ((navigator.language || 'pt').slice(0, 2) === 'pt' ? 'pt' : 'en');
  function aplicar(l) {
    document.documentElement.lang = l;
    document.querySelectorAll('[data-lang]').forEach(function (n) {
      n.classList.toggle('ativo', n.getAttribute('data-lang') === l);
    });
    document.querySelectorAll('.idiomas button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.set === l));
    });
    try { localStorage.setItem('cc-lang', l); } catch (e) {}
  }
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.idiomas button').forEach(function (b) {
      b.addEventListener('click', function () { aplicar(b.dataset.set); });
    });
    aplicar(inicial);
  });
})();
