/* ════════════════════════════════════════════════════════════════
   PIXEL PRINT — Module e-shop complet
   Navigation, espace client à onglets, historique, suivi de commande,
   gestion atelier (statuts, n° de suivi, filtres, recherche).
   Se charge après le script principal :  <script src="shop-suivi.js"></script>
   ════════════════════════════════════════════════════════════════ */
(function () {

/* ═══════════ 1. STYLES ═══════════ */
const css = `
.navbtn{position:relative;background:transparent;border:1px solid var(--line);color:var(--txt);border-radius:22px;padding:8px 14px;font-size:12px;font-weight:600;letter-spacing:.06em;transition:.2s;white-space:nowrap}
.navbtn:hover{border-color:var(--gold2);color:var(--gold2)}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px}
.tabs button{background:var(--panel2);border:1px solid var(--line);color:var(--muted);border-radius:24px;padding:11px 20px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;transition:.2s}
.tabs button:hover{border-color:rgba(214,160,96,.5)}
.tabs button.sel{background:var(--gold);border-color:var(--gold);color:#111;font-weight:700}
.tabs .cnt{display:inline-block;margin-left:7px;background:rgba(0,0,0,.25);border-radius:10px;padding:1px 8px;font-size:10px}
.tools{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
.tools input,.tools select{flex:1;min-width:150px;background:rgba(0,0,0,.35);border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:11px 14px;font-size:13.5px}
.tools input:focus,.tools select:focus{outline:none;border-color:var(--gold2)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:22px}
.kpi{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px}
.kpi b{display:block;font-size:22px;font-weight:700;color:var(--gold2);font-family:'Montserrat',sans-serif}
.kpi span{font-size:10.5px;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;font-weight:600}
.tl{display:flex;flex-direction:column;margin-top:16px}
.tl-step{display:flex;align-items:center;gap:12px;padding:7px 0;position:relative}
.tl-step:not(:last-child)::before{content:'';position:absolute;left:9px;top:28px;bottom:-7px;width:2px;background:var(--line)}
.tl-step.done::before{background:var(--gold)}
.tl-dot{width:20px;height:20px;border-radius:50%;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--muted);flex-shrink:0;background:var(--bg);z-index:1}
.tl-step.done .tl-dot{border-color:var(--gold);background:var(--gold);color:#111}
.tl-step.now .tl-dot{border-color:var(--gold);color:var(--gold);box-shadow:0 0 0 4px rgba(217,119,43,.15)}
.tl-lbl{font-size:12.5px;color:var(--muted)}
.tl-step.done .tl-lbl{color:var(--txt2)}
.tl-step.now .tl-lbl{color:var(--gold2);font-weight:700}
.tl-track{font-size:12.5px;color:var(--muted);margin-top:12px;padding:10px 14px;border:1px solid rgba(214,160,96,.3);background:rgba(217,119,43,.06);border-radius:10px}
.tl-track b{color:var(--gold2)}
.ohead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}
.othumbs{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.othumb{width:52px;height:52px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:22px}
.orow{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:var(--muted);padding:3px 0}
.oactions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.oactions .btn-ghost{font-size:11px;padding:9px 16px}
.adminbox{margin-top:16px;padding:16px;border:1px dashed rgba(214,160,96,.35);border-radius:12px;background:rgba(217,119,43,.04)}
.adminbox label{display:block;font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.18em;text-transform:uppercase;margin-bottom:10px}
.profile{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:26px;max-width:520px}
.profile .prow{display:flex;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px solid var(--line);font-size:14px}
.profile .prow:last-of-type{border:none}
.profile .prow span:first-child{color:var(--muted)}
.profile .prow span:last-child{color:var(--txt2);font-weight:600;text-align:right}
.empty{text-align:center;padding:50px 20px;color:var(--muted)}
.empty .ico{font-size:44px;margin-bottom:14px;opacity:.5}
`;
const st = document.createElement('style');
st.textContent = css;
document.head.appendChild(st);

/* ═══════════ 2. BOUTON BOUTIQUE DANS LA NAV ═══════════ */
function injectNav() {
  const links = document.querySelector('nav.main .links');
  if (!links || document.getElementById('navShop')) return;
  const b = document.createElement('button');
  b.id = 'navShop';
  b.className = 'navbtn';
  b.innerHTML = '&#127968; Boutique';
  b.onclick = function () { go('shop'); };
  links.insertBefore(b, links.firstChild);
}
if (document.readyState === 'loading')
  addEventListener('DOMContentLoaded', injectNav);
else injectNav();

/* ═══════════ 3. ÉTAPES DE SUIVI ═══════════ */
const STEPS = [
  'En attente de paiement',
  'Payée — en pré-presse',
  'En production',
  'Expédiée',
  'Livrée'
];
const KO = /annul|échou|echou|expir/i;

function stepIndex(s) {
  const v = String(s || '');
  const i = STEPS.indexOf(v);
  if (i >= 0) return i;
  if (KO.test(v)) return -1;
  if (/livr/i.test(v)) return 4;
  if (/exp[ée]d/i.test(v)) return 3;
  if (/production/i.test(v)) return 2;
  if (/pay|presse/i.test(v)) return 1;
  return 0;
}

function timelineHTML(o) {
  if (stepIndex(o.status) === -1) {
    return `<div class="tl-track" style="border-color:rgba(255,107,129,.4);background:rgba(255,107,129,.08)">
      &#9888; ${o.status} — écrivez-nous à ${ORDER_EMAIL} si vous pensez qu'il s'agit d'une erreur.</div>`;
  }
  const cur = stepIndex(o.status);
  const steps = STEPS.map(function (s, i) {
    const cls = i < cur ? 'done' : (i === cur ? 'now' : '');
    const dot = i < cur ? '✓' : (i === cur ? '●' : '');
    return `<div class="tl-step ${cls}"><span class="tl-dot">${dot}</span><span class="tl-lbl">${s}</span></div>`;
  }).join('');
  const tr = o.tracking
    ? `<div class="tl-track">&#128230; Numéro de suivi : <b>${o.tracking}</b></div>` : '';
  return `<div class="tl">${steps}</div>${tr}`;
}

/* ═══════════ 4. RECOMMANDER ═══════════ */
window.reorder = function (ref) {
  const o = (window.__orders || []).find(function (x) { return x.ref === ref; });
  if (!o) return;
  toast('Reconfigurez votre commande — vos fichiers sont à réenvoyer');
  go('shop');
  setTimeout(function () {
    const first = (o.items && o.items[0]) || null;
    if (!first) return;
    const p = PRODUCTS.find(function (x) { return x.name === first.name; });
    if (p) openConfig(p.id);
  }, 400);
};

/* ═══════════ 5. CARTE COMMANDE ═══════════ */
function orderCard(o, isAdmin) {
  const thumbs = (o.items || []).map(function (i) {
    return `<div class="othumb">${i.ico || '🖨'}</div>`;
  }).join('');

  const items = (o.items || []).map(function (i) {
    return `<li>${i.ico} ${i.name} — ${i.conf} — ${euro(i.price)}
      <span style="opacity:.7">(&#128206; ${i.fileR || ''}${i.fileV ? ' + ' + i.fileV : ''})</span></li>`;
  }).join('');

  const links = (o.fileLinks && o.fileLinks.length)
    ? `<div class="oactions">${o.fileLinks.map(function (f) {
        return `<a class="btn-ghost" href="${f.url}" target="_blank" rel="noopener">&#11015; ${f.label.split(' — ')[0]}</a>`;
      }).join('')}</div>`
    : '';

  const bank = (o.pay === 'Virement' && stepIndex(o.status) === 0)
    ? `<div class="tl-track">&#128179; Virement attendu : <b>${euro(o.total)}</b><br>
       IBAN ${IBAN} — communication <b>${o.ref}</b></div>` : '';

  const who = (isAdmin && o.cust)
    ? `<div style="font-size:12.5px;color:var(--muted);margin-top:10px;padding:12px;background:rgba(0,0,0,.25);border-radius:10px">
        &#128100; <b style="color:var(--txt2)">${o.cust.first} ${o.cust.last}</b>${o.cust.company ? ' — ' + o.cust.company : ''}${o.cust.vat ? ' · TVA ' + o.cust.vat : ''}<br>
        &#9993; ${o.cust.email} · &#128222; ${o.cust.phone}<br>
        &#128205; ${o.cust.street} ${o.cust.num}, ${o.cust.zip} ${o.cust.city} (${o.country || 'Belgique'})
        ${o.cust.notes ? '<br>&#128221; ' + o.cust.notes : ''}
       </div>` : '';

  const admin = isAdmin ? `
    <div class="adminbox">
      <label>Mettre à jour la commande</label>
      <select class="selectw" id="st-${o.ref}">
        ${STEPS.map(function (s) { return `<option ${s === o.status ? 'selected' : ''}>${s}</option>`; }).join('')}
      </select>
      <input class="inp" id="tr-${o.ref}" placeholder="N° de suivi (facultatif)" value="${o.tracking || ''}">
      <button class="btn-main" style="width:100%" onclick="saveStatus('${o.ref}')">Enregistrer</button>
    </div>` : '';

  const reorderBtn = !isAdmin
    ? `<div class="oactions"><button class="btn-ghost" onclick="reorder('${o.ref}')">&#128257; Commander à nouveau</button></div>` : '';

  return `
  <div class="order">
    <div class="ohead">
      <div>
        <b style="color:var(--txt2);font-size:15px">Commande ${o.ref}</b>
        <div style="color:var(--muted);font-size:12.5px;margin-top:2px">Passée le ${o.date} · ${o.pay || ''}</div>
      </div>
      <span class="st">${o.status}</span>
    </div>
    <div class="othumbs">${thumbs}</div>
    ${who}${bank}
    <ul>${items}</ul>
    <div class="orow" style="margin-top:10px;border-top:1px solid var(--line);padding-top:12px">
      <span>Livraison ${o.country || 'Belgique'} estimée</span>
      <span style="color:var(--gold2);font-weight:600">${o.deliv}</span>
    </div>
    <div class="orow"><span>Total TVAC</span>
      <span style="color:var(--gold2);font-weight:700;font-size:17px">${euro(o.total)}</span></div>
    ${timelineHTML(o)}
    ${links}${reorderBtn}${admin}
  </div>`;
}

