/* =========================================================================
 * 🚀 sw.js - BX Score Keeper Service Worker (iOS Safari Bulletproof Edition)
 * ========================================================================= */

const CACHE_NAME = 'bx-score-v68';

// 📦 離線核心靜態資源清單
const ASSETS = [
  './',
  './index.html',
  './404.html',
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

// 🌐 請求攔截：徹底防禦 Safari "Returned response is null"
self.addEventListener('fetch', (e) => {
  // 只處理 http/https 的 GET 請求，忽略其他請求
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // 如果網絡請求成功，直接返回
        if (networkResponse && networkResponse.status === 200) {
          return networkResponse;
        }
        // 如果伺服器回傳 404 等，嘗試從快取讀取
        return caches.match(e.request, { ignoreSearch: true }).then((cached) => cached || networkResponse);
      })
      .catch(async () => {
        // 網絡斷開/失敗時：先找精準快取
        const cachedResponse = await caches.match(e.request, { ignoreSearch: true });
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // 若是頁面導航（用戶在瀏覽網頁），回退到 index.html
        if (e.request.mode === 'navigate') {
          const fallbackIndex = await caches.match('./index.html');
          if (fallbackIndex) return fallbackIndex;
        }

        // 終極防線：絕不回傳 null 給 Safari
        return new Response('Network error and no cache available', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      })
  );
});
