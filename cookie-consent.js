(function () {
  var KEY = 'pxl-cookie-consent';

  function getConsent() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function setConsent(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }
  function loadGTMIfAllowed() {
    if (getConsent() === 'accepted' && typeof window.__loadGTM === 'function') {
      window.__loadGTM();
    }
  }

  var styleInjected = false;
  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    var css = '' +
      '.cookie-banner{position:fixed;left:0;right:0;bottom:0;z-index:9998;' +
      'background:rgba(18,16,14,.97);border-top:1px solid rgba(214,160,96,.35);' +
      'padding:18px 20px;transform:translateY(100%);opacity:0;transition:transform .35s ease,opacity .35s ease;' +
      'font-family:Montserrat,Helvetica,Arial,sans-serif;backdrop-filter:blur(10px)}' +
      '.cookie-banner.show{transform:translateY(0);opacity:1}' +
      '.cookie-banner-inner{max-width:960px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px}' +
      '.cookie-banner-inner p{margin:0;color:#e4e1dc;font-size:13px;line-height:1.6;flex:1 1 360px}' +
      '.cookie-banner-inner p a{color:#d6a060;text-decoration:underline}' +
      '.cookie-banner-actions{display:flex;gap:10px;flex-shrink:0}' +
      '.cookie-btn{font-family:inherit;font-size:12.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;' +
      'padding:10px 20px;border-radius:24px;cursor:pointer;border:1px solid rgba(255,255,255,.2);background:transparent;color:#e4e1dc;transition:.2s}' +
      '.cookie-btn.cookie-accept{background:#d9772b;border-color:#d9772b;color:#111}' +
      '.cookie-btn.cookie-accept:hover{background:#c8691f}' +
      '.cookie-btn.cookie-refuse:hover{border-color:#d6a060;color:#d6a060}' +
      '[data-theme="light"] .cookie-banner{background:rgba(251,248,242,.97);border-top-color:rgba(181,115,42,.35)}' +
      '[data-theme="light"] .cookie-banner-inner p{color:#241f1a}' +
      '[data-theme="light"] .cookie-btn{border-color:rgba(0,0,0,.2);color:#241f1a}' +
      '@media (max-width:640px){.cookie-banner-inner{flex-direction:column;align-items:stretch}.cookie-banner-actions{justify-content:stretch}.cookie-btn{flex:1}}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function closeBanner() {
    var el = document.getElementById('cookieBanner');
    if (!el) return;
    el.classList.remove('show');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 350);
  }

  function buildBanner() {
    injectStyle();
    var wrap = document.createElement('div');
    wrap.id = 'cookieBanner';
    wrap.className = 'cookie-banner';
    wrap.innerHTML =
      '<div class="cookie-banner-inner">' +
      '<p>Nous utilisons des cookies pour mesurer l\'audience du site et améliorer votre expérience. ' +
      'Vous pouvez accepter ou refuser leur dépôt. <a href="politique-de-confidentialite.html">En savoir plus</a></p>' +
      '<div class="cookie-banner-actions">' +
      '<button type="button" class="cookie-btn cookie-refuse">Refuser</button>' +
      '<button type="button" class="cookie-btn cookie-accept">Accepter</button>' +
      '</div></div>';
    document.body.appendChild(wrap);
    wrap.querySelector('.cookie-accept').addEventListener('click', function () {
      setConsent('accepted');
      loadGTMIfAllowed();
      closeBanner();
    });
    wrap.querySelector('.cookie-refuse').addEventListener('click', function () {
      setConsent('rejected');
      closeBanner();
    });
    requestAnimationFrame(function () { wrap.classList.add('show'); });
  }

  function openBanner() {
    if (!document.getElementById('cookieBanner')) buildBanner();
  }

  window.pxlCookies = { open: openBanner };

  document.addEventListener('DOMContentLoaded', function () {
    var consent = getConsent();
    if (consent === 'accepted') {
      loadGTMIfAllowed();
    } else if (consent !== 'rejected') {
      buildBanner();
    }
    document.querySelectorAll('.cookie-manage').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        openBanner();
      });
    });
  });
})();
