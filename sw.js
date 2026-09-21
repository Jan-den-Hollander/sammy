/*
  © Jan den Hollander — jandenhollander@duck.com
  Sammy — service worker: maakt installeren en offline gebruik mogelijk.
  Ophogen van CACHE (bijv. sammy-v2) dwingt een volledige verversing af.
*/
const CACHE = 'sammy-v1';
const PRECACHE = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png"];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) {
        // Elk bestand apart, zodat één ontbrekend bestand de installatie niet blokkeert
        return Promise.all(PRECACHE.map(function (u) { return c.add(u).catch(function () {}); })).then(function () { return c; });
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.pathname.indexOf('/_vercel/') === 0) return;            // bezoekmeting altijd live

  // Pagina zelf: eerst het netwerk (dan zie je een update meteen), offline de bewaarde versie
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(function (r) {
          if (r && r.ok) { var kopie = r.clone(); caches.open(CACHE).then(function (c) { c.put('index.html', kopie); }); }
          return r;
        })
        .catch(function () {
          return caches.match('index.html').then(function (r) { return r || caches.match('./'); });
        })
    );
    return;
  }

  // Lettertypen van Google Fonts: eerst de bewaarde versie
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (r) {
          var kopie = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, kopie); });
          return r;
        });
      })
    );
    return;
  }

  // Overige eigen bestanden: bewaarde versie tonen, op de achtergrond bijwerken
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        var net = fetch(req).then(function (r) {
          if (r && r.ok) { var kopie = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, kopie); }); }
          return r;
        }).catch(function () { return hit; });
        return hit || net;
      })
    );
  }
});
