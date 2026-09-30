"use strict";
const sw = self;
const CACHE_NAME = 'avatar-cache-v1';
const AVATAR_URL_PART = '/download/avatar';
self.addEventListener('install', (event) => {
    self.skipWaiting();
});
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (event) => {
    const requestUrl = event.request.url;
    if (requestUrl.includes(AVATAR_URL_PART)) {
        event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
            debugger;
            const cachedResponse = await cache.match(event.request);
            if (cachedResponse) {
                return cachedResponse;
            }
            try {
                // Указываем тип Response для ответа из сети
                const networkResponse = await fetch(event.request, { redirect: 'follow' });
                if (networkResponse.status === 200) {
                    cache.put(event.request, networkResponse.clone());
                }
                return networkResponse;
            }
            catch (error) {
                console.error('Ошибка загрузки:', error);
                // Возвращаем пустой ответ или ошибку, так как respondWith требует Response
                return new Response('Network error', { status: 408 });
            }
        }));
    }
});
