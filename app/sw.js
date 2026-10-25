// Beyanno — web sürümü servis çalışanı.
// Yalnız uygulama kabuğunu (aynı kökenli HTML/JS/CSS/simge) önbelleğe alır; Supabase / API istekleri (farklı köken)
// ve POST istekleri asla önbelleğe girmez → mali veri tarayıcıda saklanmaz, her zaman sunucudan gelir.
const SURUM = "dm-kabuk-v2";
const KABUK = ["./", "./index.html", "./manifest.webmanifest", "./simge.svg", "./simge-192.png", "./simge-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SURUM).then((c) => c.addAll(KABUK)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ad) => Promise.all(ad.filter((x) => x.startsWith("dm-kabuk-") && x !== SURUM).map((x) => caches.delete(x)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return; // Supabase, YZ, harici: dokunma
  if (r.mode === "navigate") {
    // Sayfa: önce ağ (yeni sürüm hemen gelsin), ağ yoksa önbellekteki kabuk
    e.respondWith(
      fetch(r)
        .then((y) => {
          const kopya = y.clone();
          caches.open(SURUM).then((c) => c.put("./index.html", kopya));
          return y;
        })
        .catch(() => caches.match("./index.html").then((x) => x || caches.match("./"))),
    );
    return;
  }
  // Varlıklar (adları içerik özetli, değişmez): önce önbellek, yoksa ağdan alıp sakla
  e.respondWith(
    caches.match(r).then(
      (x) =>
        x ||
        fetch(r).then((y) => {
          if (y.ok && (url.pathname.includes("/assets/") || /\.(png|svg|webmanifest)$/.test(url.pathname))) {
            const kopya = y.clone();
            caches.open(SURUM).then((c) => c.put(r, kopya));
          }
          return y;
        }),
    ),
  );
});

// Anlık bildirim (Web Push, 24 Eki 2026): bulut işçisi (sunucu/push.ts) VAPID ile şifreli yük yollar → burada gösterilir.
self.addEventListener("push", (e) => {
  let y = {};
  try { y = e.data ? e.data.json() : {}; } catch { y = { baslik: e.data ? e.data.text() : "" }; }
  const baslik = y.baslik || "Beyanno";
  e.waitUntil(self.registration.showNotification(baslik, { body: y.metin || "", icon: "./simge-192.png", badge: "./simge-192.png", tag: y.etiket || "beyanno", renotify: true, data: { yol: y.yol || "/" } }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const yol = (e.notification.data && e.notification.data.yol) || "/";
  const hedef = new URL(`./#${yol.startsWith("/") ? yol : "/" + yol}`, self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((l) => {
      for (const c of l) if (c.url.startsWith(self.registration.scope) && "focus" in c) { c.navigate(hedef).catch(() => {}); return c.focus(); }
      return self.clients.openWindow(hedef);
    }),
  );
});
