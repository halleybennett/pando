/* Pando service worker.
   Two strategies, because the app has two kinds of file:

   - The shell (html/css/js) is NETWORK-FIRST with a 3s timeout, falling back to cache.
     It was stale-while-revalidate, which meant every change took two launches to appear and
     an installed app could sit on an old build without saying so. Correctness of "what am I
     running" matters more here than saving a few milliseconds on launch: online you always
     get the current build, offline you get the last one you had.
   - cities.json is cache-first and never revalidated. It is 247KB of GeoNames extract
     that only changes when we deliberately rebuild it, so paying for a revalidation on
     every launch would buy nothing. Bump CACHE below if that file ever changes. */
'use strict';

var CACHE = 'pando-v2';   /* bumped when the strategy changed */
var SHELL = ['./', './index.html', './styles.css', './app.js', './manifest.json'];
var IMMUTABLE = /\/data\/cities\.json$/;

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* Icons are added separately and allowed to fail: a missing icon must never
         abort the install and leave the app with no offline copy at all. */
      return c.addAll(SHELL).then(function () {
        return Promise.all(['icons/icon-192.png', 'icons/icon-512.png',
          'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'data/cities.json']
          .map(function (u) { return c.add(u).catch(function () {}); }));
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (IMMUTABLE.test(url.pathname)) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    }));
    return;
  }

  e.respondWith(caches.open(CACHE).then(function (c) {
    var fromCache = function () {
      return c.match(req).then(function (hit) {
        return hit || (req.mode === 'navigate' ? c.match('./index.html') : Response.error());
      });
    };
    /* Don't let a slow or half-open network hold the app hostage - after 3s, serve what we have. */
    var timeout = new Promise(function (resolve) {
      setTimeout(function () { resolve(fromCache()); }, 3000);
    });
    var network = fetch(req).then(function (res) {
      if (res.ok) c.put(req, res.clone());
      return res;
    }).catch(fromCache);
    return Promise.race([network, timeout]);
  }));
});
