/* ════════════════════════════════════════════════════════════════
   PIXEL PRINT — Module de suivi de commande
   À charger APRÈS le script principal de shop.html :
   <script src="shop-suivi.js"></script>
   Ajoute : frise de suivi côté client + gestion des statuts côté atelier.
   ════════════════════════════════════════════════════════════════ */
(function () {

  /* ---------- 1. Styles de la frise ---------- */
  const css = `
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
.adminbox{margin-top:16px;padding-top:16px;border-top:1px dashed var(--line)}
.adminbox label{display:block;font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.18em;text-transform:uppercase;margin-bottom:8px}
`;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- 2. Étapes du suivi ---------- */
  const STEPS = [
    'En attente de paiement',
    'Payée — en pré-presse',
    'En production',
    'Expédiée',
    'Livrée'
  ];

  function stepIndex(s) {
    const v = String(s || '');
    const i = STEPS.indexOf(v);
    if (i >= 0) return i;
    if (/livr/i.test(v)) return 4;
    if (/exp/i.test(v)) return 3;
    if (/production/i.test(v)) return 2;
    if (/pay|presse/i.test(v)) return 1;
    if (/annul|échou|echou|expir/i.test(v)) return -1;
    return 0;
  }

  function timelineHTML(o) {
    const cur = stepIndex(o.status);
    if (cur === -1) {
      return `<div class="tl-track" style="border-color:rgba(255,107,129,.4);background:rgba(255,107,129,.08)">
        ⚠ ${o.status} — contactez-nous à ${window.ORDER_EMAIL || 'projets@pxlstudio.be'} si besoin.</div>`;
    }
    const steps = STEPS.map((s, i) => {
      const cls = i < cur ? 'done' : (i === cur ? 'now' : '');
      const dot = i < cur ? '✓' : (i === cur ? '●' : '');
      return `<div class="tl-step ${cls}"><span class="tl-dot">${dot}</span><span class="tl-lbl">${s}</span></div>`;
    }).join('');
    const tr = o.tracking
      ? `<div class="tl-track">📦 Numéro de suivi : <b>${o.tracking}</b></div>`
      : '';
    return `<div class="tl">${steps}</div>${tr}`;
  }

  /* ---------- 3. Bloc de gestion (atelier uniquement) ---------- */
  function adminHTML(o) {
    const opts = STEPS.map(s =>
      `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('');
    return `<div class="adminbox">
      <label>Mettre à jour la commande</label>
      <select class="selectw" id="st-${o.ref}">${opts}</select>
      <input class="inp" id="tr-${o.ref}" placeholder="N° de suivi (facultatif)" value="${o.tracking || ''}">
      <button class="btn-main" style="width:100%" onclick="saveStatus('${o.ref}')">Enregistrer</button>
    </div>`;
  }

  window.saveStatus = async function (ref) {
    if (!window.supa) { toast('Supabase non configuré'); return; }
    const selEl = document.getElementById('st-' + ref);
    const trEl = document.getElementById('tr-' + ref);
    if (!selEl) return;
    const status = selEl.value;
    const tracking = trEl ? trEl.value.trim() : '';
    try {
      const { data, error: e1 } = await supa.from('orders')
        .select('data').eq('ref', ref).single();
      if (e1) throw e1;
      const d = { ...((data && data.data) || {}), status, tracking };
      const { error } = await supa.from('orders')
        .update({ status, data: d }).eq('ref', ref);
      if (error) throw error;
      toast('✔ Commande ' + ref + ' — ' + status);
      showDash();
    } catch (e) {
      toast('Erreur : ' + (e.message || 'mise à jour impossible'));
    }
  };

  /* ---------- 4. Tableau de bord enrichi ---------- */
  window.showDash = async function () {
    document.getElementById('authBox').style.display = 'none';
    const r = document.getElementById('resetBox');
    if (r) r.style.display = 'none';
    document.getElementById('dashBox').style.display = 'block';

    const isAdmin = user && user.email &&
      user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    document.getElementById('dashHello').textContent =
      isAdmin ? 'Espace Atelier' : 'Bonjour ' + user.name;
    document.querySelector('#dashBox .section-label').textContent =
      isAdmin ? 'Administration — toutes les commandes' : 'Mes commandes';

    let orders = [];
    try {
      if (supa && user.id) {
        const { data } = await supa.from('orders')
          .select('data').order('created_at', { ascending: false });
        orders = (data || []).map(x => x.data).filter(Boolean);
      } else {
        orders = JSON.parse(store.get('demo-orders-' + user.email) || '[]').reverse();
      }
    } catch (e) { }

    document.getElementById('ordersList').innerHTML = orders.length
      ? orders.map(o => {
        const links = (o.fileLinks && o.fileLinks.length)
          ? `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">${o.fileLinks.map(f =>
              `<a class="btn-ghost" style="font-size:11px;padding:8px 14px" href="${f.url}" target="_blank" rel="noopener">⬇ ${f.label.split(' — ')[0]}</a>`).join('')}</div>`
          : '';
        const bank = (o.pay === 'Virement' && stepIndex(o.status) === 0)
          ? `<div style="font-size:12.5px;color:var(--muted);margin-top:6px">Virement attendu : <b style="color:var(--gold2)">${euro(o.total)}</b> — ${IBAN} — comm. <b style="color:var(--gold2)">${o.ref}</b></div>`
          : '';
        const who = (isAdmin && o.cust)
          ? `<div style="font-size:12.5px;color:var(--muted);margin-top:4px">👤 ${o.cust.first} ${o.cust.last}${o.cust.company ? ' — ' + o.cust.company : ''} · ${o.cust.email} · ${o.cust.phone}<br>📍 ${o.cust.street} ${o.cust.num}, ${o.cust.zip} ${o.cust.city}${o.cust.notes ? '<br>📝 ' + o.cust.notes : ''}</div>`
          : '';
        const items = (o.items || []).map(i =>
          `<li>${i.ico} ${i.name} — ${i.conf} — ${euro(i.price)} <span style="opacity:.7">(📎 ${i.fileR || ''}${i.fileV ? ' + ' + i.fileV : ''})</span></li>`).join('');
        return `
      <div class="order">
        <div class="top"><b>Commande ${o.ref}</b><span class="st">${o.status}</span></div>
        <div style="color:var(--muted);font-size:13px">Passée le ${o.date} · ${o.pay || ''} · Livraison ${o.country || 'Belgique'} estimée : <b style="color:var(--gold2)">${o.deliv}</b></div>
        ${who}${bank}
        <ul>${items}</ul>
        ${links}
        ${timelineHTML(o)}
        <div style="text-align:right;font-weight:700;margin-top:12px;color:var(--txt2)">Total TVAC : <span style="color:var(--gold2)">${euro(o.total)}</span></div>
        ${isAdmin ? adminHTML(o) : ''}
      </div>`;
      }).join('')
      : '<p style="color:var(--muted)">Aucune commande pour le moment.</p>';

    go('account');
  };

})();
