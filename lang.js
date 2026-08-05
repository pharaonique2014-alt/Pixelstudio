(function () {
  var LANG_KEY = 'pxl-lang';
  var SUPPORTED = ['fr', 'en', 'nl'];
  var LABELS = { fr: 'FR', en: 'EN', nl: 'NL' };

  function normalize(lang) {
    return SUPPORTED.indexOf(lang) > -1 ? lang : 'fr';
  }

  function current() {
    return normalize(document.documentElement.getAttribute('lang'));
  }

  function dictFor(lang) {
    return (window.PXL_I18N && window.PXL_I18N[lang]) || {};
  }

  var ATTR_LIST = ['placeholder', 'title', 'aria-label', 'content', 'alt'];

  function applyTranslations(lang) {
    var dict = dictFor(lang);
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (dict[key] != null) el.textContent = dict[key];
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (dict[key] != null) el.innerHTML = dict[key];
    });
    ATTR_LIST.forEach(function (attr) {
      document.querySelectorAll('[data-i18n-' + attr + ']').forEach(function (el) {
        var key = el.getAttribute('data-i18n-' + attr);
        if (dict[key] != null) el.setAttribute(attr, dict[key]);
      });
    });
  }

  function updateSelects(lang) {
    document.querySelectorAll('.lang-select').forEach(function (sel) {
      sel.value = lang;
    });
  }

  // Injects a <select class="lang-select"> next to every .theme-toggle button
  // that doesn't already have one — keeps every page's nav markup in sync
  // without having to hand-edit all 48 pages individually.
  function injectSelectors() {
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      if (btn.parentElement && btn.parentElement.querySelector('.lang-select')) return;
      var sel = document.createElement('select');
      sel.className = 'lang-select';
      sel.setAttribute('aria-label', 'Choisir la langue');
      sel.title = 'Langue';
      SUPPORTED.forEach(function (l) {
        var opt = document.createElement('option');
        opt.value = l;
        opt.textContent = LABELS[l];
        sel.appendChild(opt);
      });
      btn.insertAdjacentElement('afterend', sel);
    });
  }

  function setLang(lang) {
    lang = normalize(lang);
    document.documentElement.setAttribute('lang', lang);
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    applyTranslations(lang);
    updateSelects(lang);
    document.dispatchEvent(new CustomEvent('pxl-lang-change', { detail: { lang: lang } }));
  }

  function t(key, fallback) {
    var v = dictFor(current())[key];
    return v != null ? v : (fallback != null ? fallback : key);
  }

  window.pxlLang = { set: setLang, current: current, supported: SUPPORTED, t: t };

  document.addEventListener('DOMContentLoaded', function () {
    injectSelectors();
    var stored = 'fr';
    try { stored = localStorage.getItem(LANG_KEY) || 'fr'; } catch (e) {}
    setLang(stored);
    document.querySelectorAll('.lang-select').forEach(function (sel) {
      sel.addEventListener('change', function () { setLang(sel.value); });
    });
  });
})();
