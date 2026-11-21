/* App shell cache. Network first, so a GitHub Pages update shows up.
   The Google Sheet is never cached here. */
const CACHE = "family-hub-v6";
const SHELL = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/logic.js",
  "./js/sample.js",
  "./js/store.js",
  "./js/ui.js",
  "./js/views.js",
  "./js/app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key !== CACHE; }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (event) {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  event.respondWith(
    fetch(req).then(function (res) {
      const copy = res.clone();
      caches.open(CACHE).then(function (cache) { cache.put(req, copy); }).catch(function () {});
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match("./index.html"); });
    })
  );
});
