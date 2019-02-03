let CACHE_ID = 'vanilla-snake1.0.1'

let fileList = [
    'index.html',
    'app/app.js',
    'app/css/style.css',
    'app/img/icon.png',
    'app/img/logo.png'
]

// self.addEventListener('fetch', e => { return })
self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.open(CACHE_ID).then(function(cache) {
            return cache.match(event.request).then(function (response) {
                return response || fetch(event.request).then(function(response) {
                    cache.put(event.request, response.clone());
                    return response;
                }).catch(e=>{});
            }).catch(e=>{});
        }).catch(e=>{})
    );
});

self.addEventListener('install', e => {
    e.waitUntil( caches.open(CACHE_ID).then( cache => cache.addAll(fileList) ) )
    self.skipWaiting()
})

self.addEventListener('activate', e => self.clients.claim() )