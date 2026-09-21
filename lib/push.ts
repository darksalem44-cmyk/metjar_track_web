import { supabase } from '@/lib/supabase';
import { AppConstants } from '@/lib/constants';

/** نتيجة محاولة التفعيل — تُترجم في الواجهة إلى رسالة واضحة. */
export type PushEnableResult =
  | 'ok'
  | 'denied'
  | 'unsupported'
  | 'unconfigured'
  | 'development'
  | 'error';

export type PushStatus = 'on' | 'off' | 'denied' | 'unsupported' | 'unconfigured' | 'development';

export const pushHints: Record<PushStatus, string> = {
  on: 'مفعّلة على هذا الجهاز — سيصلك إشعار عند جاهزية التقرير الأسبوعي.',
  off: 'غير مفعّلة على هذا الجهاز.',
  denied: 'المتصفح يمنع الإشعارات — اسمح بها من إعدادات الموقع في المتصفح.',
  unsupported: 'المتصفح أو الجهاز لا يدعم إشعارات النظام.',
  unconfigured: 'لم تُضبط مفاتيح VAPID بعد — راجع ملف إعداد الدالة المجدولة.',
  development: 'إشعارات النظام تُختبر في النسخة المنشورة (الإنتاج) لا في التطوير.',
};

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function vapidPublicKey(): string {
  // متغيّر البيئة أولاً لأنه لا يحتاج تعديل الشيفرة على كل نشر
  const fromEnv = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY : '';
  return fromEnv || AppConstants.vapidPublicKey || '';
}

export function pushConfigured(): boolean {
  return vapidPublicKey().length > 0;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** تحويل مفتاح VAPID العام من base64url إلى صيغة يفهمها pushManager. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/** حالة الإشعارات الحالية على هذا الجهاز. */
export async function pushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported';
  if (!isProduction()) return 'development';
  if (!pushConfigured()) return 'unconfigured';
  if (await currentPushSubscription()) return 'on';
  return Notification.permission === 'denied' ? 'denied' : 'off';
}

/** يطلب الإذن، يشترك في الإشعارات، ويحفظ الاشتراك في قاعدة البيانات. */
export async function enablePush(userId: string): Promise<PushEnableResult> {
  if (!pushSupported()) return 'unsupported';
  if (!isProduction()) return 'development';
  if (!pushConfigured()) return 'unconfigured';

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const reg = (await navigator.serviceWorker.register('/sw.js')) ?? (await navigator.serviceWorker.ready);
    await navigator.serviceWorker.ready;

    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey()),
      }));

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return 'error';

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );
    if (error) throw error;

    return 'ok';
  } catch {
    return 'error';
  }
}

/** يلغي اشتراك هذا الجهاز ويحذف صفه من قاعدة البيانات. */
export async function disablePush(): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  try {
    await subscription.unsubscribe();
  } catch {
    // حتى لو فشل الإلغاء المحلي نحذف الصف حتى لا تُرسل إشعارات لجهاز غير مشترك
  }
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}
