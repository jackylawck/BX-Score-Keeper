/* =========================================================================
 * 🚀 sw.js - BX Score Keeper Service Worker (PWA Offline Cache)
 * ========================================================================= */

const CACHE_NAME = 'bx-score-v66';

// 📦 離線核心靜態資源清單
const ASSETS = [
  './index.html',
  './style.css',
  './p2p.js',
  './app.js',
  './manifest.json',
  './BXScoreKeepericon-192.png',
  './BXScoreKeepericon-512.png'
];

// 📲 安裝階段：快取所有核心資源並立即跳過等待
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// 🔄 啟用階段：清除舊版快取並接管所有客戶端
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

// 🌐 請求攔截：Network First 策略（有網絡優先載入最新版，無網絡/弱網自動載入離線快取）
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
