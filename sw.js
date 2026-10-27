/* sw.js — сервис-воркер «Домашнего квеста».
   Сайт работает только онлайн: всегда сначала сеть (network-first).
   Кэш — лишь маленький запасной набор файлов оболочки на случай, если интернет пропал.
   Запросы на другие домены (Supabase, CDN, Google Fonts) НЕ перехватываются и не кэшируются.
   После обновления файлов на хостинге увеличьте CACHE_VERSION. */
"use strict";

var CACHE_VERSION = "kvest-v4-1";
var SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./config.js",
  "./art.js",
  "./store.js",
  "./hero-art.js",
  "./hero.js",
  "./menu.js",
  "./coloring-art.js",
  "./diary.js",
  "./coloring.js",
  "./app.js",
  "./pwa.js",
  "./offline.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./favicon-32.png"
];
var SHELL_URLS = SHELL.map(function (p) { return new URL(p, self.registration.scope).href; });

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // cache: "reload" — берём свежие файлы мимо HTTP-кэша браузера
      .then(function (cache) { return cache.addAll(SHELL.map(function (p) { return new Request(p, { cache: "reload" }); })); })
      .catch(function () { /* без кэша сайт всё равно работает онлайн */ })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE_VERSION; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function shellKey(url) {
  var u = new URL(url);
  u.search = ""; u.hash = "";
  return u.href;
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // чужие домены — напрямую в сеть, без кэша
  if (!url.href.startsWith(self.registration.scope)) return;

  var isNav = req.mode === "navigate";
  var key = shellKey(req.url);
  var inShell = SHELL_URLS.indexOf(key) >= 0;

  event.respondWith(
    fetch(req, { cache: "no-cache" })
      .then(function (res) {
        // обновляем запасную копию только для файлов оболочки
        if (res && res.ok && res.type === "basic" && (inShell || isNav)) {
          var copy = res.clone();
          var cacheKey = isNav ? new URL("./index.html", self.registration.scope).href : key;
          caches.open(CACHE_VERSION).then(function (c) { c.put(cacheKey, copy); });
        }
        return res;
      })
      .catch(function () {
        return caches.open(CACHE_VERSION).then(function (c) {
          var tryKey = isNav ? new URL("./index.html", self.registration.scope).href : key;
          return c.match(tryKey).then(function (hit) {
            if (hit) return hit;
            if (isNav) return c.match(new URL("./offline.html", self.registration.scope).href);
            return Response.error();
          }).then(function (r) {
            return r || new Response("<!doctype html><meta charset=utf-8><title>Нет интернета</title><p style='font-family:sans-serif;padding:24px'>Нет интернета. Проверьте подключение и обновите страницу.</p>",
              { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
          });
        });
      })
  );
});
