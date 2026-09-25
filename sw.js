const CACHE_NAME = "itsup-cache-v3";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./logo.jpg",
  "./manifest.json"
];

self.addEventListener("install", (event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event)=>{
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event)=>{
  const url = event.request.url;

  // Never intercept calls to the Apps Script backend — let the browser fetch them
  // directly like normal. Trying to cache these here caused CORS/network errors
  // (Apps Script's cross-origin response can't reliably be read/cached from a Service Worker).
  if(url.includes("script.google.com")) return;

  // Static assets: network-first. Always tries to fetch the latest deployed file first —
  // this way updating index.html/app.js/style.css on GitHub takes effect immediately on
  // next load, with no stale-cache surprises. Cache is only used as a fallback when
  // there's genuinely no network (offline), which is the whole point of Phase 2 #8 / #20.
  if(STATIC_ASSETS.some(a => url.includes(a.replace("./","")))){
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
