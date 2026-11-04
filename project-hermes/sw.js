/*
  Project Hermes — Service Worker
  Strategy: cache-first for app shell, network-first for external resources.
  Bump CACHE_VERSION to force update after deploy.
*/
var CACHE_VERSION = 'hermes-v31';

var APP_SHELL = [
  './',
  './index.html',
  './base.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './tools/calculators/calc.css',
  './tools/shared/withdrawn.js',
  './tools/shared/recommend.js',
  './tools/shared/refs.js',
  './tools/shared/tool.css',
  './tools/shared/fluids.js',
  './tools/shared/hydronics.js',
  './tools/airflow.html',
  './tools/electrical.html',
  './tools/heat.html',
  './tools/motors.html',
  './tools/refrigeration.html',
  './tools/psychrometric/index.html',
  './tools/psychrometric/math.js',
  './tools/psychrometric/chart.js',
  './tools/psychrometric/report.js',
  './tools/psychrometric/ui.js',
  './tools/calculators/belt-length.html',
  './tools/calculators/belt-deflection.html',
  './tools/calculators/breaker-sizing.html',
  './tools/calculators/capacitor-sizing.html',
  './tools/calculators/cfm-per-ton.html',
  './tools/calculators/combustion-air.html',
  './tools/calculators/condensate-drain.html',
  './tools/calculators/duct-sizing.html',
  './tools/calculators/enthalpy.html',
  './tools/calculators/electrical-cost.html',
  './tools/calculators/gas-pipe.html',
  './tools/calculators/load-calc.html',
  './tools/calculators/long-lineset.html',
  './tools/calculators/mca-mocp.html',
  './tools/calculators/motor-convert.html',
  './tools/calculators/motor-start-controls.html',
  './tools/calculators/ohms-law.html',
  './tools/calculators/pressure-convert.html',
  './tools/calculators/refrigerant-charge.html',
  './tools/calculators/system-head.html',
  './tools/calculators/temp-convert.html',
  './tools/calculators/ventilation-sizing.html',
  './tools/calculators/wire-sizing.html',
  './resources/samsung-dvm-s2-compressor.html',
  './resources/charge-troubleshooting.html',
  './resources/troubleshooting-data.js',
  './refrigerants/index.js',
  './refrigerants/core/types.js',
  './refrigerants/core/registry.js',
  './refrigerants/core/validate.js',
  './refrigerants/core/lookup.js',
  './refrigerants/data/index.js',
  './refrigerants/data/r22.js',
  './refrigerants/data/r32.js',
  './refrigerants/data/r134a.js',
  './refrigerants/data/r407c.js',
  './refrigerants/data/r410a.js',
  './refrigerants/data/r422b.js',
  './refrigerants/data/r427a.js',
  './refrigerants/data/r438a.js',
  './refrigerants/data/r448a.js',
  './refrigerants/data/r449a.js',
  './refrigerants/data/r450a.js',
  './refrigerants/data/r454b.js',
  './refrigerants/data/r454c.js',
  './refrigerants/data/r507a.js',
  './refrigerants/data/r513a.js'
];

/* Install — pre-cache the app shell.
   cache:'reload' on each Request bypasses the browser HTTP cache so the
   SW does not bake stale assets into the new cache. GitHub Pages serves
   assets with Cache-Control: max-age=600, which otherwise lets the
   install fetch return yesterday's CSS even after a fresh deploy. */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      return cache.addAll(APP_SHELL.map(function(url) {
        return new Request(url, { cache: 'reload' });
      }));
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* Banner click in index.html posts SKIP_WAITING so a waiting SW can
   activate immediately on user demand instead of waiting for natural
   conditions (close + reopen). */
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* Activate — clean old caches */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_VERSION; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* Fetch — cache-first for app shell, network-first for everything else */
self.addEventListener('fetch', function(e) {
  /* Only handle GET requests */
  if (e.request.method !== 'GET') return;

  /* Usage counter (GoatCounter): never cache. Each ping has a unique URL and
     would pile up in the cache; offline pings just fail, which is fine. */
  var host = new URL(e.request.url).hostname;
  if (host === 'gc.zgo.at' || host.endsWith('goatcounter.com')) return;

  /* Google Fonts and external resources — network with cache fallback */
  if (e.request.url.indexOf(self.location.origin) === -1) {
    e.respondWith(
      fetch(e.request).then(function(resp) {
        var clone = resp.clone();
        caches.open(CACHE_VERSION).then(function(cache) { cache.put(e.request, clone); });
        return resp;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }

  /* App shell — cache first, network fallback */
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(resp) {
        var clone = resp.clone();
        caches.open(CACHE_VERSION).then(function(cache) { cache.put(e.request, clone); });
        return resp;
      });
    })
  );
});
