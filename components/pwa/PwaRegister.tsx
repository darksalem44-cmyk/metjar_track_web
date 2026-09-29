'use client';

import { useEffect } from 'react';
import { ensureServiceWorker } from '@/lib/push';

/**
 * يسجّل عامل الخدمة اللازم لعرض إشعارات النظام حتى والمتصفح مصغّر.
 * التسجيل يجري فور الجاهزية لا عند `load`، حتى لا يضيع أول تنبيه
 * على مستخدم فتح التطبيق للتو.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // التسجيل في الخلفية مع تجاهل الفشل — لا ننتظره لأنه لا يحجب العرض.
    // يعمل في التطوير أيضاً: بدونه لا تظهر إشعارات النظام على الكمبيوتر،
    // ولأن مطوّراً يجرّب الميزة محلياً يجب أن يراها فعلاً.
    void ensureServiceWorker().catch(() => {
      // فشل التسجيل لا يؤثر على التطبيق — الإشعارات تسقط إلى new Notification
    });
  }, []);

  return null;
}