/* ═══════════ 6. ENREGISTREMENT DU STATUT ═══════════ */
window.saveStatus = async function (ref) {
  if (!window.supa) { toast('Supabase non configuré'); return; }
  const selEl = document.getElementById('st-' + ref);
  const trEl = document.getElementById('tr-' + ref);
  if (!selEl) return;
  const status = selEl.value;
  const tracking = trEl ? trEl.value.trim() : '';
  try {
    const r1 = await supa.from('orders').select('data').eq('ref', ref).single();
    if (r1.error) throw r1.error;
    const d = Object.assign({}, (r1.data && r1.data.data) || {}, { status: status, tracking: tracking });
    const r2 = await supa.from('orders').update({ status: status, data: d }).eq('ref', ref);
    if (r2.error) throw r2.error;
    toast('✔ ' + ref + ' → ' + status);
    window.showDash();
  } catch (e) {
    toast('Erreur : ' + (e.message || 'mise à jour impossible'));
  }
};

/* ═══════════ 7. ONGLETS ET FILTRES ═══════════ */
let TAB = 'orders';
let FILTER = '';
let SEARCH = '';
window.setTab = function (t) { TAB = t; window.showDash(); };
window.setFilter = function (v) { FILTER = v; renderOrders(); };
window.setSearch = function (v) { SEARCH = String(v || '').toLowerCase(); renderOrders(); };

