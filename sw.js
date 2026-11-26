// 自動生成（scripts/vite-plugin-sw.ts）
const CACHE = 'ety-a5cca1aee6b4';
const ASSETS = ["./","./assets/chunks-Ka7XZt4L.js","./assets/index-BaD_zKJp.js","./assets/index-DQIQ50sw.css","./assets/inter-latin-wght-normal-Dx4kXJAl.woff2","./assets/sound-frk5E4lx.js","./assets/words-Hjk5As_u.js","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./index.html","./manifest.webmanifest","./splash/dark-375x667@2x.png","./splash/dark-375x812@3x.png","./splash/dark-390x844@3x.png","./splash/dark-393x852@3x.png","./splash/dark-402x874@3x.png","./splash/dark-414x896@2x.png","./splash/dark-414x896@3x.png","./splash/dark-428x926@3x.png","./splash/dark-430x932@3x.png","./splash/dark-440x956@3x.png","./splash/light-375x667@2x.png","./splash/light-375x812@3x.png","./splash/light-390x844@3x.png","./splash/light-393x852@3x.png","./splash/light-402x874@3x.png","./splash/light-414x896@2x.png","./splash/light-414x896@3x.png","./splash/light-428x926@3x.png","./splash/light-430x932@3x.png","./splash/light-440x956@3x.png"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ety-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html', { ignoreSearch: true }).then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});
