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

// ─────────────── إشعار النظام اللحظي (بدون اشتراك Push) ───────────────

/**
 * إشعار النظام اللحظي عبر Notification API.
 *
 * لماذا يمرّ عبر عامل الخدمة (ServiceWorkerRegistration.showNotification) لا عبر
 * `new Notification` مباشرة؟ لأن الأخير يختفي غالباً عند تصغير المتصفح أو الانتقال
 * لتبويب آخر، بينما إشعار عامل الخدمة يُسلَّم لنظام التشغيل فيبقى كإشعار حقيقي
 * على شاشة الكمبيوتر — تماماً كما يفعل WhatsApp Desktop.
 *
 * لا يحتاج خادماً ولا مفاتيح VAPID؛ أما Web Push فوق فهو منفصل للتقرير الأسبوعي.
 */

export type SystemPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function systemNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** حالة إذن إشعار النظام كما يراها المتصفح الآن. */
export function systemPermission(): SystemPermission {
  if (!systemNotificationsSupported()) return 'unsupported';
  return Notification.permission as SystemPermission;
}

/** يطلب إذن إشعار النظام. يجب استدعاؤه من تفاعل مباشر (نقرة زر). */
export async function requestSystemPermission(): Promise<SystemPermission> {
  if (!systemNotificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission as SystemPermission;
  try {
    return (await Notification.requestPermission()) as SystemPermission;
  } catch {
    return 'denied';
  }
}

export const systemPermissionHints: Record<SystemPermission, string> = {
  granted: 'مسموح — سيظهر إشعار النظام عند كل تنبيه جديد، حتى والمتصفح مصغّر.',
  denied: 'المتصفح يمنع إشعارات النظام — اسمح بها من إعدادات الموقع في المتصفح (أيقونة القفل).',
  default: 'لم يُمنح الإذن بعد — اضغط المفتاح للسماح.',
  unsupported: 'المتصفح أو الجهاز لا يدعم إشعارات النظام.',
};

export interface SystemNotificationOptions {
  title: string;
  body: string;
  tag: string;
  /** فتح التطبيق على صفحة التنبيهات عند النقر */
  url?: string;
  /** إشعار عاجل يبقى على الشاشة حتى التفاعل (للأحداث الحرجة) */
  requireInteraction?: boolean;
}

/** التسجيل مُؤمَّن: يُعيد نفس الوعد مهما نُودي به عدد المرات. */
let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/**
 * يضمن وجود عامل خدمة مسجَّل ومُفعَّل — شرط ضروري ليصل الإشعار إلى نظام التشغيل
 * بينما الصفحة في الخلفية. التسجيل يحدث مرة واحدة ويُخزَّن وعده.
 */
export function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }
  if (!registrationPromise) {
    registrationPromise = (async () => {
      try {
        const existing = await navigator.serviceWorker.getRegistration();
        if (existing) {
          // لو كان مسجّلاً لكنه لم يصبح نشطاً بعد، ننتظر جاهزيته
          if (existing.active) return existing;
          await navigator.serviceWorker.ready;
          return (await navigator.serviceWorker.getRegistration()) ?? existing;
        }
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        return reg;
      } catch {
        // فشلت — نُفرّغ الوعد كي تُعاد المحاولة في التحديث القادم
        registrationPromise = null;
        return null;
      }
    })();
  }
  return registrationPromise;
}

/**
 * يعرض إشعار النظام عبر عامل الخدمة (يظهر مع تصغير المتصفح)،
 * ويرتدّ إلى `new Notification` كحل أخير.
 * يرجع true إن عُرض فعلاً.
 */
export async function showSystemNotification(opts: SystemNotificationOptions): Promise<boolean> {
  if (systemPermission() !== 'granted') return false;

  const payload: NotificationOptions = {
    body: opts.body,
    icon: '/icons/Icon-192.png',
    badge: '/icons/Icon-192.png',
    tag: opts.tag,
    dir: 'rtl',
    lang: 'ar',
    // silent:false صراحةً — بعض المتصفحات ترث الوضع الصامت من التخزين
    silent: false,
    requireInteraction: opts.requireInteraction ?? false,
    data: { url: opts.url ?? '/alerts' },
  };

  // المسار المفضّل: عامل الخدمة — الإشعار يذهب لنظام التشغيل ويبقى ظاهراً
  try {
    const reg = await ensureServiceWorker();
    if (reg) {
      await reg.showNotification(opts.title, payload);
      return true;
    }
  } catch {
    // بعض البيئات (وضع خاص / Development) تمنع showNotification — نكمل
  }

  // تراجع: إشعار مباشر — يعمل في التبويب الأمامي فقط
  try {
    new Notification(opts.title, payload);
    return true;
  } catch {
    return false;
  }
}

/**
 * النقر على إشعار نظام معروض من الصفحة مباشرة (لا من عامل الخدمة).
 * يُمرَّر مسار الوجهة إلى `onNavigate` بدل إعادة تحميل الصفحة كاملة،
 * فيبقى المستخدم داخل التطبيق بلا فقدان للحالة.
 */
export function wireSystemNotificationClicks(onNavigate: (url: string) => void): () => void {
  if (typeof window === 'undefined' || !('Notification' in window)) return () => {};
  const handler = (event: Event) => {
    const clicked = (event as Event & { notification?: Notification }).notification;
    clicked?.close();
    const target = (clicked?.data as { url?: string } | undefined)?.url ?? '/alerts';
    onNavigate(target);
  };
  window.addEventListener('notificationclick', handler as EventListener);
  return () => window.removeEventListener('notificationclick', handler as EventListener);
}

