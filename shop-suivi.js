/* ════════════════════════════════════════════════════════════════
   PIXEL PRINT — Module e-shop complet
   Navigation, espace client à onglets, historique, suivi de commande,
   gestion atelier (statuts, n° de suivi, filtres, recherche).
   Se charge après le script principal :  <script src="shop-suivi.js"></script>
   ════════════════════════════════════════════════════════════════ */
(function () {

/* Échappement HTML — protège contre l'injection de code via les
   champs remplis par le client (nom, société, adresse, remarques…). */
function esc(v){
  return String(v==null?'':v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
/* N'autorise que les URL http(s) — bloque javascript: et data: */
function safeUrl(u){
  var v=String(u==null?'':u).trim();
  return /^https?:\/\//i.test(v) ? v.replace(/"/g,'%22') : '#';
}

/* ═══════════ 1. STYLES ═══════════ */
const css = `
.navbtn{position:relative;background:transparent;border:1px solid var(--line);color:var(--txt);border-radius:22px;padding:8px 14px;font-size:12px;font-weight:600;letter-spacing:.06em;transition:.2s;white-space:nowrap}
.navbtn:hover{border-color:var(--gold2);color:var(--gold2)}
.tabs{display:flex;gap:8px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-bottom:22px;padding-bottom:2px}
.tabs::-webkit-scrollbar{display:none}
.tabs button{flex:0 0 auto;white-space:nowrap}
.tabs button{background:var(--panel2);border:1px solid var(--line);color:var(--muted);border-radius:24px;padding:11px 20px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;transition:.2s}
.tabs button:hover{border-color:rgba(214,160,96,.5)}
.tabs button.sel{background:var(--gold);border-color:var(--gold);color:#111;font-weight:700}
.tabs .cnt{display:inline-block;margin-left:7px;background:rgba(0,0,0,.25);border-radius:10px;padding:1px 8px;font-size:10px}
.tools{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
.tools input,.tools select{flex:1 1 150px;min-width:0;background:rgba(0,0,0,.35);border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:11px 14px;font-size:13.5px}
.tools input:focus,.tools select:focus{outline:none;border-color:var(--gold2)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:12px;margin-bottom:22px}
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
.orecap{margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}
.ovat{font-size:11.5px;color:var(--gold2);font-style:italic;padding:4px 0}
.adminbox label{display:block;font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.18em;text-transform:uppercase;margin-bottom:10px}
.profile{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:26px;max-width:520px;width:100%;box-sizing:border-box}
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
      &#9888; ${esc(o.status)} — écrivez-nous à ${ORDER_EMAIL} si vous pensez qu'il s'agit d'une erreur.</div>`;
  }
  const cur = stepIndex(o.status);
  const steps = STEPS.map(function (s, i) {
    const cls = i < cur ? 'done' : (i === cur ? 'now' : '');
    const dot = i < cur ? '✓' : (i === cur ? '●' : '');
    return `<div class="tl-step ${cls}"><span class="tl-dot">${dot}</span><span class="tl-lbl">${s}</span></div>`;
  }).join('');
  const tr = o.tracking
    ? `<div class="tl-track">&#128230; Numéro de suivi : <b>${esc(o.tracking)}</b></div>` : '';
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
    return `<div class="othumb">${esc(i.ico || '🖨')}</div>`;
  }).join('');

  const items = (o.items || []).map(function (i) {
    return `<li>${esc(i.ico)} ${esc(i.name)} — ${esc(i.conf)} — ${euro(i.price)}
      <span style="opacity:.7">(&#128206; ${esc(i.fileR || '')}${i.fileV ? ' + ' + esc(i.fileV) : ''})</span></li>`;
  }).join('');

  const links = (o.fileLinks && o.fileLinks.length)
    ? `<div class="oactions">${o.fileLinks.map(function (f) {
        return `<a class="btn-ghost" href="${safeUrl(f.url)}" target="_blank" rel="noopener noreferrer">&#11015; ${esc(String(f.label || '').split(' — ')[0])}</a>`;
      }).join('')}</div>`
    : '';

  const bank = (o.pay === 'Virement' && stepIndex(o.status) === 0)
    ? `<div class="tl-track">&#128179; Virement attendu : <b>${euro(o.total)}</b><br>
       IBAN ${IBAN} — communication <b>${esc(o.ref)}</b></div>` : '';

  const sp = o.ship;
  const who = (isAdmin && o.cust)
    ? `<div style="font-size:12.5px;color:var(--muted);margin-top:10px;padding:12px;background:rgba(0,0,0,.25);border-radius:10px">
        &#128100; <b style="color:var(--txt2)">${esc(o.cust.first)} ${esc(o.cust.last)}</b>${o.cust.company ? ' — ' + esc(o.cust.company) : ''}${o.cust.vat ? ' · TVA ' + esc(o.cust.vat) : ''}<br>
        &#9993; ${esc(o.cust.email)} · &#128222; ${esc(o.cust.phone)}<br>
        &#129534; ${esc(o.cust.street)} ${esc(o.cust.num)}, ${esc(o.cust.zip)} ${esc(o.cust.city)}
        ${o.cust.notes ? '<br>&#128221; ' + esc(o.cust.notes) : ''}
       </div>` : '';
  const shipBlock = sp
    ? `<div class="tl-track" style="margin-top:10px">&#128666; <b>Livraison à une autre adresse</b><br>
        ${esc(sp.name)}${sp.company ? ' — ' + esc(sp.company) : ''}<br>
        ${esc(sp.street)} ${esc(sp.num)}, ${esc(sp.zip)} ${esc(sp.city)} (${esc(sp.country || o.country)})
        ${sp.phone ? '<br>&#128222; ' + esc(sp.phone) : ''}</div>`
    : '';

  const admin = isAdmin ? `
    <div class="adminbox">
      <label>Mettre à jour la commande</label>
      <select class="selectw" id="st-${esc(o.ref)}">
        ${STEPS.map(function (s) { return `<option ${s === o.status ? 'selected' : ''}>${esc(s)}</option>`; }).join('')}
      </select>
      <input class="inp" id="tr-${esc(o.ref)}" placeholder="N° de suivi (facultatif)" value="${esc(o.tracking || '')}">
      <button class="btn-main" style="width:100%" onclick="saveStatus('${esc(o.ref)}')">Enregistrer</button>
    </div>` : '';

  const isPro = o.custKind === 'pro' || (o.cust && o.cust.vat);
  const docs = `<div class="oactions">
      <button class="btn-ghost" onclick="openInvoice('${esc(o.ref)}')">&#129534; Facture</button>
      ${isPro ? `<button class="btn-ghost" onclick="downloadPeppol('${esc(o.ref)}')">&#128228; Peppol (XML)</button>` : ''}
      ${isAdmin ? `<button class="btn-ghost" onclick="supplierSheet('${esc(o.ref)}')">&#127981; Bon fournisseur</button>` : ''}
      ${!isAdmin ? `<button class="btn-ghost" onclick="reorder('${esc(o.ref)}')">&#128257; Commander à nouveau</button>` : ''}
    </div>`;

  const recap = `<div class="orecap">
      <div class="orow"><span>Sous-total HTVA</span><span>${euro(o.subtotal || 0)}</span></div>
      <div class="orow"><span>Livraison</span><span>${o.shipping ? euro(o.shipping) : 'Offerte'}</span></div>
      <div class="orow"><span>${o.reverseVat ? 'TVA — autoliquidation' : 'TVA ' + Math.round((o.vatRate !== undefined ? o.vatRate : .21) * 100) + '%'}</span><span>${euro(o.vat || 0)}</span></div>
      ${o.reverseVat ? '<div class="ovat">Autoliquidation — art. 21 §2 du Code de la TVA</div>' : ''}
      ${o.invoice ? `<div class="orow"><span>N° de facture</span><span>${esc(o.invoice)}</span></div>` : ''}
    </div>`;

  const reorderBtn = recap + docs;

  return `
  <div class="order">
    <div class="ohead">
      <div>
        <b style="color:var(--txt2);font-size:15px">Commande ${esc(o.ref)}</b>
        <div style="color:var(--muted);font-size:12.5px;margin-top:2px">Passée le ${esc(o.date)} · ${esc(o.pay || '')}</div>
      </div>
      <span class="st">${esc(o.status)}</span>
    </div>
    <div class="othumbs">${thumbs}</div>
    ${who}${shipBlock}${bank}
    <ul>${items}</ul>
    <div class="orow" style="margin-top:10px;border-top:1px solid var(--line);padding-top:12px">
      <span>Livraison ${esc(o.country || 'Belgique')} estimée</span>
      <span style="color:var(--gold2);font-weight:600">${esc(o.deliv)}</span>
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
        ${(SEARCH || FILTER) ? 'Aucune commande ne correspond à « ' + esc(SEARCH) + ' ».'
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
        <div class="prow"><span>Nom</span><span>${esc(user.name)}</span></div>
        <div class="prow"><span>E-mail</span><span>${esc(user.email)}</span></div>
        ${c.phone ? `<div class="prow"><span>Téléphone</span><span>${esc(c.phone)}</span></div>` : ''}
        ${c.street ? `<div class="prow"><span>Adresse</span><span>${esc(c.street)} ${esc(c.num)}<br>${esc(c.zip)} ${esc(c.city)}</span></div>` : ''}
        ${c.company ? `<div class="prow"><span>Société</span><span>${esc(c.company)}</span></div>` : ''}
        ${c.vat ? `<div class="prow"><span>N° TVA</span><span>${esc(c.vat)}</span></div>` : ''}
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
      <input placeholder="&#128269; Rechercher (référence, client, produit…)" oninput="setSearch(this.value)" value="${esc(SEARCH)}">
      <select onchange="setFilter(this.value)">
        <option value="">Tous les statuts</option>
        ${STEPS.map(function (s) { return `<option ${FILTER === s ? 'selected' : ''}>${s}</option>`; }).join('')}
      </select>
    </div>` : '';

  box.innerHTML = tabsHTML(orders) + kpis + tools + '<div id="ordersInner"></div>';
  renderOrders();
};

})();


/* ════════════════════════════════════════════════════════════════
   MODULE COMPLÉMENTAIRE — E-mail de confirmation
   La gestion du panier est assurée par shop.html (source unique).
   ════════════════════════════════════════════════════════════════ */
(function () {

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

/* ════════════════════════════════════════════════════════════════
   C. E-MAILS VIA BREVO (remplace FormSubmit)
   Les e-mails partent désormais de projets@pxlstudio.be, en HTML,
   aux couleurs de Pixel Studio, via la fonction Supabase.
   ════════════════════════════════════════════════════════════════ */
(function () {
  if (typeof MOLLIE_FUNCTION_URL !== 'string' || !MOLLIE_FUNCTION_URL) return;

  window.sendOrderEmail = async function (order, cust) {
    var hdr = { 'Content-Type': 'application/json' };
    try {
      if (typeof supa !== 'undefined' && supa) {
        var sess = await supa.auth.getSession();
        var tok = sess && sess.data && sess.data.session && sess.data.session.access_token;
        if (tok) hdr['Authorization'] = 'Bearer ' + tok;
      }
    } catch (e) {}
    const res = await fetch(MOLLIE_FUNCTION_URL, {
      method: 'POST',
      headers: hdr,
      body: JSON.stringify({
        action: 'emails',
        order: order,
        cust: cust,
        paid: false
      })
    });
    if (!res.ok) throw new Error('mail');
    const out = await res.json();
    if (out && out.error) throw new Error(out.error);
    return out;
  };

  /* Les fichiers étant déposés dans le stockage sécurisé et transmis
     par lien dans l'e-mail, l'envoi en pièces jointes n'a plus lieu d'être. */
  window.sendFilesAsAttachments = function () { };
})();

(function () {

const CIE={nom:'Pixel Studio',bce:'BE 1032.720.495',tva:'BE1032720495',
  email:'projets@pxlstudio.be',site:'pxlstudio.be',iban:'BE52 7320 8533 6409',bank:'CBC'};

function esc(s){return String(s==null?'':s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function safeUrl(u){
  var v=String(u==null?'':u).trim();
  return /^https?:\/\//i.test(v)?v.replace(/"/g,'%22'):'#';
}
function n2(v){return Number(v||0).toFixed(2);}
function eu(v){return n2(v).replace('.',',')+' €';}
function isoDate(d){
  const x=d?new Date(d):new Date();
  return isNaN(x)?new Date().toISOString().slice(0,10):x.toISOString().slice(0,10);
}
function frDate(s){
  const p=String(s||'').split('/');
  return (p.length===3)?p[2]+'-'+p[1].padStart(2,'0')+'-'+p[0].padStart(2,'0'):isoDate();
}

function totals(o){
  const sub=Number(o.subtotal||0)||(o.items||[]).reduce(function(a,i){return a+(i.price||0);},0);
  const ship=Number(o.shipping||0);
  const rate=(o.reverseVat?0:(o.vatRate!==undefined?o.vatRate:0.21));
  const vat=Number(o.vat!==undefined?o.vat:(sub+ship)*rate);
  return{sub:sub,ship:ship,rate:rate,vat:vat,total:Number(o.total||sub+ship+vat)};
}

window.invoiceHTML=function(o){
  const c=o.cust||{};
  const t=totals(o);
  const pro=o.custKind==='pro';
  const rows=(o.items||[]).map(function(i){
    return '<tr><td>'+esc(i.name)+'<br><span class="s">'+esc(i.conf)+'</span></td>'+
      '<td class="r">'+eu(i.price)+'</td></tr>';
  }).join('');
  return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'+
  '<title>Facture '+esc(o.invoice||o.ref)+'</title><style>'+
  '@media print{@page{size:A4;margin:16mm}.noprint{display:none}}'+
  'body{font-family:Helvetica,Arial,sans-serif;color:#1c1a17;background:#fff;margin:0;padding:34px;font-size:13px;line-height:1.6}'+
  '.w{max-width:760px;margin:0 auto}'+
  '.hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #d9772b;padding-bottom:18px}'+
  '.hd h1{margin:0;font-size:21px;letter-spacing:5px;text-transform:uppercase;font-weight:600}'+
  '.hd h1 span{color:#d9772b}.hd .sm{font-size:10px;letter-spacing:2px;color:#777;text-transform:uppercase}'+
  '.hd .r{text-align:right}.hd .r b{font-size:17px;display:block}'+
  '.two{display:flex;gap:26px;margin:26px 0}.two>div{flex:1}'+
  '.lb{font-size:9.5px;letter-spacing:2px;text-transform:uppercase;color:#d9772b;font-weight:700;margin-bottom:6px}'+
  'table{width:100%;border-collapse:collapse;margin-top:14px}'+
  'th{text-align:left;font-size:9.5px;letter-spacing:1.6px;text-transform:uppercase;color:#777;border-bottom:1px solid #ddd;padding:8px 0}'+
  'td{padding:11px 0;border-bottom:1px solid #eee;vertical-align:top}'+
  'td.r,th.r{text-align:right}.s{color:#888;font-size:11.5px}'+
  '.tot{margin-top:18px;margin-left:auto;width:270px}'+
  '.tot div{display:flex;justify-content:space-between;padding:5px 0}'+
  '.tot .g{border-top:2px solid #1c1a17;margin-top:7px;padding-top:9px;font-weight:700;font-size:16px}'+
  '.note{margin-top:24px;padding:14px 16px;background:#faf6f1;border-left:3px solid #d9772b;font-size:11.5px}'+
  '.ft{margin-top:30px;border-top:1px solid #ddd;padding-top:14px;font-size:10.5px;color:#777;text-align:center}'+
  '.btn{background:#d9772b;color:#fff;border:none;border-radius:20px;padding:11px 24px;font-size:12px;'+
  'letter-spacing:1.4px;text-transform:uppercase;font-weight:700;cursor:pointer;margin-bottom:20px}'+
  '</style></head><body><div class="w">'+
  '<button class="btn noprint" onclick="window.print()">Imprimer / Enregistrer en PDF</button>'+
  '<div class="hd"><div><h1><span>Pixel</span> Print</h1>'+
    '<div class="sm">by Pixel Studio</div></div>'+
    '<div class="r"><b>FACTURE</b>'+esc(o.invoice||o.ref)+'<br>'+
    '<span class="s">Commande '+esc(o.ref)+'<br>Date : '+esc(o.date||'')+'</span></div></div>'+
  '<div class="two"><div><div class="lb">Vendeur</div>'+CIE.nom+'<br>BCE '+CIE.bce+'<br>TVA '+CIE.tva+
    '<br>'+CIE.email+'<br>'+CIE.site+'</div>'+
  '<div><div class="lb">Client</div>'+esc(c.first)+' '+esc(c.last)+
    (c.company?'<br>'+esc(c.company):'')+
    (c.vat?'<br>TVA '+esc(c.vat):'')+
    '<br>'+esc(c.street)+' '+esc(c.num)+'<br>'+esc(c.zip)+' '+esc(c.city)+
    '<br>'+esc(o.country||'Belgique')+'</div></div>'+
  (o.ship?'<div class="two"><div><div class="lb">Adresse de livraison</div>'+
    esc(o.ship.name)+(o.ship.company?'<br>'+esc(o.ship.company):'')+'<br>'+
    esc(o.ship.street)+' '+esc(o.ship.num)+'<br>'+esc(o.ship.zip)+' '+esc(o.ship.city)+'<br>'+
    esc(o.ship.country||o.country||'')+'</div><div></div></div>':'')+
  '<table><tr><th>Désignation</th><th class="r">Montant HTVA</th></tr>'+rows+'</table>'+
  '<div class="tot">'+
    '<div><span>Sous-total HTVA</span><span>'+eu(t.sub)+'</span></div>'+
    '<div><span>Livraison</span><span>'+(t.ship?eu(t.ship):'Offerte')+'</span></div>'+
    '<div><span>TVA '+(o.reverseVat?'0 %':Math.round(t.rate*100)+' %')+'</span><span>'+eu(t.vat)+'</span></div>'+
    '<div class="g"><span>Total '+(o.reverseVat?'HTVA':'TVAC')+'</span><span>'+eu(t.total)+'</span></div></div>'+
  (o.reverseVat?'<div class="note"><b>Autoliquidation</b> — TVA non applicable, article 21 §2 du Code de la TVA. '+
    'La TVA est due par le preneur.</div>':'')+
  (o.pay==='Virement'?'<div class="note"><b>Paiement par virement</b><br>'+
    'IBAN '+CIE.iban+' ('+CIE.bank+') — bénéficiaire '+CIE.nom+'<br>'+
    'Communication : <b>'+esc(o.ref)+'</b></div>'
    :'<div class="note"><b>Paiement</b> : '+esc(o.pay||'')+' — reçu.</div>')+
  '<div class="note">Produits personnalisés : conformément à l\'article VI.53, 3° du Code de droit économique, '+
    'le droit de rétractation ne s\'applique pas. Réclamations dans les 7 jours suivant la réception.</div>'+
  '<div class="ft">'+CIE.nom+' — Photographie · Print · Site web · Marketing digital<br>'+
    'BCE '+CIE.bce+' · '+CIE.email+' · '+CIE.site+'</div>'+
  '</div></body></html>';
};

window.openInvoice=function(ref){
  const o=(window.__orders||[]).find(function(x){return x.ref===ref;});
  if(!o){toast('Commande introuvable');return;}
  const w=window.open('','_blank');
  if(!w){toast('Autorisez les fenêtres pop-up pour afficher la facture');return;}
  w.document.write(invoiceHTML(o));
  w.document.close();
};

window.peppolXML=function(o){
  const c=o.cust||{};
  const t=totals(o);
  const id=esc(o.invoice||o.ref);
  const issue=frDate(o.date);
  const due=isoDate(new Date(Date.now()+14*864e5));
  const cat=o.reverseVat?'AE':'S';
  const rate=o.reverseVat?0:Math.round(t.rate*100);
  const lines=(o.items||[]).map(function(i,k){
    return '  <cac:InvoiceLine>\n'+
    '    <cbc:ID>'+(k+1)+'</cbc:ID>\n'+
    '    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>\n'+
    '    <cbc:LineExtensionAmount currencyID="EUR">'+n2(i.price)+'</cbc:LineExtensionAmount>\n'+
    '    <cac:Item>\n'+
    '      <cbc:Name>'+esc(i.name)+'</cbc:Name>\n'+
    '      <cbc:Description>'+esc(i.conf)+'</cbc:Description>\n'+
    '      <cac:ClassifiedTaxCategory>\n'+
    '        <cbc:ID>'+cat+'</cbc:ID>\n'+
    '        <cbc:Percent>'+rate+'</cbc:Percent>\n'+
    '        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>\n'+
    '      </cac:ClassifiedTaxCategory>\n'+
    '    </cac:Item>\n'+
    '    <cac:Price><cbc:PriceAmount currencyID="EUR">'+n2(i.price)+'</cbc:PriceAmount></cac:Price>\n'+
    '  </cac:InvoiceLine>\n';
  }).join('');
  const shipLine=t.ship>0?
    '  <cac:AllowanceCharge>\n'+
    '    <cbc:ChargeIndicator>true</cbc:ChargeIndicator>\n'+
    '    <cbc:AllowanceChargeReason>Frais de livraison</cbc:AllowanceChargeReason>\n'+
    '    <cbc:Amount currencyID="EUR">'+n2(t.ship)+'</cbc:Amount>\n'+
    '    <cac:TaxCategory><cbc:ID>'+cat+'</cbc:ID><cbc:Percent>'+rate+'</cbc:Percent>\n'+
    '      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>\n'+
    '  </cac:AllowanceCharge>\n':'';
  return '<?xml version="1.0" encoding="UTF-8"?>\n'+
  '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"\n'+
  '  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"\n'+
  '  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">\n'+
  '  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>\n'+
  '  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>\n'+
  '  <cbc:ID>'+id+'</cbc:ID>\n'+
  '  <cbc:IssueDate>'+issue+'</cbc:IssueDate>\n'+
  '  <cbc:DueDate>'+due+'</cbc:DueDate>\n'+
  '  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>\n'+
  '  <cbc:Note>Commande '+esc(o.ref)+'</cbc:Note>\n'+
  '  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>\n'+
  '  <cac:AccountingSupplierParty><cac:Party>\n'+
  '    <cbc:EndpointID schemeID="9925">'+CIE.tva+'</cbc:EndpointID>\n'+
  '    <cac:PartyName><cbc:Name>'+CIE.nom+'</cbc:Name></cac:PartyName>\n'+
  '    <cac:PostalAddress><cac:Country><cbc:IdentificationCode>BE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>\n'+
  '    <cac:PartyTaxScheme><cbc:CompanyID>'+CIE.tva+'</cbc:CompanyID>\n'+
  '      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>\n'+
  '    <cac:PartyLegalEntity><cbc:RegistrationName>'+CIE.nom+'</cbc:RegistrationName>\n'+
  '      <cbc:CompanyID>'+CIE.tva+'</cbc:CompanyID></cac:PartyLegalEntity>\n'+
  '    <cac:Contact><cbc:ElectronicMail>'+CIE.email+'</cbc:ElectronicMail></cac:Contact>\n'+
  '  </cac:Party></cac:AccountingSupplierParty>\n'+
  '  <cac:AccountingCustomerParty><cac:Party>\n'+
  (c.vat?'    <cbc:EndpointID schemeID="9925">'+esc(c.vat).replace(/[^A-Za-z0-9]/g,'')+'</cbc:EndpointID>\n':'')+
  '    <cac:PartyName><cbc:Name>'+esc(c.company||(c.first+' '+c.last))+'</cbc:Name></cac:PartyName>\n'+
  '    <cac:PostalAddress>\n'+
  '      <cbc:StreetName>'+esc(c.street)+' '+esc(c.num)+'</cbc:StreetName>\n'+
  '      <cbc:CityName>'+esc(c.city)+'</cbc:CityName>\n'+
  '      <cbc:PostalZone>'+esc(c.zip)+'</cbc:PostalZone>\n'+
  '      <cac:Country><cbc:IdentificationCode>'+
      ({'Belgique':'BE','Pays-Bas':'NL','Luxembourg':'LU'}[o.country]||'BE')+
      '</cbc:IdentificationCode></cac:Country>\n'+
  '    </cac:PostalAddress>\n'+
  (c.vat?'    <cac:PartyTaxScheme><cbc:CompanyID>'+esc(c.vat).replace(/[^A-Za-z0-9]/g,'')+'</cbc:CompanyID>\n'+
  '      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>\n':'')+
  '    <cac:PartyLegalEntity><cbc:RegistrationName>'+esc(c.company||(c.first+' '+c.last))+'</cbc:RegistrationName></cac:PartyLegalEntity>\n'+
  '    <cac:Contact><cbc:ElectronicMail>'+esc(c.email)+'</cbc:ElectronicMail></cac:Contact>\n'+
  '  </cac:Party></cac:AccountingCustomerParty>\n'+
  (o.ship?'  <cac:Delivery>\n'+
  '    <cac:DeliveryLocation><cac:Address>\n'+
  '      <cbc:StreetName>'+esc(o.ship.street)+' '+esc(o.ship.num)+'</cbc:StreetName>\n'+
  '      <cbc:CityName>'+esc(o.ship.city)+'</cbc:CityName>\n'+
  '      <cbc:PostalZone>'+esc(o.ship.zip)+'</cbc:PostalZone>\n'+
  '      <cac:Country><cbc:IdentificationCode>'+
    ({'Belgique':'BE','Pays-Bas':'NL','Luxembourg':'LU'}[o.ship.country]||'BE')+
    '</cbc:IdentificationCode></cac:Country>\n'+
  '    </cac:Address></cac:DeliveryLocation>\n'+
  '    <cac:DeliveryParty><cac:PartyName><cbc:Name>'+esc(o.ship.name)+'</cbc:Name></cac:PartyName></cac:DeliveryParty>\n'+
  '  </cac:Delivery>\n':'')+
  '  <cac:PaymentMeans><cbc:PaymentMeansCode>'+(o.pay==='Virement'?'30':'68')+'</cbc:PaymentMeansCode>\n'+
  '    <cbc:PaymentID>'+esc(o.ref)+'</cbc:PaymentID>\n'+
  '    <cac:PayeeFinancialAccount><cbc:ID>'+CIE.iban.replace(/\s/g,'')+'</cbc:ID></cac:PayeeFinancialAccount>\n'+
  '  </cac:PaymentMeans>\n'+
  shipLine+
  '  <cac:TaxTotal>\n'+
  '    <cbc:TaxAmount currencyID="EUR">'+n2(t.vat)+'</cbc:TaxAmount>\n'+
  '    <cac:TaxSubtotal>\n'+
  '      <cbc:TaxableAmount currencyID="EUR">'+n2(t.sub+t.ship)+'</cbc:TaxableAmount>\n'+
  '      <cbc:TaxAmount currencyID="EUR">'+n2(t.vat)+'</cbc:TaxAmount>\n'+
  '      <cac:TaxCategory><cbc:ID>'+cat+'</cbc:ID><cbc:Percent>'+rate+'</cbc:Percent>\n'+
  (o.reverseVat?'        <cbc:TaxExemptionReasonCode>VATEX-EU-AE</cbc:TaxExemptionReasonCode>\n'+
   '        <cbc:TaxExemptionReason>Autoliquidation - article 21 §2 du Code de la TVA</cbc:TaxExemptionReason>\n':'')+
  '        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>\n'+
  '    </cac:TaxSubtotal>\n'+
  '  </cac:TaxTotal>\n'+
  '  <cac:LegalMonetaryTotal>\n'+
  '    <cbc:LineExtensionAmount currencyID="EUR">'+n2(t.sub)+'</cbc:LineExtensionAmount>\n'+
  '    <cbc:TaxExclusiveAmount currencyID="EUR">'+n2(t.sub+t.ship)+'</cbc:TaxExclusiveAmount>\n'+
  '    <cbc:TaxInclusiveAmount currencyID="EUR">'+n2(t.total)+'</cbc:TaxInclusiveAmount>\n'+
  (t.ship>0?'    <cbc:ChargeTotalAmount currencyID="EUR">'+n2(t.ship)+'</cbc:ChargeTotalAmount>\n':'')+
  '    <cbc:PayableAmount currencyID="EUR">'+n2(t.total)+'</cbc:PayableAmount>\n'+
  '  </cac:LegalMonetaryTotal>\n'+
  lines+
  '</Invoice>\n';
};

window.downloadPeppol=function(ref){
  const o=(window.__orders||[]).find(function(x){return x.ref===ref;});
  if(!o){toast('Commande introuvable');return;}
  const blob=new Blob([peppolXML(o)],{type:'application/xml'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='facture-'+(o.invoice||o.ref)+'-peppol.xml';
  document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1500);
  toast('Fichier Peppol téléchargé — à importer dans votre logiciel comptable');
};

window.supplierSheet=function(ref){
  const o=(window.__orders||[]).find(function(x){return x.ref===ref;});
  if(!o){toast('Commande introuvable');return;}
  const c=o.cust||{};
  const rows=(o.items||[]).map(function(i){
    return '<tr><td><b>'+esc(i.name)+'</b><br><span class="s">'+esc(i.conf)+'</span></td>'+
      '<td>'+esc(i.fileR||'—')+(i.fileV?'<br>'+esc(i.fileV):'')+'</td></tr>';
  }).join('');
  const links=(o.fileLinks||[]).map(function(f){
    return '<div><a href="'+safeUrl(f.url)+'" rel="noopener noreferrer">'+esc(f.label)+'</a></div>';}).join('')||'<i>Aucun lien</i>';
  const w=window.open('','_blank');
  if(!w){toast('Autorisez les fenêtres pop-up');return;}
  w.document.write('<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'+
  '<title>Bon de commande fournisseur '+esc(o.ref)+'</title><style>'+
  '@media print{@page{size:A4;margin:15mm}.noprint{display:none}}'+
  'body{font-family:Helvetica,Arial,sans-serif;color:#1c1a17;padding:32px;font-size:13px;line-height:1.6}'+
  '.w{max-width:720px;margin:0 auto}h1{font-size:19px;border-bottom:2px solid #d9772b;padding-bottom:10px}'+
  '.lb{font-size:9.5px;letter-spacing:2px;text-transform:uppercase;color:#d9772b;font-weight:700;margin:20px 0 5px}'+
  'table{width:100%;border-collapse:collapse}td{padding:10px 0;border-bottom:1px solid #eee;vertical-align:top}'+
  '.s{color:#888;font-size:11.5px}a{color:#c25f1c}'+
  '.box{background:#faf6f1;border-left:3px solid #d9772b;padding:12px 15px;margin-top:8px}'+
  '.btn{background:#d9772b;color:#fff;border:none;border-radius:20px;padding:10px 22px;font-size:12px;'+
  'text-transform:uppercase;font-weight:700;cursor:pointer;margin-bottom:18px}'+
  '</style></head><body><div class="w">'+
  '<button class="btn noprint" onclick="window.print()">Imprimer</button>'+
  '<h1>Bon de commande fournisseur — '+esc(o.ref)+'</h1>'+
  '<div class="lb">À produire</div><table>'+rows+'</table>'+
  '<div class="lb">Fichiers d\'impression</div><div class="box">'+links+'</div>'+
  '<div class="lb">'+(o.ship?'Livraison — ADRESSE ALTERNATIVE':'Livraison directe client')+'</div>'+
  '<div class="box">'+(o.ship
    ? esc(o.ship.name)+(o.ship.company?' — '+esc(o.ship.company):'')+'<br>'+
      esc(o.ship.street)+' '+esc(o.ship.num)+'<br>'+esc(o.ship.zip)+' '+esc(o.ship.city)+'<br>'+
      esc(o.ship.country||o.country||'Belgique')+(o.ship.phone?'<br>'+esc(o.ship.phone):'')
    : esc(c.first)+' '+esc(c.last)+(c.company?' — '+esc(c.company):'')+'<br>'+
      esc(c.street)+' '+esc(c.num)+'<br>'+esc(c.zip)+' '+esc(c.city)+'<br>'+
      esc(o.country||'Belgique')+'<br>'+esc(c.phone))+'</div>'+
  '<div class="lb">Échéance</div><div class="box">Livraison promise au client : <b>'+
    esc(o.deliv)+'</b>'+(c.notes?'<br>Remarque client : '+esc(c.notes):'')+'</div>'+
  '</div></body></html>');
  w.document.close();
};

})();
