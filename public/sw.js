// عامل خدمة متجر تراك — تخزين مؤقت للقشرة (app shell) حتى يعمل التطبيق بدون إنترنت
// ملاحظة: عند كل نشر، عُدّل رقم نسخة الـ CACHE ليُحذف الكاش القديم تلقائياً أثناء activate.
const CACHE = 'metjar-track-v2';
const PRECACHE = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Supabase خارج الأصل — لا تلمسه إطلاقاً (بيانات حية)
  if (url.origin !== self.location.origin) return;
  // استبعاد HMR في بيئة التطوير
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;

  // التنقلات (صفحة التطبيق): شبكة أولاً والقشرة احتياطاً —
  // بما أن التطبيق صفحة واحدة فإن '/' تخدم كل المسارات
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then((r) => r ?? caches.match(req))),
    );
    return;
  }

  // كود Next.js (العدّات المبنية): شبكة أولاً حتى يصل كل إصدار جديد فوراً
  // ولا تعلق النسخة القديمة في الكاش؛ نؤول للكاش فقط عند انقطاع الشبكة.
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  // بقية الأصول (صور، أيقونات...): كاش أولاً ثم الشبكة مع تخزين الأصول الجديدة
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
    }),
  );
});