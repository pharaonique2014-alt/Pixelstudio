(function () {
  function current() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function applyVideo(theme) {
    var source = document.getElementById('bgVideoSource');
    if (!source) return;
    var target = theme === 'light' ? 'fond-clair.mp4' : 'fond-v2.mp4';
    if (source.getAttribute('src') !== target) {
      source.setAttribute('src', target);
      var video = document.querySelector('.bg-video');
      if (video) {
        video.load();
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      }
    }
  }

  function updateButtons(theme) {
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.textContent = theme === 'light' ? '🌙' : '☀️';
      btn.setAttribute('aria-label', theme === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair');
      btn.setAttribute('title', theme === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair');
    });
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    try { localStorage.setItem('pxl-theme', theme); } catch (e) {}
    applyVideo(theme);
    updateButtons(theme);
  }

  function toggle() {
    setTheme(current() === 'light' ? 'dark' : 'light');
  }

  window.pxlTheme = { toggle: toggle, set: setTheme, current: current };

  document.addEventListener('DOMContentLoaded', function () {
    setTheme(current());
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.addEventListener('click', toggle);
    });
  });
})();
