// Offline support: the app shell and word bank are cached on install;
// Google Fonts are cached the first time they load.

const PREFIX = 'leitner-';
const VERSION = PREFIX + 'v5';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/main.js',
  'js/router.js',
  'js/store.js',
  'js/leitner.js',
  'js/words.js',
  'js/data/words.js',
  'js/data/packs/index.js',
  'js/ui.js',
  'js/charts.js',
  'js/sfx.js',
  'js/speech.js',
  'js/theme.js',
  'js/wordlists.js',
  'js/views/lists.js',
  'js/views/welcome.js',
  'js/views/home.js',
  'js/views/session.js',
  'js/views/summary.js',
  'js/views/settings.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
];
const FONTS = PREFIX + 'fonts';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Only this app's own shell caches (leitner-v1, leitner-v2, ...): sibling apps on the
            // same origin use their own prefixes (leitner-de-*, leitner-fr-*) and must be left alone.
            .filter((k) => /^leitner-v\d+$/.test(k) && k !== VERSION)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONTS).then(async (cache) => {
        const hit = await cache.match(request);
        const net = fetch(request)
          .then((res) => {
            if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || net;
      }),
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // Network first for the page itself so updates arrive; cache first for everything else.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put('index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
