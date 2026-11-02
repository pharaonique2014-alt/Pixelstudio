/* Belora – site de test (démo). Tout est stocké dans le navigateur. */
(function () {
  "use strict";
  var S = Store; S.load();
  var st = function () { return S.state; };
  var DAY = 864e5, HOUR = 36e5, TRIAL_DAYS = 7;
  var ADMIN_CODE = "belora-test";
  var SMS_CODE = "123456";
  var adminOk = false, tmpPhoto = null, replyTimers = [];
  var current = (location.hash.replace(/^#\/?/, "") || ""), stack = [];

  var PLANS = {
    m: { label: "Mensuel", price: 19.99, days: 30, unit: "par mois", note: "Sans engagement" },
    t: { label: "3 mois", price: 49, days: 90, unit: "pour 3 mois", note: "Soit 16,33 € par mois · économisez 18 %" },
    a: { label: "12 mois", price: 149, days: 365, unit: "pour 12 mois", note: "Soit 12,42 € par mois · économisez 38 %" }
  };
  /* Analyse automatique : chaque message reçu ou envoyé est noté (0 à 3+) */
  var SCAM_RULES = [
    { re: /(virement|western\s*union|\biban\b|\brib\b|bitcoin|crypto|carte\s*cadeau|paysafe|mandat|envoy\w*\s+(moi\s+)?(de\s+l'|des\s+|un\s+peu\s+d')?(argent|sous|euros?)|pr[eê]t\s+d'argent|rembourserai|petit\s+service\s+financier)/i, w: 3, why: "demande d'argent" },
    { re: /(code\s+(re[cç]u|sms)|num[eé]ro\s+de\s+carte|mot\s+de\s+passe|carte\s+d'identit[eé]|photo\s+de\s+votre\s+carte)/i, w: 3, why: "demande d'informations personnelles" },
    { re: /(whats\s*app|telegram|snap(chat)?|messenger|mon\s+(num[eé]ro|gsm|mail)|[\w.+-]+@[\w-]+\.\w+|\+?\d[\d\s.]{8,}\d)/i, w: 2, why: "invite à quitter Belora" },
    { re: /(urgent|urgence|h[oô]pital|accident|h[eé]ritage|douane|colis|bloqu[eé]|dettes?|facture\s+impay)/i, w: 2, why: "histoire dramatique ou pression" },
    { re: /(https?:\/\/|www\.|\.ru\b|\.xyz\b)/i, w: 2, why: "lien suspect" },
    { re: /(je\s+t'aime|mon\s+amour|[aâ]me\s+s[oœ]ur|je\s+n'ai\s+jamais\s+ressenti)/i, w: 1, why: "déclaration très rapide" }
  ];
  function scamScan(text) {
    var score = 0, why = [];
    SCAM_RULES.forEach(function (r) { if (r.re.test(text)) { score += r.w; why.push(r.why); } });
    return { level: score >= 3 ? 3 : score >= 2 ? 2 : 0, why: why };
  }
  var pendingMsg = null;
  var NORMAL_REPLIES = [
    "Bonjour {p} ! Ravi(e) de vous lire. Vous venez à une sortie prochainement ?",
    "Avec plaisir ! J'adore ce genre d'activité. Et vous, qu'est-ce que vous aimez faire d'autre ?",
    "Quelle bonne idée ! On se retrouve sur place alors. À bientôt !"
  ];
  var SUSPECT_REPLIES = [
    "Bonjour, vous avez un très joli profil. Écrivez-moi sur WhatsApp, ce sera plus simple.",
    "Je traverse une période difficile, pourriez-vous me faire un petit virement ? Je vous rembourserai.",
    "C'est très urgent, un colis est bloqué à la douane. Voici mon IBAN pour que vous m'avanciez la somme."
  ];
  var REPORT_REASONS = ["Demande d'argent ou arnaque", "Faux profil / photo qui n'est pas la sienne", "Comportement irrespectueux ou harcèlement", "Contenu inapproprié", "Autre"];

  /* ---------- Outils ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  var norm = function (s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
  var eur = function (n) { return n.toLocaleString("fr-BE", { style: "currency", currency: "EUR" }); };
  var fmtDay = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long" });
  var fmtHour = new Intl.DateTimeFormat("fr-BE", { hour: "2-digit", minute: "2-digit" });
  var fmtShort = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  function when(iso) { var d = new Date(iso); return cap(fmtDay.format(d)) + " à " + fmtHour.format(d).replace(":", "h"); }
  function go(path) { if (current) stack.push(current); if (stack.length > 40) stack.shift(); current = path; render(); }
  function back() { var p = stack.pop(); current = p === undefined ? (st().me ? "activites" : "bienvenue") : p; render(); }
  window.__route = function () { return current; };
  function persist() { S.save(); }

  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 3600);
  }
  function openModal(html) {
    var m = $("#modal"); $("#modalbox").innerHTML = emo(html); m.hidden = false;
    var f = $("#modalbox").querySelector("button,input,select,textarea,a"); if (f) f.focus();
  }
  function closeModal() { $("#modal").hidden = true; $("#modalbox").innerHTML = ""; }

  /* ---------- Règles métier ---------- */
  function normPhone(raw) {
    var p = String(raw).replace(/[\s.\-()\/]/g, "");
    if (p.indexOf("00") === 0) p = "+" + p.slice(2);
    if (/^04\d{8}$/.test(p)) return "+32" + p.slice(1);
    if (/^0[67]\d{8}$/.test(p)) return "+33" + p.slice(1);
    if (/^\+324\d{8}$/.test(p) || /^\+33[67]\d{8}$/.test(p)) return p;
    return null;
  }
  function dist(a, b) {
    var A = BELORA_CITIES[a], B = BELORA_CITIES[b]; if (!A || !B) return 0;
    var t = Math.PI / 180, dLat = (B[0] - A[0]) * t, dLon = (B[1] - A[1]) * t;
    var x = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(A[0] * t) * Math.cos(B[0] * t) * Math.pow(Math.sin(dLon / 2), 2);
    return Math.round(2 * 6371 * Math.asin(Math.sqrt(x)));
  }
  function subState() {
    var s = st().sub, now = S.now();
    if (s.status === "active" && s.endsAt > now) return "active";
    if (s.status === "cancelled" && s.endsAt > now) return "cancelled";
    if (s.trialStart && now < s.trialStart + TRIAL_DAYS * DAY) return "trial";
    if (s.trialStart || s.status !== "none") return "expired";
    return "none";
  }
  function hasAccess() { return ["active", "cancelled", "trial"].indexOf(subState()) > -1; }
  function trialLeft() { var s = st().sub; return Math.max(0, Math.ceil((s.trialStart + TRIAL_DAYS * DAY - S.now()) / DAY)); }
  function actById(id) { return st().activities.filter(function (a) { return a.id === id; })[0]; }
  function userById(id) { return id === "me" ? st().me : st().users.filter(function (u) { return u.id === id; })[0]; }
  function participants(a) {
    return a.inscrits.filter(function (id) {
      if (id === "me") return true;
      var u = userById(id); return u && !u.suspended && st().blocked.indexOf(id) < 0;
    });
  }
  function isJoined(id) { return st().joined.indexOf(id) > -1; }
  function isPast(a) { return new Date(a.date).getTime() + 2 * HOUR <= S.now(); }
  function weight(id, a) {
    if (id === "me") return isCouple(st().me) ? ((st().party || {})[a.id] || 2) : 1;
    var u = userById(id); if (!u) return 1;
    if (a && a.parts && a.parts[id]) return a.parts[id];
    return isCouple(u) ? 2 : 1;
  }
  function seatsUsed(a) { return participants(a).reduce(function (n, id) { return n + weight(id, a); }, 0); }
  function seatsLeft(a) { return Math.max(0, a.places - seatsUsed(a)); }
  function isCouple(u) { return !!u && u.situation === "couple"; }
  function ageTxt(u) { return isCouple(u) ? "Couple" : u.age + " ans"; }
  function nameAge(u) { return isCouple(u) ? u.prenom : u.prenom + ", " + u.age + " ans"; }
  function butLabel(u) { return isCouple(u) ? "Des amis et des sorties à deux" : BUT[u.but || "ouvert"].label; }
  function cannotJoin(a) {
    var me = st().me, left = seatsLeft(a);
    if (isCouple(me) && a.ambiance === "rencontres") return "Réservé aux personnes seules";
    if (left === 0) return "Complet";
    return "";
  }
  function priceLabel(a) { return a.prix ? eur(a.prix) : "Gratuit"; }
  function avatar(u, o) {
    o = o || {};
    var inner = u.photo ? '<img alt="" src="' + esc(u.photo) + '">' : esc((u.prenom || "?").charAt(0).toUpperCase());
    return '<span class="avatar' + (o.blur ? " blur" : "") + (o.big ? " big" : "") + '" style="' + (o.s ? "--s:" + o.s + ";" : "") + 'background:' + esc(u.color || "#1F3A5F") + '" aria-hidden="true">' + inner + "</span>";
  }
  function addReport(type, id, reason, text, auto) {
    st().reports.push({ id: "r" + Date.now() + Math.floor(Math.random() * 1000), type: type, target: id, reason: reason, text: text || "", at: S.now(), auto: !!auto });
    if (type === "user") {
      var n = st().reports.filter(function (r) { return r.type === "user" && r.target === id; }).length;
      var u = userById(id); if (u && n >= 3) u.suspended = true;
    }
    persist();
  }


  /* ---------- Icônes et aides d'affichage ---------- */
  var ICONS = {
    cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.800 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/>',
    euro: '<path d="M18 7a7 7 0 1 0 0 10M4 10h9M4 14h9"/>',
    users: '<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20c0-3.600 2.900-6 6.500-6s6.500 2.400 6.500 6"/><path d="M16 5a3.500 3.500 0 0 1 0 7M18 14.500c2.200.8 3.500 2.700 3.500 5.500"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    shield: '<path d="M12 3l8 3v6c0 4.500-3.200 8-8 9-4.800-1-8-4.500-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
    gift: '<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 13h18M12 9c-3 0-4.500-4-2-4.500 2-.3 2 2.500 2 4.500zM12 9c3 0 4.500-4 2-4.500-2-.3-2 2.500-2 4.500z"/>',
    route: '<circle cx="6" cy="18" r="2.500"/><circle cx="18" cy="6" r="2.500"/><path d="M8.500 18H15a3.500 3.500 0 0 0 0-7H9a3.500 3.500 0 0 1 0-7h6"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.500v.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    arrow: '<path d="M9 6l6 6-6 6"/>',
    heart: '<path d="M12 20s-7-4.600-7-10a4 4 0 0 1 7-2.500A4 4 0 0 1 19 10c0 5.400-7 10-7 10z"/>',
    arrowL: '<path d="M15 6l-6 6 6 6"/>'
  };
  function ic(n, c) { return '<svg class="ic' + (c ? " " + c : "") + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + "</svg>"; }
  var EMO = { "🔒": "lock", "📍": "pin", "🗓": "cal", "💶": "euro", "👥": "users", "🛡": "shield", "🎁": "gift", "⚠": "alert", "🚶": "route", "🤝": "users", "✔": "check" };
  function emo(h) { return h.replace(/(🔒|📍|🗓|💶|👥|🛡|🎁|⚠|🚶|🤝|✔|🎉|👋|😀|🙂|🙁|👤|📅)️?/g, function (m, k) { return EMO[k] ? ic(EMO[k]) : ""; }); }
  var BUT = BELORA_BUT, AMB = BELORA_AMB;
  function seatsPct(a) { return Math.min(100, Math.round(seatsUsed(a) / a.places * 100)); }
  function butTag(u) { if (u && u.situation === "couple") return '<span class="tag but-ouvert">Couple</span>'; return u && u.but && BUT[u.but] ? '<span class="tag but-' + u.but + '">' + BUT[u.but].short + "</span>" : ""; }
  function ambTag(a) { return a.ambiance && a.ambiance !== "tous" ? '<span class="amb ' + a.ambiance + '">' + AMB[a.ambiance] + "</span>" : ""; }
  var CATC = { Marche: "#2E7D5B", Repas: "#D9503A", Culture: "#2B4C7A", Danse: "#B8407A", Jeux: "#A86B0A", Voyage: "#1F8A9A" };
  var fmtWd = new Intl.DateTimeFormat("fr-BE", { weekday: "short" }), fmtMo = new Intl.DateTimeFormat("fr-BE", { month: "short" });
  function dparts(iso) { var d = new Date(iso); return { wd: fmtWd.format(d).replace(".", ""), day: d.getDate(), mo: fmtMo.format(d).replace(".", ""), h: fmtHour.format(d).replace(":", "h") }; }
  function dbox(iso, big) { var p = dparts(iso); return '<div class="datebox' + (big ? " big" : "") + '"><span>' + p.wd + "</span><b>" + p.day + "</b><span>" + p.mo + "</span></div>"; }


  /* ---------- Questionnaire (QCM) ---------- */
  var QUESTIONS = BELORA_QUESTIONS, qState = null, lastCur = null;
  function repOf(u) { return (u && u.rep) || {}; }
  function filled(v) { return Array.isArray(v) ? v.length > 0 : !!v; }
  function answeredCount(u) { var r = repOf(u); return QUESTIONS.filter(function (q) { return filled(r[q.id]); }).length; }
  function compat(a, b) {
    var ra = repOf(a), rb = repOf(b), sum = 0, n = 0, common = [];
    QUESTIONS.forEach(function (q) {
      var x = ra[q.id], y = rb[q.id]; if (!filled(x) || !filled(y)) return; n++;
      if (q.multi) { var inter = x.filter(function (v) { return y.indexOf(v) > -1; }); sum += inter.length / (x.length + y.length - inter.length); common = common.concat(inter); }
      else if (x === y) { sum += 1; common.push(x); }
    });
    return n >= 3 ? { pct: Math.round(sum / n * 100), common: common } : null;
  }
  function pubTags(u, withCompat) {
    var r = repOf(u), t = [];
    QUESTIONS.forEach(function (q) { if (q.pub && filled(r[q.id])) t.push('<span class="tag pub">' + esc(q.short ? q.short[r[q.id]] || r[q.id] : r[q.id]) + "</span>"); });
    var c = withCompat ? compat(st().me, u) : null;
    if (c) t.push('<span class="tag ok">' + c.pct + " % compatible</span>");
    return t.length ? '<span class="ptags">' + t.join("") + "</span>" : "";
  }
  function answersList(u, title) {
    var r = repOf(u), rows = QUESTIONS.filter(function (q) { return filled(r[q.id]); }).map(function (q) {
      var v = r[q.id]; return "<li><span>" + esc(q.label) + "</span><b>" + esc(Array.isArray(v) ? v.join(", ") : v) + "</b></li>";
    }).join("");
    return rows ? '<h3 class="qa-title">' + esc(title) + '</h3><ul class="qa">' + rows + "</ul>" : "";
  }
  function memberAnswers(u) {
    var c = compat(st().me, u), h = "";
    if (c) h += '<p class="compat"><b>' + c.pct + " % compatible</b>" + (c.common.length ? '<br><span class="small muted">Points communs : ' + c.common.map(esc).join(" · ") + "</span>" : "") + "</p>";
    return h + answersList(u, "À propos de " + u.prenom);
  }
  function startQuestions(signup) { qState = { i: 0, ans: JSON.parse(JSON.stringify(st().me.rep || {})), signup: !!signup }; go("questions"); }
  function showTips(prenom) {
    openModal('<h2>Bienvenue sur Belora, ' + esc(prenom) + ' !</h2><p>Trois conseils pour des rencontres sereines :</p><ul class="small"><li>Rendez-vous toujours dans un lieu public.</li><li>Ne donnez jamais d\'argent, même à quelqu\'un de sympathique.</li><li>Un doute ? Utilisez le bouton « Signaler ».</li></ul><button class="btn primary block" data-action="close">J\'ai compris</button>');
  }
  function finishQuestions() {
    var signup = qState && qState.signup;
    if (qState) { st().me.rep = qState.ans; persist(); }
    qState = null;
    if (signup) { go("activites"); showTips(st().me.prenom); } else { toast("Réponses enregistrées."); go("profil"); }
  }

  /* ---------- Vues ---------- */
  var V = {};

  V.bienvenue = function () {
    var pts = [["route", "Des sorties près de chez vous", "Marches, repas, thés dansants, visites : choisissez ce qui vous plaît."],
      ["users", "Amis, sorties ou rencontre amoureuse", "Seul(e) ou en couple, vous indiquez ce que vous cherchez et trouvez les sorties qui vous correspondent."],
      ["shield", "Votre sécurité d'abord", "Numéro de GSM vérifié, alertes contre les arnaques, signalement en un geste."],
      ["gift", "7 jours gratuits", "Puis 19,99 € par mois, sans engagement, résiliable en un clic."]];
    return '<section class="wpanel"><svg class="wbg" viewBox="0 0 300 260" aria-hidden="true"><path transform="translate(90,120) scale(2.2)" d="M0 40 C-54 4 -48 -44 -20 -46 C-8 -47 -2 -38 0 -31 C2 -38 8 -47 20 -46 C48 -44 54 4 0 40Z" fill="#fff" fill-opacity=".13"/><path transform="translate(205,150) scale(2.6)" d="M0 40 C-54 4 -48 -44 -20 -46 C-8 -47 -2 -38 0 -31 C2 -38 8 -47 20 -46 C48 -44 54 4 0 40Z" fill="#fff" fill-opacity=".10"/></svg>' +
      '<img src="assets/belora-icone-arrondie.svg" alt="" width="84" height="84"><h1>Belora</h1><p>Des sorties près de chez vous et des rencontres bienveillantes, pour les 50 ans et plus.</p></section>' +
      '<ul class="pts">' + pts.map(function (x) { return '<li><span class="pi">' + ic(x[0]) + "</span><div><b>" + x[1] + "</b><span>" + x[2] + "</span></div></li>"; }).join("") + "</ul>" +
      '<div class="info small"><b>Vous testez Belora ?</b> Aucun SMS ni paiement réel : le code de vérification est <b>123456</b>. Vos données restent sur votre téléphone. Essayez de vous inscrire, de rejoindre une sortie, de regarder qui participe et d\'écrire un message. Dites-nous ce qui vous semble confus.</div>' +
      '<a class="btn primary block big" href="#/connexion">Commencer</a>' +
      '<p class="footer-links"><a href="#/cgu">Conditions</a><a href="#/confidentialite">Confidentialité</a><a href="#/admin">Espace admin (démo)</a></p>';
  };

  V.connexion = function () {
    return '<a class="back" href="#/bienvenue">← Retour</a><h1>Votre numéro de GSM</h1>' +
      '<p>Nous vous envoyons un code par SMS pour vérifier votre numéro. C\'est tout : pas de mot de passe à retenir.</p>' +
      '<form data-form="phone" novalidate><label for="phone">Numéro de GSM</label>' +
      '<input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0470 12 34 56" required>' +
      '<p class="hint">Numéros belges (+32) et français (+33) uniquement.</p><div id="err"></div>' +
      '<button class="btn primary block" type="submit">Recevoir mon code</button></form>';
  };

  V.code = function () {
    var p = st().pending;
    if (!p) { go("connexion"); return ""; }
    return '<a class="back" href="#/connexion">← Changer de numéro</a><h1>Entrez votre code</h1>' +
      '<p>Un SMS a été envoyé au <b>' + esc(p.phone) + '</b>.</p>' +
      '<div class="info">Mode démo : aucun SMS n\'est réellement envoyé. Utilisez le code <b>' + SMS_CODE + "</b>.</div>" +
      '<form data-form="code" novalidate><label for="code">Code à 6 chiffres</label>' +
      '<input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" required>' +
      '<div id="err"></div><button class="btn primary block" type="submit">Valider</button></form>';
  };

  function profileForm(edit) {
    var me = edit ? st().me : {}, sel = me.interets || [];
    tmpPhoto = null;
    var cities = Object.keys(BELORA_CITIES).map(function (c) {
      return '<option' + (me.ville === c ? " selected" : "") + ">" + esc(c) + "</option>";
    }).join("");
    var chips = BELORA_INTERESTS.map(function (i) {
      return '<label class="chipbox"><input type="checkbox" name="interets" value="' + esc(i) + '"' + (sel.indexOf(i) > -1 ? " checked" : "") + "><span>" + esc(i) + "</span></label>";
    }).join("");
    return (edit ? '<a class="back" href="#/profil">← Retour</a>' : "") +
      "<h1>" + (edit ? "Modifier mon profil" : "Créons votre profil") + "</h1>" +
      '<form data-form="' + (edit ? "profile-edit" : "profile-new") + '" novalidate>' +
      '<div class="label">Vous vous inscrivez</div><div class="plans">' + [["seul", "Seul(e)"], ["couple", "En couple, à deux"]].map(function (o) {
        return '<label class="plan"><input type="radio" name="situation" value="' + o[0] + '"' + ((me.situation || "seul") === o[0] ? " checked" : "") + '><span class="box"><b>' + o[1] + "</b></span></label>";
      }).join("") + "</div>" +
      '<label for="prenom">Votre prénom <span class="muted small">(pour un couple : vos deux prénoms)</span></label><input id="prenom" name="prenom" type="text" autocomplete="given-name" maxlength="30" value="' + esc(me.prenom || "") + '" required>' +
      '<label for="age">Votre âge <span class="muted small">(pour un couple : l\'âge de la personne la plus jeune)</span></label><input id="age" name="age" type="number" inputmode="numeric" min="50" max="99" value="' + esc(me.age || "") + '" required>' +
      '<label for="ville">Votre ville (pour trouver les sorties proches)</label><select id="ville" name="ville">' + cities + "</select>" +
      '<div id="romance"' + ((me.situation || "seul") === "couple" ? " hidden" : "") + '><div class="label">Ce que vous cherchez</div><div class="plans">' + ["amitie", "couple", "ouvert"].map(function (k) {
        var cur = me.but || "ouvert";
        return '<label class="plan"><input type="radio" name="but" value="' + k + '"' + (cur === k ? " checked" : "") + '><span class="box"><b>' + BUT[k].label + "</b></span></label>";
      }).join("") + "</div>" +
      '<div class="info small" style="margin-top:12px"><b>Facultatif.</b> Ces deux informations servent à mieux vous proposer des sorties et des personnes. Elles ne sont montrées qu\'aux membres abonnés, et vous pouvez les laisser vides.</div>' +
      '<div class="row"><div style="flex:1;min-width:150px"><label for="genre">Je suis</label><select id="genre" name="genre"><option value="">Je préfère ne pas dire</option><option value="F"' + (me.genre === "F" ? " selected" : "") + '>Une femme</option><option value="H"' + (me.genre === "H" ? " selected" : "") + '>Un homme</option></select></div>' +
      '<div style="flex:1;min-width:150px"><label for="cherche">Je souhaite rencontrer</label><select id="cherche" name="cherche"><option value="">Peu importe</option><option value="femmes"' + (me.cherche === "femmes" ? " selected" : "") + '>Des femmes</option><option value="hommes"' + (me.cherche === "hommes" ? " selected" : "") + '>Des hommes</option></select></div></div></div>' +
      '<div class="info small" id="couplenote"' + ((me.situation || "seul") === "couple" ? "" : " hidden") + '>Les couples cherchent des amis et des sorties à deux. Pour chaque sortie, vous choisissez si vous venez à deux ou si un seul de vous deux vient. Les soirées réservées aux célibataires ne vous sont pas proposées.</div>' +
      '<div class="label">Vos centres d\'intérêt</div><div class="chips">' + chips + "</div>" +
      '<label for="bio">Quelques mots sur vous (facultatif)</label><textarea id="bio" name="bio" maxlength="280" placeholder="Ce que vous aimez, ce que vous cherchez…">' + esc(me.bio || "") + "</textarea>" +
      '<label for="photo">Votre photo (facultatif)</label><div class="row">' + avatar(me.prenom ? me : { prenom: "?", color: "#9AA5B8" }, {}) +
      '<input id="photo" name="photo" type="file" accept="image/*"></div><p class="hint">Une vraie photo de vous inspire confiance.</p>' +
      (edit ? "" : '<label class="chipbox" style="display:flex;gap:10px;align-items:flex-start;margin-top:18px;font-weight:400"><input type="checkbox" name="cgu" style="position:static;opacity:1;width:28px;height:28px;flex:none"><span style="border:0;background:none;display:block;padding:0;font-weight:400;min-height:0;font-size:.85rem">J\'ai 50 ans ou plus et j\'accepte les <a href="#/cgu" target="_blank">conditions</a> et la <a href="#/confidentialite" target="_blank">politique de confidentialité</a>.</span></label>') +
      '<div id="err"></div><button class="btn primary block" style="margin-top:14px" type="submit">' + (edit ? "Enregistrer" : "Terminer mon inscription") + "</button></form>";
  }
  V["creer-profil"] = function () {
    if (!st().pending || !st().pending.verified) { go("connexion"); return ""; }
    return profileForm(false);
  };
  V["profil-modifier"] = function () { return profileForm(true); };

  function stackHtml(a) {
    var ppl = participants(a), acc = hasAccess();
    if (!ppl.length) return '<span class="small muted">Soyez le premier</span>';
    return '<span class="stack">' + ppl.slice(0, 4).map(function (id) { return avatar(userById(id), { blur: !acc && id !== "me", s: "32px" }); }).join("") +
      (ppl.length > 4 ? '<span class="more">+' + (ppl.length - 4) + "</span>" : "") + "</span>";
  }
  function actCard(a, d) {
    var joined = isJoined(a.id), left = seatsLeft(a), n = participants(a).length, pct = seatsPct(a), p = dparts(a.date), why = cannotJoin(a);
    var btn = joined ? '<button class="btn ok block" data-action="open-act" data-id="' + a.id + '">' + ic("check") + " Inscrit(e) · voir</button>" :
      why ? '<button class="btn block" disabled>' + why + '</button>' :
      '<button class="btn primary block" data-action="join" data-id="' + a.id + '">Je participe</button>';
    return '<article class="act" style="--cat:' + (CATC[a.cat] || "#1F3A5F") + '" data-action="open-act" data-id="' + a.id + '">' +
      '<div class="act-main">' + dbox(a.date) + '<div class="act-body"><span class="cat">' + esc(a.cat) + "</span>" + ambTag(a) + "<h3>" + esc(a.titre) + "</h3>" +
      '<p class="meta">' + ic("clock") + p.h + '<span class="sep"></span>' + ic("pin") + esc(a.ville) + (d ? " · " + d + " km" : "") + '</p></div><span class="price-pill">' + priceLabel(a) + "</span></div>" +
      '<div class="act-foot">' + stackHtml(a) + '<div class="seats"><span>' + (left === 0 ? "Complet" : left + " place" + (left > 1 ? "s" : "") + " restante" + (left > 1 ? "s" : "")) + '</span><i><b style="width:' + pct + '%"></b></i></div></div>' + btn + "</article>";
  }
  function filteredActs() {
    var f = st().filters, ville = f.ville || st().me.ville, now = S.now();
    return st().activities.filter(function (a) { return new Date(a.date).getTime() + 2 * HOUR > now; })
      .map(function (a) { return { a: a, d: dist(ville, a.ville) }; })
      .filter(function (x) {
        return x.d <= f.rayon && (!f.cat || x.a.cat === f.cat) && (!f.amb || x.a.ambiance === "tous" || x.a.ambiance === f.amb) &&
          (!f.q || norm(x.a.titre + " " + x.a.lieu + " " + x.a.ville + " " + x.a.cat).indexOf(norm(f.q)) > -1);
      })
      .sort(function (p, q) { return new Date(p.a.date) - new Date(q.a.date); });
  }
  function listHtml() {
    var r = filteredActs();
    if (!r.length) return '<div class="card center"><p><b>Aucune activité trouvée.</b></p><p class="muted">Essayez d\'élargir la distance ou de changer de ville.</p></div>';
    return '<p class="count" aria-live="polite">' + r.length + " activité" + (r.length > 1 ? "s" : "") + " à découvrir</p>" + r.map(function (x) { return actCard(x.a, x.d); }).join("");
  }
  V.activites = function () {
    var f = st().filters, ville = f.ville || st().me.ville, ss = subState(), banner = "";
    if (ss === "trial") banner = '<a class="trialbar" href="#/abonnement">' + ic("gift") + "<span><b>Essai gratuit</b> · encore " + trialLeft() + " jour" + (trialLeft() > 1 ? "s" : "") + "</span>" + ic("arrow") + "</a>";
    if (ss === "expired") banner = '<div class="card paywall"><h3>Votre essai est terminé</h3><p>Abonnez-vous pour revoir les profils et écrire aux autres participants.</p><a class="btn primary block" href="#/abonnement">Voir l\'abonnement</a></div>';
    var cities = Object.keys(BELORA_CITIES).map(function (c) { return "<option" + (c === ville ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("");
    var rayons = [[10, "10 km"], [25, "25 km"], [50, "50 km"], [100, "100 km"], [999, "Partout"]].map(function (r) {
      return '<option value="' + r[0] + '"' + (f.rayon === r[0] ? " selected" : "") + ">" + r[1] + "</option>";
    }).join("");
    var cats = ['<button class="chip' + (!f.cat ? " on" : "") + '" data-action="filter-cat" data-v="">Toutes</button>'].concat(BELORA_CATS.map(function (c) {
      return '<button class="chip' + (f.cat === c ? " on" : "") + '" data-action="filter-cat" data-v="' + c + '">' + c + "</button>";
    })).join("");
    var ambs = [["", "Tout"], ["amis", "Entre amis"], ["rencontres", "Rencontres"]].map(function (o) {
      return '<button class="chip' + ((f.amb || "") === o[0] ? " on" : "") + '" data-action="filter-amb" data-v="' + o[0] + '">' + o[1] + "</button>";
    }).join("");
    return '<header class="pagehead"><p class="eyebrow">Bonjour ' + esc(st().me.prenom) + "</p><h1>Sorties près de chez vous</h1></header>" + banner +
      '<div class="filters"><div class="selrow"><label class="selpill">' + ic("pin") + '<span class="sr">Ma ville</span><select id="f-ville" data-filter="ville">' + cities + "</select></label>" +
      '<label class="selpill narrow">' + ic("route") + '<span class="sr">Distance</span><select id="f-rayon" data-filter="rayon">' + rayons + "</select></label></div>" +
      '<div class="searchbox">' + ic("search") + '<label for="f-q" class="sr">Rechercher</label><input id="f-q" data-filter="q" type="text" placeholder="Marche, danse, repas…" value="' + esc(f.q) + '"></div>' +
      '<div class="chips scroll" aria-label="Type de sortie">' + ambs + "</div>" +
      '<div class="chips scroll">' + cats + "</div></div>" +
      '<div id="actlist">' + listHtml() + "</div>";
  };

  V.activite = function (id) {
    var a = actById(id); if (!a) { go("activites"); return ""; }
    var acc = hasAccess(), joined = isJoined(a.id), left = seatsLeft(a), ppl = participants(a), d = dist(st().me.ville, a.ville);
    var btn = isPast(a) ? '<button class="btn" disabled>Terminée</button>' : joined ?
      '<button class="btn danger" data-action="leave" data-id="' + a.id + '">Me désinscrire</button>' :
      cannotJoin(a) ? '<button class="btn" disabled>' + cannotJoin(a) + '</button>' : '<button class="btn primary" data-action="join" data-id="' + a.id + '">' + (isCouple(st().me) ? "Nous participons" : "Je participe") + '</button>';
    var list = ppl.length ? ppl.map(function (pid) {
      var u = userById(pid), me = pid === "me";
      return '<a class="person" href="#/membre/' + pid + '">' + avatar(u, { blur: !acc && !me }) +
        '<span class="meta"><b>' + esc(u.prenom) + (me ? " (vous)" : "") + " " + butTag(u) + "</b>" +
        (me || acc ? '<span class="small muted">' + esc(ageTxt(u)) + (isCouple(u) ? (weight(pid, a) === 2 ? " · à deux" : " · un seul des deux") : "") + " · " + esc(u.ville) + "</span>" : '<span class="lock">🔒 Profil complet réservé aux abonnés</span>') + pubTags(u, !me && acc) + '</span><span class="chev" aria-hidden="true">' + ic("arrow") + "</span></a>";
    }).join("") : "<p>Personne pour l'instant. Soyez le premier ou la première à vous inscrire !</p>";
    var cta = !acc && ppl.length ? '<a class="btn navy block" style="margin-top:10px" href="#/abonnement">Voir les profils complets · 7 jours gratuits</a>' : "";
    var fact = function (i, t, sub) { return "<li>" + ic(i) + "<span><b>" + t + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + "</span></li>"; };
    return '<a class="back" href="#" data-action="back">' + ic("arrowL") + " Retour</a>" +
      '<article class="detail" style="--cat:' + (CATC[a.cat] || "#1F3A5F") + '"><div class="dhead">' + dbox(a.date, true) + '<div><span class="cat">' + esc(a.cat) + "</span>" + ambTag(a) + "<h1>" + esc(a.titre) + "</h1></div></div>" +
      '<ul class="facts">' + fact("clock", esc(when(a.date))) + fact("pin", esc(a.lieu), esc(a.ville) + (d ? " · à " + d + " km" : "")) +
      fact(a.ambiance === "rencontres" ? "heart" : "users", AMB[a.ambiance || "tous"], a.ambiance === "rencontres" ? "Pour celles et ceux qui souhaitent faire une rencontre amoureuse" : a.ambiance === "amis" ? "Ambiance conviviale, sans attente amoureuse" : "Amis ou rencontres, chacun à son rythme") +
      fact("euro", priceLabel(a), a.prix ? "par personne" : "Chacun règle ses consommations") +
      fact("users", ppl.length + " inscrit" + (ppl.length > 1 ? "s" : ""), left + " place" + (left > 1 ? "s" : "") + " restante" + (left > 1 ? "s" : "")) + "</ul>" +
      '<p class="desc">' + esc(a.desc) + '</p><p class="small muted">Organisé par ' + esc(a.orga) + " · Source : " + esc(a.source) + "</p></article>" +
      '<section class="card"><h2>Qui participe ?</h2>' + (joined && isCouple(st().me) ? '<p class="small">Vous venez ' + (weight("me", a) === 2 ? "à deux" : "seul(e) (un seul de vous deux)") + ' · <a href="#" data-action="change-party" data-id="' + a.id + '">Modifier</a></p>' : "") + list + cta + "</section>" +
      '<aside class="card info"><h3>🛡️ Pour votre sécurité</h3><p class="small">Rendez-vous toujours dans un lieu public. Ne donnez jamais d\'argent ni de coordonnées bancaires. Si quelque chose vous gêne, signalez-le : on s\'en occupe.</p></aside>' +
      '<p class="center"><a href="#" data-action="report-act" data-id="' + a.id + '">Signaler cette activité</a></p>' +
      '<div class="actionbar"><div class="ab-info"><b>' + priceLabel(a) + "</b><small>" + esc(dparts(a.date).wd) + " " + dparts(a.date).day + " " + esc(dparts(a.date).mo) + " · " + dparts(a.date).h + "</small></div>" + btn + "</div>";
  };

  V.questions = function () {
    if (!qState) qState = { i: 0, ans: JSON.parse(JSON.stringify(st().me.rep || {})), signup: false };
    var Q = QUESTIONS, i = qState.i, q = Q[i], cur = qState.ans[q.id], last = i === Q.length - 1;
    var isOn = function (o) { return q.multi ? (cur || []).indexOf(o) > -1 : cur === o; };
    return '<div class="qhead"><span>Question ' + (i + 1) + " sur " + Q.length + '</span><a href="#" data-action="q-quit">' + (qState.signup ? "Terminer plus tard" : "Enregistrer et quitter") + "</a></div>" +
      '<div class="qbar" role="progressbar" aria-valuemin="0" aria-valuemax="' + Q.length + '" aria-valuenow="' + (i + 1) + '"><i style="width:' + Math.round((i + 1) / Q.length * 100) + '%"></i></div>' +
      '<h1 class="qtitle">' + esc(q.q) + "</h1>" + (q.multi ? '<p class="muted small">Plusieurs réponses possibles.</p>' : "") +
      (q.pub ? '<p class="small muted">👥 Cette réponse est visible par tous les membres.</p>' : "") +
      '<div class="qopts">' + q.opts.map(function (o) {
        return '<button type="button" class="qopt' + (isOn(o) ? " on" : "") + '" data-action="q-pick" data-v="' + esc(o) + '" aria-pressed="' + isOn(o) + '">' + (isOn(o) ? "✔" : "") + "<span>" + esc(o) + "</span></button>";
      }).join("") + "</div>" +
      '<div class="qnav">' + (i > 0 ? '<button type="button" class="btn ghost" data-action="q-prev">Précédent</button>' : "<span></span>") + '<button type="button" class="btn primary" data-action="q-next">' + (last ? "Terminer" : "Suivant") + "</button></div>" +
      '<p class="center"><a href="#" data-action="q-next">Passer cette question</a></p>';
  };

  V.membre = function (id) {
    var u = userById(id); if (!u) { go("activites"); return ""; }
    if (id === "me") { go("profil"); return ""; }
    if (u.suspended || st().blocked.indexOf(id) > -1) return '<a class="back" href="#/activites">← Retour</a><div class="card"><p>Ce profil n\'est plus disponible.</p></div>';
    var acc = hasAccess();
    if (!acc) return '<a class="back" href="#" data-action="back">← Retour</a><section class="card center">' + avatar(u, { big: true, blur: true }) +
      "<h1 style=\"margin-top:10px\">" + esc(u.prenom) + '</h1><p>' + pubTags(u) + '</p><p>🔒 La photo, l\'âge, la présentation, la compatibilité et les autres réponses sont réservés aux abonnés.</p>' +
      '<a class="btn primary block" href="#/abonnement">Voir les profils – 7 jours gratuits</a></section>';
    var common = st().activities.filter(function (a) { return a.inscrits.indexOf(id) > -1 && isJoined(a.id); });
    return '<a class="back" href="#" data-action="back">← Retour</a><section class="card center">' + avatar(u, { big: true }) +
      "<h1 style=\"margin-top:10px\">" + esc(nameAge(u)) + "</h1><p>📍 " + esc(u.ville) + ' · <span class="tag ok">Numéro vérifié ✔</span></p>' +
      '<div class="chips" style="justify-content:center">' + u.interets.map(function (i) { return '<span class="tag">' + esc(i) + "</span>"; }).join("") + "</div>" +
      '<p class="small" style="margin:10px 0 0"><b>Cherche :</b> ' + esc(butLabel(u)) + (!isCouple(u) && u.but !== "amitie" && u.cherche ? " · souhaite rencontrer " + esc(u.cherche) : "") + "</p>" +
      '<p style="margin-top:8px">' + esc(u.bio) + "</p>" + memberAnswers(u) +
      (common.length ? '<p class="small muted">Vous participez aussi à : ' + common.map(function (a) { return esc(a.titre); }).join(", ") + "</p>" : "") +
      '<a class="btn primary block" href="#/messages/' + id + '">Écrire à ' + esc(u.prenom) + "</a>" +
      '<div class="row" style="justify-content:center;margin-top:10px"><button class="btn small ghost" data-action="report-user" data-id="' + id + '">Signaler</button><button class="btn small ghost" data-action="block" data-id="' + id + '">Bloquer</button></div></section>';
  };

  V.sorties = function () {
    var mine = st().joined.map(actById).filter(Boolean).sort(function (p, q) { return new Date(p.date) - new Date(q.date); });
    var up = mine.filter(function (a) { return !isPast(a); }), past = mine.filter(isPast);
    var h = "<h1>Mes sorties</h1>";
    if (!mine.length) return h + '<div class="card center"><p><b>Vous n\'êtes inscrit(e) à aucune sortie.</b></p><p class="muted">Choisissez une activité qui vous plaît !</p><a class="btn primary block" href="#/activites">Voir les activités</a></div>';
    if (up.length) h += "<h2>À venir</h2>" + up.map(function (a) { return actCard(a, 0); }).join("");
    if (past.length) {
      h += "<h2>Terminées</h2>" + past.map(function (a) {
        var fb = st().feedback[a.id];
        if (fb) return '<div class="card"><h3>' + esc(a.titre) + '</h3><p class="success">Merci pour votre retour !</p></div>';
        var others = participants(a).filter(function (p) { return p !== "me"; }).map(function (p) {
          var u = userById(p); return '<label class="chipbox"><input type="checkbox" name="revoir" value="' + p + '"><span>' + esc(u.prenom) + "</span></label>";
        }).join("");
        return '<form class="card" data-form="feedback" data-id="' + a.id + '"><h3>' + esc(a.titre) + '</h3><p class="muted small">' + esc(when(a.date)) + "</p>" +
          '<div class="label">Comment s\'est passée la sortie ?</div><div class="chips">' +
          [["3", "😀 Très bien"], ["2", "🙂 Bien"], ["1", "🙁 Pas terrible"]].map(function (o) { return '<label class="chipbox"><input type="radio" name="note" value="' + o[0] + '"><span>' + o[1] + "</span></label>"; }).join("") + "</div>" +
          (others ? '<div class="label">Souhaitez-vous revoir certaines personnes ?</div><div class="chips">' + others + "</div>" : "") +
          '<button class="btn navy block" style="margin-top:14px" type="submit">Envoyer mon avis</button></form>';
      }).join("");
    }
    return h;
  };

  function paywall(txt) {
    var ss = subState();
    return '<section class="card paywall"><h2>🔒 ' + esc(txt) + "</h2><p>" + (ss === "expired" ? "Votre essai est terminé. Abonnez-vous pour continuer : 19,99 € par mois, sans engagement." : "Essayez gratuitement pendant 7 jours : l'essai démarre dès votre première inscription à une sortie.") + '</p><a class="btn primary block" href="#/abonnement">Voir l\'abonnement</a></section>';
  }
  V.messages = function () {
    if (!hasAccess()) return "<h1>Messages</h1>" + paywall("Les messages sont réservés aux abonnés");
    var ids = Object.keys(st().conversations).filter(function (id) { return st().blocked.indexOf(id) < 0 && (st().conversations[id] || []).length; });
    var h = "<h1>Messages</h1>";
    if (!ids.length) return h + '<div class="card center"><p><b>Aucune conversation pour l\'instant.</b></p><p class="muted">Ouvrez la fiche d\'une personne qui participe à une sortie pour lui écrire.</p><a class="btn primary block" href="#/activites">Voir les activités</a></div>';
    return h + '<div class="card">' + ids.map(function (id) {
      var u = userById(id), th = st().conversations[id], last = th[th.length - 1];
      return '<a class="person" href="#/messages/' + id + '">' + avatar(u) + '<span class="meta"><b>' + esc(u.prenom) + (st().unread[id] ? ' <span class="tag">nouveau</span>' : "") + '</b><span class="small muted">' + esc(last.from === "them" && last.risk === 3 && !last.shown ? "⚠️ Message masqué (arnaque probable)" : last.text.slice(0, 60)) + "</span></span></a>";
    }).join("") + "</div>";
  };
  function whyTxt(m) { return m.why && m.why.length ? " (" + esc(m.why.join(", ")) + ")" : ""; }
  function bubble(m, i, uid) {
    var time = "<time>" + fmtShort.format(new Date(m.at)) + "</time>";
    if (m.from === "them" && m.risk === 3 && !m.shown)
      return '<div class="bubble masked"><b>⚠️ Message masqué par Belora</b><br><span class="small">Il ressemble à une tentative d\'arnaque' + whyTxt(m) + '. Ne répondez pas et ne donnez ni argent ni coordonnées.</span>' +
        '<div class="row" style="margin-top:8px"><button class="btn small ghost" data-action="show-msg" data-id="' + uid + '" data-i="' + i + '">Afficher quand même</button></div></div>';
    var warn = "";
    if (m.risk >= 2) warn = '<div class="scam" role="alert">⚠️ ' + (m.from === "them" ? "Attention : ce message est suspect" : "Ce message contient des éléments sensibles") + whyTxt(m) + '. Ne donnez jamais d\'argent ni vos coordonnées bancaires.</div>';
    return '<div class="bubble' + (m.from === "me" ? " me" : "") + '">' + esc(m.text) + time + "</div>" + warn;
  }
  V.conv = function (id) {
    if (!hasAccess()) { go("abonnement"); return ""; }
    var u = userById(id); if (!u || u.suspended || st().blocked.indexOf(id) > -1) { go("messages"); return ""; }
    delete st().unread[id]; persist(); refreshDot();
    var th = st().conversations[id] || [];
    var mine = st().me.but, theirs = u.but, hint = "";
    if (isCouple(u)) hint = '<div class="info small">' + esc(u.prenom) + " est un couple qui cherche des amis et des sorties à deux.</div>";
    else if (mine !== theirs && (mine === "couple" || theirs === "couple") && (mine === "amitie" || theirs === "amitie"))
      hint = '<div class="info small">' + (theirs === "amitie" ? esc(u.prenom) + " cherche surtout des amis pour sortir. Soyez clair(e) sur vos intentions, avec respect." : esc(u.prenom) + " cherche une relation amoureuse, alors que vous cherchez des amis. Dites-le simplement dès le début.") + "</div>";
    return '<a class="back" href="#/messages">← Messages</a><div class="row between"><a class="person" style="border:0" href="#/membre/' + id + '">' + avatar(u) + "<b>" + esc(u.prenom) + " " + butTag(u) + '</b></a>' +
      '<button class="btn small ghost" data-action="report-user" data-id="' + id + '">Signaler</button></div>' +
      hint + '<p class="shield small"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 4.500-3.200 8-8 9-4.800-1-8-4.500-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg> Protection anti-arnaque active : les messages sont analysés automatiquement par une machine.</p><div class="bubbles" id="thread">' + (th.length ? th.map(function (m, i) { return bubble(m, i, id); }).join("") : '<p class="muted">Dites bonjour à ' + esc(u.prenom) + " !</p>") + "</div>" +
      '<form class="composer" data-form="send" data-id="' + id + '"><label for="msg" class="sr" style="position:absolute;left:-9999px">Votre message</label><input id="msg" name="msg" type="text" autocomplete="off" placeholder="Votre message…" maxlength="500"><button class="btn primary" type="submit">Envoyer</button></form>';
  };

  V.profil = function () {
    var me = st().me, ss = subState(), label = {
      none: "Pas d'abonnement", trial: "Essai gratuit (" + (st().sub.trialStart ? trialLeft() : 0) + " j restants)", active: "Abonné(e) – " + (st().sub.plan ? PLANS[st().sub.plan].label : ""),
      cancelled: "Résilié – actif jusqu'au " + (st().sub.endsAt ? new Date(st().sub.endsAt).toLocaleDateString("fr-BE") : ""), expired: "Essai ou abonnement terminé"
    }[ss];
    var shift = st().shiftDays ? " (démo : +" + st().shiftDays + " j)" : "";
    return '<section class="card center">' + avatar(me, { big: true }) + '<h1 style="margin-top:10px">' + esc(nameAge(me)) + "</h1><p>📍 " + esc(me.ville) + ' · <span class="tag ok">Numéro vérifié ✔</span></p>' +
      "<p>" + esc(me.bio || "") + '</p><a class="btn ghost block" href="#/profil/modifier">Modifier mon profil</a></section>' +
      (function () { var n = answeredCount(me), pc = Math.round(n / QUESTIONS.length * 100);
        return '<section class="card"><h2>Mon profil complété à ' + pc + ' %</h2><div class="qbar"><i style="width:' + pc + '%"></i></div><p class="small muted">' + n + " réponse" + (n > 1 ? "s" : "") + " sur " + QUESTIONS.length + ". Plus votre profil est complet, plus on vous propose des personnes qui vous ressemblent.</p>" + answersList(me, "Mes réponses") +
          '<button class="btn primary block" style="margin-top:12px" data-action="q-start">' + (n ? "Modifier mes réponses" : "Répondre aux questions") + "</button></section>"; })() +
      '<section class="card"><h2>Mon abonnement</h2><p>' + esc(label) + '</p><a class="btn primary block" href="#/abonnement">Gérer mon abonnement</a></section>' +
      '<section class="card"><h2>Votre avis sur le site</h2><p class="small muted">Qu\'est-ce qui vous a plu ? Qu\'est-ce qui vous a gêné ou paru compliqué ?</p><label for="fb" class="sr">Votre avis</label><textarea id="fb" placeholder="Écrivez ici…"></textarea><button class="btn navy block" style="margin-top:10px" data-action="copy-fb">Copier mon avis</button><p class="small muted">Collez-le ensuite dans un message à la personne qui vous a envoyé ce lien.</p></section>' +
      '<section class="card"><h2>Confort de lecture</h2><button class="btn ghost block" data-action="toggle-size">' + (st().bigText ? "Texte normal" : "Agrandir le texte") + "</button></section>" +
      '<section class="card"><h2>Outils de démonstration</h2><p class="small muted">Pour tester l\'essai gratuit et les sorties passées' + esc(shift) + ".</p>" +
      '<div class="row"><button class="btn small ghost" data-action="shift" data-d="1">Avancer d\'1 jour</button><button class="btn small ghost" data-action="shift" data-d="7">Avancer de 7 jours</button></div>' +
      '<div class="divider"></div><button class="btn small danger" data-action="reset-demo">Réinitialiser toute la démo</button></section>' +
      '<section class="card"><h2>Mes données</h2><p class="small muted">Vous pouvez supprimer votre compte et toutes vos données à tout moment.</p><button class="btn danger block" data-action="delete-account">Supprimer mon compte</button></section>' +
      '<p class="footer-links"><a href="#/cgu">Conditions</a><a href="#/confidentialite">Confidentialité</a><a href="#/admin">Espace admin (démo)</a></p>';
  };

  V.abonnement = function () {
    var ss = subState(), s = st().sub, head;
    if (ss === "trial") head = '<div class="success">🎁 Essai gratuit en cours : encore ' + trialLeft() + " jour" + (trialLeft() > 1 ? "s" : "") + ".</div>";
    else if (ss === "active") head = '<div class="success">✔ Abonnement actif jusqu\'au ' + new Date(s.endsAt).toLocaleDateString("fr-BE") + ".</div>";
    else if (ss === "cancelled") head = '<div class="info">Abonnement résilié. Vous gardez l\'accès jusqu\'au ' + new Date(s.endsAt).toLocaleDateString("fr-BE") + ".</div>";
    else if (ss === "expired") head = '<div class="error">Votre essai est terminé. Abonnez-vous pour retrouver les messages et les profils.</div>';
    else head = '<div class="info">7 jours gratuits, sans carte bancaire. L\'essai démarre dès votre première inscription à une sortie.</div>';
    var plans = Object.keys(PLANS).map(function (k, i) {
      var p = PLANS[k];
      return '<label class="plan"><input type="radio" name="plan" value="' + k + '"' + (i === 0 ? " checked" : "") + '><span class="box"><span><b>' + p.label + '</b><br><span class="small muted">' + p.note + '</span></span><span class="p">' + eur(p.price) + "<small>" + p.unit + "</small></span></span></label>";
    }).join("");
    var canTrial = ss === "none";
    var cta = ss === "active" ? '<button class="btn danger block" data-action="cancel-sub">Résilier mon abonnement</button>' :
      (canTrial ? '<button class="btn primary block" data-action="start-trial">Commencer mes 7 jours gratuits</button><div style="height:10px"></div>' : "") +
      (ss === "cancelled" || ss === "active" ? "" : '<button class="btn ' + (canTrial ? "ghost" : "primary") + ' block" data-action="subscribe">S\'abonner maintenant</button>');
    return '<a class="back" href="#" data-action="back">← Retour</a><h1>Mon abonnement</h1>' + head +
      '<section class="card"><h2>Gratuit pour tous</h2><p class="small">✔ Voir toutes les activités<br>✔ S\'inscrire aux sorties<br>✔ Voir le prénom des participants</p>' +
      '<h2>Avec l\'abonnement</h2><p class="small">✔ Voir les profils complets (photo, âge, présentation)<br>✔ Écrire et répondre aux messages<br>✔ Alertes anti-arnaque sur vos conversations<br>✔ Assistance par téléphone</p></section>' +
      '<section class="card"><h2>Choisir ma formule</h2><div class="plans">' + plans + "</div>" + cta +
      '<p class="small muted" style="margin-top:12px">Résiliable en un clic, à tout moment. Droit de rétractation de 14 jours. Paiement sécurisé (dans la vraie version : carte ou Bancontact via Stripe).</p></section>';
  };

  V.cgu = function () {
    return '<a class="back" href="#" data-action="back">← Retour</a><h1>Conditions d\'utilisation</h1><div class="info">Texte de démonstration, à faire valider par un juriste avant tout lancement.</div>' +
      '<div class="card"><h3>L\'essentiel</h3><p class="small">Belora est réservé aux personnes de 50 ans et plus. Vous vous engagez à fournir des informations exactes, à respecter les autres membres, et à ne jamais demander ni proposer d\'argent. Les sorties ont lieu dans des lieux publics.</p>' +
      '<h3>Abonnement</h3><p class="small">7 jours d\'essai gratuit, puis 19,99 € par mois (ou 49 € pour 3 mois, 149 € pour 12 mois). Résiliation en un clic. Droit de rétractation de 14 jours.</p>' +
      '<h3>Modération</h3><p class="small">Les profils signalés plusieurs fois sont suspendus. Nous pouvons exclure toute personne qui ne respecte pas ces règles.</p></div>';
  };
  V.confidentialite = function () {
    return '<a class="back" href="#" data-action="back">← Retour</a><h1>Confidentialité</h1><div class="info">Texte de démonstration, à faire valider avant lancement (RGPD).</div>' +
      '<div class="card"><h3>Données collectées</h3><p class="small">Numéro de GSM, prénom, âge, ville, centres d\'intérêt, présentation, photo (facultative) et messages.</p>' +
      '<h3>Pourquoi ?</h3><p class="small">Vérifier votre identité par SMS, vous proposer des sorties proches, permettre les échanges et protéger la communauté contre les arnaques.</p>' +
      '<h3>Protection contre les arnaques</h3><p class="small">Vos messages sont analysés automatiquement par une machine pour repérer les demandes d\'argent et les tentatives d\'arnaque. Personne ne les lit, sauf si un message est signalé.</p>' +
      '<h3>Vos droits</h3><p class="small">Accès, rectification, suppression de vos données à tout moment (bouton « Supprimer mon compte » dans votre profil). Vos données ne sont jamais vendues.</p>' +
      '<h3>Dans cette démo</h3><p class="small">Tout reste dans votre navigateur. Rien n\'est envoyé sur un serveur.</p></div>';
  };

  /* ----- Espace admin (démo) ----- */
  V.admin = function () {
    if (!adminOk) return '<a class="back" href="#/bienvenue">← Retour</a><h1>Espace admin</h1><div class="info">Démo : le code est <b>' + ADMIN_CODE + '</b>. Dans la vraie version, l\'accès sera protégé côté serveur.</div>' +
      '<form data-form="admin-login"><label for="ac">Code d\'accès</label><input id="ac" name="code" type="password" autocomplete="off"><div id="err"></div><button class="btn navy block" style="margin-top:12px" type="submit">Entrer</button></form>';
    var s = st(), insc = s.activities.reduce(function (n, a) { return n + a.inscrits.length; }, 0);
    var rep = s.reports.length ? "<table><tr><th>Date</th><th>Cible</th><th>Motif</th><th></th></tr>" + s.reports.map(function (r) {
      var u = r.type === "user" ? userById(r.target) : actById(r.target);
      var name = u ? esc(u.prenom || u.titre) : "(supprimé)";
      return "<tr><td>" + fmtShort.format(new Date(r.at)) + "</td><td>" + (r.type === "user" ? "👤 " : "📅 ") + name + "</td><td>" + (r.auto ? '<span class="tag navy">Auto</span> ' : "") + esc(r.reason) + "</td><td><button class=\"btn small ghost\" data-action=\"admin-dismiss\" data-id=\"" + r.id + "\">Classer</button></td></tr>";
    }).join("") + "</table>" : '<p class="muted">Aucun signalement.</p>';
    var users = "<table><tr><th>Membre</th><th>Ville</th><th></th></tr>" + s.users.map(function (u) {
      return "<tr><td>" + esc(u.prenom) + (u.suspect ? ' <span class="tag warn">suspect</span>' : "") + (u.suspended ? ' <span class="tag warn">suspendu</span>' : "") + "</td><td>" + esc(u.ville) + '</td><td><button class="btn small ghost" data-action="admin-suspend" data-id="' + u.id + '">' + (u.suspended ? "Rétablir" : "Suspendre") + "</button></td></tr>";
    }).join("") + "</table>";
    var acts = "<table><tr><th>Activité</th><th>Date</th><th></th></tr>" + s.activities.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); }).map(function (a) {
      return "<tr><td>" + esc(a.titre) + "<br><span class=\"muted\">" + esc(a.ville) + " · " + participants(a).length + "/" + a.places + "</span></td><td>" + fmtShort.format(new Date(a.date)) + '</td><td><button class="btn small danger" data-action="admin-del-act" data-id="' + a.id + '">Suppr.</button></td></tr>';
    }).join("") + "</table>";
    var cities = Object.keys(BELORA_CITIES).map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("");
    var cats = BELORA_CATS.map(function (c) { return "<option>" + c + "</option>"; }).join("");
    var today = new Date(S.now() + DAY).toISOString().slice(0, 10);
    return '<a class="back" href="#/bienvenue">← Quitter l\'admin</a><h1>Tableau de bord</h1>' +
      '<div class="stats"><div class="stat"><b>' + (s.users.length + (s.me ? 1 : 0)) + '</b>membres</div><div class="stat"><b>' + s.activities.length + '</b>activités</div><div class="stat"><b>' + insc + '</b>inscriptions</div><div class="stat"><b>' + s.reports.length + "</b>signalements<br><small>dont " + s.reports.filter(function (r) { return r.auto; }).length + " automatiques</small></div></div>" +
      '<section class="card" style="margin-top:14px"><h2>Signalements</h2>' + rep + "</section>" +
      '<section class="card"><h2>Ajouter une activité</h2><p class="small muted">Copiez ici les sorties trouvées dans les groupes ou agendas locaux (avec l\'accord de l\'organisateur).</p>' +
      '<form data-form="admin-add"><label for="n-t">Titre</label><input id="n-t" name="titre" type="text" required>' +
      '<div class="row"><div style="flex:1;min-width:140px"><label for="n-c">Catégorie</label><select id="n-c" name="cat">' + cats + '</select></div><div style="flex:1;min-width:140px"><label for="n-v">Ville</label><select id="n-v" name="ville">' + cities + "</select></div></div>" +
      '<label for="n-a">Ambiance</label><select id="n-a" name="ambiance"><option value="tous">Pour tous</option><option value="amis">Entre amis</option><option value="rencontres">Rencontres</option></select><label for="n-l">Lieu précis</label><input id="n-l" name="lieu" type="text" required>' +
      '<div class="row"><div style="flex:1;min-width:140px"><label for="n-d">Date</label><input id="n-d" name="date" type="date" value="' + today + '" required></div><div style="flex:1;min-width:120px"><label for="n-h">Heure</label><input id="n-h" name="heure" type="time" value="14:00" required></div></div>' +
      '<div class="row"><div style="flex:1;min-width:120px"><label for="n-p">Prix (€)</label><input id="n-p" name="prix" type="number" min="0" step="0.5" value="0"></div><div style="flex:1;min-width:120px"><label for="n-n">Places</label><input id="n-n" name="places" type="number" min="1" value="12"></div></div>' +
      '<label for="n-o">Organisateur</label><input id="n-o" name="orga" type="text" placeholder="Nom du groupe ou de l\'association">' +
      '<label for="n-s">Source (lien du groupe ou de la page)</label><input id="n-s" name="source" type="text">' +
      '<label for="n-x">Description</label><textarea id="n-x" name="desc"></textarea><div id="err"></div><button class="btn primary block" style="margin-top:12px" type="submit">Ajouter l\'activité</button></form></section>' +
      '<section class="card"><h2>Activités</h2>' + acts + '</section><section class="card"><h2>Membres</h2>' + users + "</section>";
  };

  /* ---------- Routage ---------- */
  var OPEN = ["bienvenue", "connexion", "code", "cgu", "confidentialite", "admin", "creer-profil"];
  function refreshDot() {
    var d = $("#msgdot"); if (d) d.hidden = !Object.keys(st().unread).length;
  }
  function render() {
    var parts = (current || "").split("/");
    var r = parts[0] || "", arg = parts[1];
    var key = r === "profil" && arg === "modifier" ? "profil-modifier" : r === "messages" && arg ? "conv" : r;
    if (!r) { go(st().me ? "activites" : "bienvenue"); return; }
    if (!st().me && OPEN.indexOf(r) < 0) { go("bienvenue"); return; }
    if (st().me && ["bienvenue", "connexion", "code", "creer-profil"].indexOf(r) > -1) { go("activites"); return; }
    if (!V[key]) { go(st().me ? "activites" : "bienvenue"); return; }
    var html = V[key](arg);
    if (html === "") return;
    var navOff = OPEN.indexOf(r) > -1 && !st().me || r === "admin";
    document.body.classList.toggle("noNav", navOff);
    $("#app").innerHTML = emo(html);
    var tab = r === "activite" || r === "membre" ? "activites" : r;
    [].forEach.call(document.querySelectorAll("#tabbar a"), function (a) { a.classList.toggle("on", a.dataset.tab === tab); });
    refreshDot();
    if (lastCur !== current) { lastCur = current; window.scrollTo(0, 0); }
    if (key === "conv") { var m = $("#msg"); if (m) m.focus(); var t = $("#thread"); if (t) t.lastElementChild && t.lastElementChild.scrollIntoView({ block: "end" }); }
  }
  window.addEventListener("hashchange", function () { var h = location.hash.replace(/^#\/?/, ""); if (h && h !== current) { current = h; render(); } });

  /* ---------- Actions ---------- */
  function startTrialIfNeeded() {
    var s = st().sub;
    if (s.status === "none" && !s.trialStart) {
      s.trialStart = S.now(); persist();
      openModal('<h2>🎉 Bienvenue !</h2><p>Vos <b>7 jours gratuits</b> commencent maintenant. Vous pouvez voir les profils complets et écrire aux autres participants.</p><p class="small muted">Aucun paiement demandé. Ensuite : 19,99 € par mois, sans engagement, résiliable en un clic.</p><button class="btn primary block" data-action="close">Super, merci !</button>');
      return true;
    }
    return false;
  }
  function doJoin(a, n) {
    if (!isJoined(a.id)) { st().joined.push(a.id); a.inscrits.push("me"); }
    if (isCouple(st().me)) st().party[a.id] = n;
    closeModal();
    var trial = startTrialIfNeeded(); persist();
    if (!trial) toast("Vous êtes inscrit(e) !");
    render();
  }
  function partyModal(a, change) {
    var left = seatsLeft(a) + (change && isJoined(a.id) ? weight("me", a) : 0);
    openModal('<h2>Qui vient à cette sortie ?</h2><p class="muted small">' + esc(a.titre) + '</p>' +
      '<div class="vstack"><button class="btn primary block" data-action="party" data-id="' + a.id + '" data-n="2"' + (left < 2 ? " disabled" : "") + '>Nous venons tous les deux · 2 places</button>' +
      '<button class="btn ghost block" data-action="party" data-id="' + a.id + '" data-n="1">Un seul de nous deux · 1 place</button>' +
      (left < 2 ? '<p class="small muted">Il ne reste qu\'une place : seul l\'un de vous deux peut venir.</p>' : '') +
      '<button class="btn block" data-action="close">Annuler</button></div>');
  }
  function confirmModal(title, text, actionLabel, action, data) {
    openModal("<h2>" + esc(title) + "</h2><p>" + esc(text) + '</p><div class="row"><button class="btn danger" data-action="' + action + '" ' + (data || "") + ">" + esc(actionLabel) + '</button><button class="btn ghost" data-action="close">Annuler</button></div>');
  }
  function reportModal(type, id) {
    openModal('<h2>Signaler</h2><p class="muted small">Votre signalement est confidentiel. Merci de nous aider à protéger la communauté.</p><form data-form="report" data-type="' + type + '" data-id="' + id + '">' +
      REPORT_REASONS.map(function (r, i) { return '<label class="plan"><input type="radio" name="reason" value="' + esc(r) + '"' + (i === 0 ? " checked" : "") + '><span class="box">' + esc(r) + "</span></label>"; }).join('<div style="height:8px"></div>') +
      '<label for="rtxt">Précisions (facultatif)</label><textarea id="rtxt" name="text"></textarea><div class="row" style="margin-top:12px"><button class="btn primary" type="submit">Envoyer le signalement</button><button class="btn ghost" type="button" data-action="close">Annuler</button></div></form>');
  }
  function pushMine(id, txt) {
    var th = st().conversations[id] = st().conversations[id] || [], sc = scamScan(txt);
    th.push({ from: "me", text: txt, at: S.now(), risk: sc.level, why: sc.why });
    persist(); render(); scheduleReply(id);
  }
  function scheduleReply(uid) {
    var u = userById(uid); if (!u) return;
    var t = setTimeout(function () {
      var th = st().conversations[uid] = st().conversations[uid] || [];
      var n = th.filter(function (m) { return m.from === "them"; }).length;
      var txt = u.suspect ? SUSPECT_REPLIES[n % SUSPECT_REPLIES.length] : NORMAL_REPLIES[n % NORMAL_REPLIES.length].replace("{p}", st().me ? st().me.prenom : "");
      var sc = scamScan(txt), m = { from: "them", text: txt, at: S.now(), risk: sc.level, why: sc.why };
      th.push(m);
      var viewing = current === "messages/" + uid;
      if (sc.level === 3) {
        st().strikes = st().strikes || {}; st().strikes[uid] = (st().strikes[uid] || 0) + 1;
        addReport("user", uid, "Détection automatique : " + sc.why.join(", "), txt, true);
        if (st().strikes[uid] >= 2 && !u.suspended) {
          u.suspended = true; persist();
          toast(u.prenom + " a été suspendu(e) automatiquement après plusieurs messages d'arnaque.");
          if (viewing) { go("messages"); return; }
        }
      }
      if (!viewing) st().unread[uid] = true;
      persist();
      if (viewing) render(); else refreshDot();
    }, 1400);
    replyTimers.push(t);
  }

  var actions = {
    "back": function () { back(); },
    "q-start": function () { startQuestions(false); },
    "q-pick": function (el) {
      var q = QUESTIONS[qState.i], v = el.dataset.v, a = qState.ans;
      if (q.multi) { var arr = a[q.id] || [], k = arr.indexOf(v); if (k > -1) arr.splice(k, 1); else arr.push(v); a[q.id] = arr; if (!arr.length) delete a[q.id]; }
      else if (a[q.id] === v) delete a[q.id]; else a[q.id] = v;
      render();
    },
    "q-next": function (el, ev) { ev.preventDefault(); if (qState.i < QUESTIONS.length - 1) { qState.i++; render(); window.scrollTo(0, 0); } else finishQuestions(); },
    "q-prev": function () { qState.i = Math.max(0, qState.i - 1); render(); window.scrollTo(0, 0); },
    "q-quit": function (el, ev) { ev.preventDefault(); finishQuestions(); },
    "show-msg": function (el) { var th = st().conversations[el.dataset.id] || [], m = th[+el.dataset.i]; if (m) { m.shown = true; persist(); render(); } },
    "send-anyway": function () { var pm = pendingMsg; pendingMsg = null; closeModal(); if (pm) pushMine(pm.id, pm.txt); },
    "open-act": function (el) { go("activite/" + el.dataset.id); },
    "join": function (el) {
      var a = actById(el.dataset.id); if (!a) return;
      var why = cannotJoin(a);
      if (why && !isJoined(a.id)) { toast(why === "Complet" ? "Cette sortie est complète." : "Cette sortie s'adresse aux personnes seules."); return; }
      if (isCouple(st().me) && !isJoined(a.id)) { partyModal(a, false); return; }
      doJoin(a, 1);
    },
    "party": function (el) {
      var a = actById(el.dataset.id); if (!a) return; var n = +el.dataset.n;
      if (isJoined(a.id)) { st().party[a.id] = n; persist(); closeModal(); toast(n === 2 ? "C'est noté : vous venez à deux." : "C'est noté : un seul de vous deux vient."); render(); }
      else doJoin(a, n);
    },
    "change-party": function (el, ev) { ev.preventDefault(); var a = actById(el.dataset.id); if (a) partyModal(a, true); },
    "copy-fb": function () {
      var t = $("#fb"), txt = (t.value || "").trim(); if (!txt) { toast("Écrivez d'abord votre avis."); return; }
      var done = function () { toast("Avis copié : collez-le dans un message."); };
      try { navigator.clipboard.writeText(txt).then(done, function () { t.select(); toast("Sélectionnez puis copiez le texte."); }); } catch (e) { t.select(); toast("Sélectionnez puis copiez le texte."); }
    },
    "leave": function (el) {
      var a = actById(el.dataset.id); if (!a) return;
      st().joined = st().joined.filter(function (x) { return x !== a.id; });
      a.inscrits = a.inscrits.filter(function (x) { return x !== "me"; }); delete st().party[a.id];
      persist(); toast("Vous êtes désinscrit(e)."); render();
    },
    "filter-cat": function (el) { st().filters.cat = el.dataset.v; persist(); render(); },
    "filter-amb": function (el) { st().filters.amb = el.dataset.v; persist(); render(); },
    "close": function () { closeModal(); render(); },
    "start-trial": function () { startTrialIfNeeded(); render(); },
    "subscribe": function () {
      var k = ($("input[name=plan]:checked") || {}).value || "m", p = PLANS[k];
      openModal('<h2>Confirmer mon abonnement</h2><p><b>' + p.label + "</b> – " + eur(p.price) + " " + p.unit + '.</p><div class="info">Mode test : aucun paiement réel. Dans la vraie version, vous paierez en toute sécurité par carte ou Bancontact.</div><div class="row"><button class="btn primary" data-action="pay" data-plan="' + k + '">Confirmer (paiement simulé)</button><button class="btn ghost" data-action="close">Annuler</button></div>');
    },
    "pay": function (el) {
      var p = PLANS[el.dataset.plan]; if (!p) return;
      var s = st().sub; s.status = "active"; s.plan = el.dataset.plan; s.startedAt = S.now(); s.endsAt = S.now() + p.days * DAY;
      if (!s.trialStart) s.trialStart = null;
      persist(); closeModal(); toast("Merci ! Votre abonnement est actif."); render();
    },
    "cancel-sub": function () { confirmModal("Résilier l'abonnement ?", "Vous gardez l'accès jusqu'à la fin de la période déjà payée.", "Oui, résilier", "cancel-sub-ok"); },
    "cancel-sub-ok": function () { st().sub.status = "cancelled"; persist(); closeModal(); toast("Abonnement résilié."); render(); },
    "toggle-size": function () { st().bigText = !st().bigText; applySize(); persist(); render(); },
    "shift": function (el) { st().shiftDays += +el.dataset.d; persist(); toast("Démo : +" + el.dataset.d + " jour(s)."); render(); },
    "reset-demo": function () { confirmModal("Tout réinitialiser ?", "Le profil, les inscriptions et les messages de la démo seront effacés.", "Réinitialiser", "reset-ok"); },
    "reset-ok": function () { replyTimers.forEach(clearTimeout); S.reset(); adminOk = false; closeModal(); applySize(); go("bienvenue"); render(); },
    "delete-account": function () { confirmModal("Supprimer mon compte ?", "Toutes vos données seront effacées. Cette action est définitive.", "Supprimer", "reset-ok"); },
    "report-user": function (el) { reportModal("user", el.dataset.id); },
    "report-act": function (el, ev) { ev.preventDefault(); reportModal("activity", el.dataset.id); },
    "block": function (el) { confirmModal("Bloquer cette personne ?", "Vous ne verrez plus son profil et elle ne pourra plus vous écrire.", "Bloquer", "block-ok", 'data-id="' + el.dataset.id + '"'); },
    "block-ok": function (el) { st().blocked.push(el.dataset.id); persist(); closeModal(); toast("Personne bloquée."); go("activites"); },
    "admin-dismiss": function (el) { st().reports = st().reports.filter(function (r) { return r.id !== el.dataset.id; }); persist(); render(); },
    "admin-suspend": function (el) { var u = userById(el.dataset.id); if (u) { u.suspended = !u.suspended; persist(); render(); } },
    "admin-del-act": function (el) {
      var id = el.dataset.id; st().activities = st().activities.filter(function (a) { return a.id !== id; });
      st().joined = st().joined.filter(function (x) { return x !== id; }); persist(); render();
    }
  };

  document.addEventListener("click", function (ev) {
    if (ev.target.id === "modal") { closeModal(); return; }
    var lk = ev.target.closest("a[href^=\"#/\"]");
    if (lk && !lk.dataset.action) { ev.preventDefault(); go(lk.getAttribute("href").slice(2)); return; }
    var el = ev.target.closest("[data-action]"); if (!el) return;
    var fn = actions[el.dataset.action]; if (!fn) return;
    if (el.tagName === "A") ev.preventDefault();
    ev.stopPropagation(); fn(el, ev);
  });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && !$("#modal").hidden) closeModal(); });

  /* ---------- Formulaires ---------- */
  function showErr(msg, form) { var e = (form || document).querySelector("#err"); if (e) e.innerHTML = '<div class="error" role="alert">' + esc(msg) + "</div>"; }
  var forms = {
    phone: function (f) {
      var p = normPhone(f.phone.value);
      if (!p) return showErr("Ce numéro n'est pas valide. Seuls les numéros de GSM belges (04…) et français (06… ou 07…) sont acceptés.", f);
      st().pending = { phone: p, verified: false }; persist(); go("code");
    },
    code: function (f) {
      if (f.code.value.trim() !== SMS_CODE) return showErr("Ce code n'est pas correct. En démo, le code est " + SMS_CODE + ".", f);
      st().pending.verified = true; persist(); go("creer-profil");
    },
    "profile-new": function (f) { saveProfile(f, false); },
    "profile-edit": function (f) { saveProfile(f, true); },
    send: function (f) {
      var id = f.dataset.id, txt = f.msg.value.trim(); if (!txt) return;
      var sc = scamScan(txt);
      if (sc.level === 3) {
        pendingMsg = { id: id, txt: txt };
        openModal('<h2>⚠️ Attention avant d\'envoyer</h2><p>Votre message contient des éléments sensibles' + whyTxt({ why: sc.why }) + '.</p><p class="small">Ne donnez jamais d\'argent, de coordonnées bancaires ou de codes, même à une personne qui vous semble sincère.</p><div class="vstack"><button class="btn primary block" data-action="close">Modifier mon message</button><button class="btn ghost block" data-action="send-anyway">Envoyer quand même</button></div>');
        return;
      }
      pushMine(id, txt);
    },
    feedback: function (f) {
      var note = (f.querySelector("input[name=note]:checked") || {}).value;
      if (!note) { toast("Choisissez une note, s'il vous plaît."); return; }
      var rev = [].map.call(f.querySelectorAll("input[name=revoir]:checked"), function (i) { return i.value; });
      st().feedback[f.dataset.id] = { note: +note, revoir: rev }; persist();
      toast(rev.length ? "Merci ! Nous prévenons ces personnes que vous aimeriez les revoir." : "Merci pour votre avis !"); render();
    },
    report: function (f) {
      var reason = (f.querySelector("input[name=reason]:checked") || {}).value || "Autre";
      addReport(f.dataset.type, f.dataset.id, reason, f.text.value); closeModal(); toast("Merci, votre signalement a bien été envoyé."); render();
    },
    "admin-login": function (f) {
      if (f.code.value !== ADMIN_CODE) return showErr("Code incorrect.", f);
      adminOk = true; render();
    },
    "admin-add": function (f) {
      var titre = f.titre.value.trim(), lieu = f.lieu.value.trim();
      if (!titre || !lieu || !f.date.value || !f.heure.value) return showErr("Titre, lieu, date et heure sont obligatoires.", f);
      var d = new Date(f.date.value + "T" + f.heure.value);
      st().activities.push({ id: "a" + Date.now(), ambiance: f.ambiance.value, titre: titre, cat: f.cat.value, ville: f.ville.value, lieu: lieu, date: d.toISOString(), prix: Math.max(0, +f.prix.value || 0), places: Math.max(1, +f.places.value || 1), desc: f.desc.value.trim(), orga: f.orga.value.trim() || "Belora", source: f.source.value.trim() || "Belora", lien: "", inscrits: [] });
      persist(); toast("Activité ajoutée."); render();
    }
  };
  function saveProfile(f, edit) {
    var prenom = f.prenom.value.trim(), age = parseInt(f.age.value, 10);
    if (!prenom) return showErr("Merci d'indiquer votre prénom.", f);
    if (!(age >= 50)) return showErr("Belora est réservé aux personnes de 50 ans et plus.", f);
    if (age > 99) return showErr("Merci de vérifier votre âge.", f);
    if (!edit && !f.cgu.checked) return showErr("Merci de cocher la case pour accepter les conditions.", f);
    var interets = [].map.call(f.querySelectorAll("input[name=interets]:checked"), function (i) { return i.value; });
    var situation = (f.querySelector("input[name=situation]:checked") || {}).value || "seul";
    var but = situation === "couple" ? "amitie" : (f.querySelector("input[name=but]:checked") || {}).value || "ouvert";
    var data = { prenom: prenom, age: age, ville: f.ville.value, bio: f.bio.value.trim(), interets: interets, situation: situation, but: but, genre: situation === "couple" ? "" : f.genre.value, cherche: situation === "couple" ? "" : f.cherche.value };
    if (edit) { Object.assign(st().me, data); if (tmpPhoto) st().me.photo = tmpPhoto; persist(); toast("Profil enregistré."); go("profil"); return; }
    var colors = ["#1F3A5F", "#D9503A", "#4F7F6A", "#6B4C9A", "#B5651D"];
    st().me = Object.assign({ id: "me", phone: st().pending.phone, color: colors[prenom.length % colors.length], photo: tmpPhoto || "" }, data);
    st().filters.ville = data.ville; st().filters.amb = but === "amitie" ? "amis" : but === "couple" ? "rencontres" : ""; st().pending = null; persist(); tmpPhoto = null;
    startQuestions(true);
  }
  document.addEventListener("submit", function (ev) {
    var f = ev.target.closest("form[data-form]"); if (!f) return;
    ev.preventDefault();
    var fn = forms[f.dataset.form]; if (fn) fn(f);
  });

  /* Filtres et photo */
  document.addEventListener("input", function (ev) {
    var t = ev.target; if (!t.dataset || !t.dataset.filter) return;
    var k = t.dataset.filter; st().filters[k] = k === "rayon" ? +t.value : t.value; persist();
    if (k === "ville") st().filters.ville = t.value;
    var l = $("#actlist"); if (l) l.innerHTML = emo(listHtml());
  });
  document.addEventListener("change", function (ev) {
    var t = ev.target;
    if (t.name === "situation") { var c = t.value === "couple", r = $("#romance"), n = $("#couplenote"); if (r) r.hidden = c; if (n) n.hidden = !c; return; }
    if (t.dataset && t.dataset.filter) { var l = $("#actlist"); if (l) l.innerHTML = emo(listHtml()); return; }
    if (t.id === "photo" && t.files && t.files[0]) {
      var rd = new FileReader();
      rd.onload = function () {
        var img = new Image();
        img.onload = function () {
          var c = document.createElement("canvas"), s = 240; c.width = c.height = s;
          var m = Math.min(img.width, img.height), ctx = c.getContext("2d");
          ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
          tmpPhoto = c.toDataURL("image/jpeg", 0.8); toast("Photo prête");
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(t.files[0]);
    }
  });

  /* ---------- Démarrage ---------- */
  function applySize() { document.documentElement.dataset.size = st().bigText ? "big" : ""; }
  $("#textsize").addEventListener("click", function () { st().bigText = !st().bigText; applySize(); persist(); });
  applySize();
  render();
})();
