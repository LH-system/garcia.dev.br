// Executa antes do primeiro paint (sem defer) para evitar "flash" antes do boot.
// O boot aparece só uma vez por sessão e nunca com prefers-reduced-motion.
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  try {
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced && !sessionStorage.getItem('luan.sys:booted')) {
      root.classList.add('booting');
    }
  } catch (e) { /* storage bloqueado: segue sem boot */ }
})();
