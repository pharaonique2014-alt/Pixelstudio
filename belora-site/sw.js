/* Convivia – service worker : l'appli s'ouvre même sans réseau. */
var VERSION = "convivia-v1";
var CORE = ["./", "index.html", "manifest.webmanifest", "pwa/icon-192.png", "pwa/icon-512.png", "pwa/apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    // on ignore un fichier manquant plutôt que de faire échouer l'installation
    return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method !== "GET") return;
  var url = new URL(r.url);

  // pages : réseau d'abord (toujours la dernière version), cache en secours hors connexion
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then(function (res) {
      var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put("index.html", copy); });
      return res;
    }).catch(function () { return caches.match("index.html").then(function (m) { return m || caches.match("./"); }); }));
    return;
  }

  // fichiers du site et polices : cache d'abord, mis à jour en arrière-plan
  var sameOrigin = url.origin === location.origin;
  var fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (sameOrigin || fonts) {
    e.respondWith(caches.match(r).then(function (hit) {
      var net = fetch(r).then(function (res) {
        if (res && (res.ok || res.type === "opaque")) { var cp = res.clone(); caches.open(VERSION).then(function (c) { c.put(r, cp); }); }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    }));
  }
});
