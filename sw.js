const CACHE_NAME = 'bx-score-v3'; // 升級版本號以強迫手機更新
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './BXScoreKeepericon-192.png',
  './BXScoreKeepericon-512.png'
];

// 安裝並跳過等待 (Skip Waiting)
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// 清除舊版本的 快取 (Activate)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 網路優先/快取備份策略
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