function matches(o) {
  if (FILTER && o.status !== FILTER) return false;
  if (!SEARCH) return true;
  const parts = [o.ref, o.status, o.pay,
    o.cust && o.cust.first, o.cust && o.cust.last,
    o.cust && o.cust.email, o.cust && o.cust.company];
  (o.items || []).forEach(function (i) { parts.push(i.name); });
  return parts.filter(Boolean).join(' ').toLowerCase().indexOf(SEARCH) >= 0;
}

function renderOrders() {
  const isAdmin = window.__isAdmin;
  const list = (window.__orders || []).filter(matches);
  const inner = document.getElementById('ordersInner');
  if (!inner) return;
  inner.innerHTML = list.length
    ? list.map(function (o) { return orderCard(o, isAdmin); }).join('')
    : `<div class="empty"><div class="ico">&#128235;</div>
        ${(SEARCH || FILTER) ? 'Aucune commande ne correspond à cette recherche.'
          : 'Aucune commande pour le moment.'}
        ${(!isAdmin && !SEARCH && !FILTER)
          ? '<br><br><button class="btn-main" onclick="go(\'shop\')">Découvrir le catalogue</button>' : ''}
       </div>`;
}

function tabsHTML(orders) {
  return `<div class="tabs">
    <button class="${TAB === 'orders' ? 'sel' : ''}" onclick="setTab('orders')">
      &#128230; Commandes <span class="cnt">${orders.length}</span></button>
    <button class="${TAB === 'profile' ? 'sel' : ''}" onclick="setTab('profile')">&#128100; Mon profil</button>
    <button onclick="go('shop')">&#127968; Boutique</button>
  </div>`;
}

