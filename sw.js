/* =========================================================================
 * 🚀 sw.js - BX Score Keeper Service Worker (True Offline-First Edition)
 * ========================================================================= */

const CACHE_NAME = 'bx-score-v69';

// 📦 離線核心靜態資源清單（含必要 CDN）
const ASSETS = [
  './',
  './index.html',
  './404.html',
  './style.css',
  './p2p.js',
  './app.js',
  './manifest.json',
  './BXScoreKeepericon-192.png',
  './BXScoreKeepericon-512.png',
  'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js'
];

// 📲 安裝階段：快取所有核心資源並立即啟用
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 容錯快取：避免單一資源失敗導致整個安裝掛掉
      return Promise.all(
        ASSETS.map((url) => {
          return cache.add(url).catch((err) => {
            console.warn(`Failed to cache: ${url}`, err);
          });
        })
      );
    })
  );
});

// 🔄 啟用階段：清除所有舊版快取並接管頁面
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

// 🌐 請求攔截：Cache-First with Background Revalidation
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) {
    return;
  }

  // 排除 WebRTC Signaling 連線與 STUN/TURN
  if (e.request.url.includes('peerjs.com')) {
    return;
  }

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cachedResponse) => {
      // 背景更新請求 (Fetch & Cache)
      const fetchPromise = fetch(e.request)
        .then((networkResponse) => {
          // 支援 200 或跨域 Opaque Response (status === 0)
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // 網絡完全掛掉時的導航兜底
          if (e.request.mode === 'navigate') {
            const fallbackIndex = await caches.match('./index.html');
            if (fallbackIndex) return fallbackIndex;
          }
          // Safari 終極防線：永不回傳 null
          return new Response('Offline and asset unavailable', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });

      // 🎯 快取優先：如果快取有就秒開，沒有才等網絡
      return cachedResponse || fetchPromise;
    })
  );
});
