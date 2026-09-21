// عامل خدمة متجر تراك — تخزين مؤقت للقشرة (app shell) حتى يعمل التطبيق بدون إنترنت
// ملاحظة: عند كل نشر، عُدّل رقم نسخة الـ CACHE ليُحذف الكاش القديم تلقائياً أثناء activate.
const CACHE = 'metjar-track-v4';
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

// ─────────────── إشعارات النظام (Web Push) ───────────────
// تُرسلها دالة weekly-alerts-report المجدولة عند جاهزية التقرير الأسبوعي.

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'متجر تراك', body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'متجر تراك', {
      body: payload.body || '',
      icon: '/icons/Icon-192.png',
      badge: '/icons/Icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      tag: payload.tag,
      data: { url: payload.url || '/alerts' },
    }),
  );
});

// النقر على الإشعار: يركّز التطبيق المفتوح أو يفتحه على الوجهة المطلوبة
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          if ('navigate' in client) client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
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

  // أيقونة الموقع، وسجل الوظائف، وأيقونات PWA: شبكة أولاً مع احتياط الكاش
  // حتى تتبدل الأيقونات فوراً عند كل نشر دون بقاء القديمة في الكاش.
  if (
    url.pathname === '/favicon.png' ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname.startsWith('/icons/')
  ) {
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