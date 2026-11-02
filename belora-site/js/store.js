/* Stockage local de la démo (navigateur). Remplaçable plus tard par Supabase. */
window.Store = (function () {
  var KEY = "belora_test_v1";
  var DAY = 864e5;
  var Store = { state: null };

  function fresh() {
    var base = new Date(); base.setHours(0, 0, 0, 0);
    var acts = window.BELORA_ACTIVITIES_SEED.map(function (a) {
      var d = new Date(base.getTime() + a.jours * DAY);
      var hm = a.heure.split(":");
      d.setHours(+hm[0], +hm[1], 0, 0);
      return {
        id: a.id, titre: a.titre, cat: a.cat, ville: a.ville, lieu: a.lieu,
        date: d.toISOString(), prix: a.prix, places: a.places, desc: a.desc,
        orga: a.orga, source: a.source, lien: "", inscrits: a.inscrits.slice()
      };
    });
    return {
      me: null,
      pending: null,
      sub: { trialStart: null, status: "none", plan: null, endsAt: null, startedAt: null },
      joined: [],
      users: window.BELORA_USERS.map(function (u) { return Object.assign({ suspended: false }, u); }),
      activities: acts,
      conversations: {},
      unread: {},
      feedback: {},
      reports: [],
      blocked: [],
      filters: { ville: "", rayon: 50, cat: "", q: "" },
      shiftDays: 0,
      bigText: false
    };
  }

  Store.load = function () {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { Store.state = JSON.parse(raw); return; }
    } catch (e) { /* stockage indisponible : on travaille en mémoire */ }
    Store.state = fresh();
  };
  Store.save = function () {
    try { localStorage.setItem(KEY, JSON.stringify(Store.state)); } catch (e) { /* ignoré */ }
  };
  Store.reset = function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignoré */ }
    Store.state = fresh();
    Store.save();
  };
  Store.now = function () { return Date.now() + (Store.state.shiftDays || 0) * DAY; };
  return Store;
})();