/* ═══════════ 8. TABLEAU DE BORD ═══════════ */
window.showDash = async function () {
  document.getElementById('authBox').style.display = 'none';
  const rb = document.getElementById('resetBox');
  if (rb) rb.style.display = 'none';
  document.getElementById('dashBox').style.display = 'block';

  const isAdmin = !!(user && user.email &&
    user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  window.__isAdmin = isAdmin;

  document.getElementById('dashHello').textContent =
    isAdmin ? 'Espace Atelier' : 'Bonjour ' + user.name;
  const lbl = document.querySelector('#dashBox .section-label');
  if (lbl) lbl.textContent = isAdmin ? 'Administration' : 'Espace client';

  let orders = [];
  try {
    if (supa && user.id) {
      const res = await supa.from('orders')
        .select('data').order('created_at', { ascending: false });
      orders = (res.data || []).map(function (x) { return x.data; }).filter(Boolean);
    } else {
      orders = JSON.parse(store.get('demo-orders-' + user.email) || '[]').reverse();
    }
  } catch (e) { }
  window.__orders = orders;

  const box = document.getElementById('ordersList');

  /* ---- onglet PROFIL ---- */
  if (TAB === 'profile') {
    const last = orders[0];
    const c = (last && last.cust) || {};
    let spent = 0;
    orders.forEach(function (o) { if (stepIndex(o.status) >= 1) spent += (o.total || 0); });
    box.innerHTML = tabsHTML(orders) + `
      <div class="profile">
        <div class="prow"><span>Nom</span><span>${user.name}</span></div>
        <div class="prow"><span>E-mail</span><span>${user.email}</span></div>
        ${c.phone ? `<div class="prow"><span>Téléphone</span><span>${c.phone}</span></div>` : ''}
        ${c.street ? `<div class="prow"><span>Adresse</span><span>${c.street} ${c.num}<br>${c.zip} ${c.city}</span></div>` : ''}
        ${c.company ? `<div class="prow"><span>Société</span><span>${c.company}</span></div>` : ''}
        ${c.vat ? `<div class="prow"><span>N° TVA</span><span>${c.vat}</span></div>` : ''}
        <div class="prow"><span>Commandes</span><span>${orders.length}</span></div>
        <div class="prow"><span>Total commandé</span><span style="color:var(--gold2)">${euro(spent)}</span></div>
        <div style="margin-top:20px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-main" onclick="go('shop')">← Boutique</button>
          <button class="btn-ghost" onclick="logout()">Se déconnecter</button>
        </div>
        <p style="font-size:12px;color:var(--muted);margin-top:16px">
          Vos coordonnées proviennent de votre dernière commande. Vous pouvez les
          modifier lors de votre prochaine commande.
        </p>
      </div>`;
    go('account');
    return;
  }

  /* ---- onglet COMMANDES ---- */
  let enc = 0;
  orders.forEach(function (o) { if (stepIndex(o.status) >= 1) enc += (o.total || 0); });
  const nbAttente = orders.filter(function (o) { return stepIndex(o.status) === 0; }).length;
  const nbCours = orders.filter(function (o) { return stepIndex(o.status) === 1 || stepIndex(o.status) === 2; }).length;

  const kpis = isAdmin ? `
    <div class="kpis">
      <div class="kpi"><b>${orders.length}</b><span>Commandes</span></div>
      <div class="kpi"><b>${nbAttente}</b><span>À encaisser</span></div>
      <div class="kpi"><b>${nbCours}</b><span>En cours</span></div>
      <div class="kpi"><b>${euro(enc)}</b><span>Encaissé</span></div>
    </div>` : '';

  const tools = orders.length ? `
    <div class="tools">
      <input placeholder="&#128269; Rechercher (référence, client, produit…)" oninput="setSearch(this.value)" value="${SEARCH}">
      <select onchange="setFilter(this.value)">
        <option value="">Tous les statuts</option>
        ${STEPS.map(function (s) { return `<option ${FILTER === s ? 'selected' : ''}>${s}</option>`; }).join('')}
      </select>
    </div>` : '';

  box.innerHTML = tabsHTML(orders) + kpis + tools + '<div id="ordersInner"></div>';
  renderOrders();
  go('account');
};

})();

