/*
  Project Hermes — Service Worker
  Strategy: cache-first for app shell, network-first for external resources.
  Bump CACHE_VERSION to force update after deploy.
*/
var CACHE_VERSION = 'hermes-v4';

var APP_SHELL = [
  './',
  './index.html',
  './base.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './tools/calculators/calc.css',
  './tools/airflow.html',
  './tools/electrical.html',
  './tools/heat.html',
  './tools/motors.html',
  './tools/refrigeration.html',
  './tools/calculators/belt-length.html',
  './tools/calculators/breaker-sizing.html',
  './tools/calculators/capacitor-sizing.html',
  './tools/calculators/cfm-per-ton.html',
  './tools/calculators/combustion-air.html',
  './tools/calculators/condensate-drain.html',
  './tools/calculators/duct-sizing.html',
  './tools/calculators/electrical-cost.html',
  './tools/calculators/enthalpy.html',
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
  './tools/calculators/wire-sizing.html',
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

/* Install — pre-cache the app shell */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      return cache.addAll(APP_SHELL);
    }).then(function() {
      return self.skipWaiting();
    })
  );
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
