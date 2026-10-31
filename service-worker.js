const CACHE = "kosmodrom-v9";
const APP_SHELL = ["./", "./index.html", "./styles.css", "./js/main.js", "./js/ui/expedition.js", "./js/game/contracts.js", "./js/game/save-files.js", "./js/game/save-store.js", "./js/ui/contracts.js", "./js/ui/save-controls.js", "./js/ui/touch-controls.js"];

self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      ),
  ),
);
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then(async (cached) => {
      if (cached) return cached;
      const response = await fetch(event.request);
      if (event.request.method === "GET" && response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(event.request, response.clone());
      }
      return response;
    }),
  );
});