/* ════════════════════════════════════════════════════════════════
   MODULE COMPLÉMENTAIRE — Panier persistant & e-mail de confirmation
   ════════════════════════════════════════════════════════════════ */
(function () {

/* ═══════════ A. PANIER PERSISTANT ═══════════
   Corrige trois failles :
   1. Le panier créé avant connexion était perdu à la connexion.
   2. Si les fichiers dépassaient le quota du navigateur, tout était perdu
      en silence — désormais on conserve au moins la configuration.
   3. Le panier ne survivait pas toujours à plusieurs heures d'absence.
   Durée de conservation : 30 jours.                                */

const CART_TTL = 30 * 24 * 60 * 60 * 1000;

function cartKeyFor(email) { return 'cart:' + (email || 'guest'); }

function readCart(email) {
  try {
    const raw = store.get(cartKeyFor(email));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;               // ancien format
    if (parsed && Array.isArray(parsed.items)) {
      if (parsed.ts && Date.now() - parsed.ts > CART_TTL) return [];
      return parsed.items;
    }
  } catch (e) { }
  return [];
}

function writeCart(email, items) {
  const key = cartKeyFor(email);
  const wrap = { ts: Date.now(), items: items };
  try {
    store.set(key, JSON.stringify(wrap));
    return true;
  } catch (e) { }
  /* Quota dépassé : on retente sans les fichiers, pour au moins garder
     la configuration du panier. Le client sera prévenu au retour. */
  try {
    const light = items.map(function (c) {
      const o = Object.assign({}, c);
      o.rawR = null; o.rawV = null; o.thumb = null; o.filesLost = true;
      return o;
    });
    store.set(key, JSON.stringify({ ts: Date.now(), items: light }));
  } catch (e2) { }
  return false;
}

window.saveCart = function () {
  const badge = document.getElementById('cartBadge');
  if (badge) badge.textContent = cart.length;
  writeCart(user ? user.email : null, cart);
};

/* Fusion du panier "visiteur" avec celui du compte à la connexion */
function mergeGuestCart() {
  if (!user) return;
  const guest = readCart(null);
  if (!guest.length) return;
  const mine = readCart(user.email);
  const seen = {};
  const merged = mine.concat(guest).filter(function (c) {
    const k = [c.pid, c.qty, c.paperLabel, c.sidesLabel, c.fileR, c.fileV].join('|');
    if (seen[k]) return false;
    seen[k] = 1;
    return true;
  });
  cart = merged;
  writeCart(user.email, cart);
  try { if (store.del) store.del(cartKeyFor(null)); } catch (e) { }
  window.saveCart();
}

/* Restauration au chargement, après le script principal */
function restoreCart() {
  const items = readCart(user ? user.email : null);
  if (items.length) {
    cart = items;
    window.saveCart();
    const lost = items.some(function (c) { return c.filesLost; });
    setTimeout(function () {
      toast(lost
        ? 'Panier retrouvé — vos fichiers sont à réenvoyer'
        : 'Votre panier vous attend (' + items.length + ' article' + (items.length > 1 ? 's' : '') + ')');
    }, 900);
  }
}
setTimeout(function () {
  mergeGuestCart();
  if (!cart.length) restoreCart();
}, 600);

/* À la connexion, on récupère le panier du visiteur.
   Le remplacement est défensif : si la fonction d'origine est introuvable,
   la connexion continue de fonctionner normalement. */
const _afterLogin = (typeof window.afterLogin === 'function')
  ? window.afterLogin
  : (typeof afterLogin === 'function' ? afterLogin : null);
if (_afterLogin) {
  window.afterLogin = async function (msg) {
    try { await _afterLogin(msg); }
    finally { try { mergeGuestCart(); } catch (e) { } }
  };
}

/* ═══════════ B. E-MAIL DE CONFIRMATION AU CLIENT ═══════════
   Message plus complet, signé Pixel Studio, avec récapitulatif,
   suivi de commande et coordonnées bancaires si virement.        */

window.clientMessage = function (order, cust) {
  const L = [];
  L.push('Bonjour ' + cust.first + ',');
  L.push('');
  L.push('Merci pour votre commande chez Pixel Print, le service d\'impression');
  L.push('en ligne de Pixel Studio. Voici le récapitulatif :');
  L.push('');
  L.push('────────────────────────────────────────');
  L.push('COMMANDE ' + order.ref);
  L.push('Passée le ' + order.date);
  L.push('────────────────────────────────────────');
  (order.items || []).forEach(function (it) {
    L.push('• ' + it.name);
    L.push('  ' + it.conf);
    L.push('  Fichier : ' + (it.fileR || '-') + (it.fileV ? ' + ' + it.fileV : ''));
    L.push('  ' + euro(it.price) + ' HTVA');
    L.push('');
  });
  L.push('TOTAL À PAYER : ' + euro(order.total) + ' TVAC');
  L.push('────────────────────────────────────────');
  L.push('');

  if (order.pay === 'Virement') {
    L.push('>>> PAIEMENT PAR VIREMENT');
    L.push('');
    L.push('Merci d\'effectuer le virement de ' + euro(order.total) + ' sur :');
    L.push('  Banque        : ' + BANK);
    L.push('  IBAN          : ' + IBAN);
    L.push('  Bénéficiaire  : Pixel Studio');
    L.push('  Communication : ' + order.ref);
    L.push('');
    L.push('IMPORTANT : indiquez bien "' + order.ref + '" en communication,');
    L.push('c\'est ce qui nous permet d\'identifier votre commande.');
    L.push('');
    L.push('La production démarre dès réception du paiement.');
    L.push('Livraison estimée : ' + order.deliv + ' (à compter de la réception).');
  } else {
    L.push('>>> PAIEMENT ' + String(order.pay).toUpperCase() + ' — BIEN REÇU');
    L.push('');
    L.push('Vos fichiers partent en pré-presse.');
    L.push('Livraison estimée : ' + order.deliv + '.');
  }

  L.push('');
  L.push('LIVRAISON');
  L.push('  ' + cust.first + ' ' + cust.last + (cust.company ? ' — ' + cust.company : ''));
  L.push('  ' + cust.street + ' ' + cust.num);
  L.push('  ' + cust.zip + ' ' + cust.city + ' (' + order.country + ')');
  if (cust.notes) { L.push('  Remarques : ' + cust.notes); }
  L.push('');
  L.push('SUIVRE VOTRE COMMANDE');
  L.push('  https://pxlstudio.be/shop.html');
  L.push('  Connectez-vous à votre espace client pour suivre l\'avancement');
  L.push('  de votre impression, étape par étape.');
  L.push('');
  L.push('RAPPEL');
  L.push('  Vos fichiers sont imprimés tels quels, sans retouche.');
  L.push('  Les produits personnalisés ne bénéficient pas du droit de');
  L.push('  rétractation (art. VI.53, 3° du Code de droit économique).');
  L.push('');
  L.push('Une question ? Répondez simplement à cet e-mail,');
  L.push('ou écrivez-nous à ' + ORDER_EMAIL + '.');
  L.push('');
  L.push('À très vite,');
  L.push('Logan — Pixel Studio');
  L.push('');
  L.push('────────────────────────────────────────');
  L.push('PIXEL STUDIO — Photographie · Print · Web · Marketing digital');
  L.push('BCE BE 1032.720.495 · pxlstudio.be · ' + ORDER_EMAIL);
  return L.join('\n');
};

})();
