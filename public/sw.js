/* CY Planner — Service Worker : cache offline basique + Web Push */
const VERSION = "v1";
const STATIC_CACHE = `cyp-static-${VERSION}`;
const PAGES_CACHE = `cyp-pages-${VERSION}`;
const PRECACHE = ["/offline.html", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/badge-72.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE, PAGES_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/files/")) return; // fichiers : toujours réseau

  // Données du calendrier : réseau d'abord, cache en secours (consultation hors-ligne)
  if (url.pathname.startsWith("/api/calendar")) {
    event.respondWith(networkFirst(req, PAGES_CACHE));
    return;
  }
  if (url.pathname.startsWith("/api/")) return;

  // Assets Next immuables : cache d'abord
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(STATIC_CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // Navigation : réseau d'abord, puis dernière version en cache, puis page hors-ligne
  if (req.mode === "navigate") {
    event.respondWith(
      networkFirst(req, PAGES_CACHE).catch(() => caches.match("/offline.html")),
    );
  }
});

async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const copy = res.clone();
      caches.open(cacheName).then((c) => c.put(req, copy));
    }
    return res;
  } catch (e) {
    const hit = await caches.match(req);
    if (hit) return hit;
    throw e;
  }
}

/* ----------------------------------- Web Push ----------------------------------- */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "CY Planner", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "CY Planner";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      tag: data.tag,
      renotify: !!data.tag,
      data: { url: data.url || "/" },
      lang: "fr",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.navigate(target);
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const { publicKey } = await fetch("/api/push/public-key").then((r) => r.json());
      if (!publicKey) return;
      const pad = "=".repeat((4 - (publicKey.length % 4)) % 4);
      const raw = atob((publicKey + pad).replace(/-/g, "+").replace(/_/g, "/"));
      const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
    })(),
  );
});
