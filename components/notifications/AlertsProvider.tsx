'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useProfile } from '@/components/ProfileContext';
import { pathToView, useRouter } from '@/components/RouterContext';
import type { ActivityEntityType } from '@/lib/types';
import {
  applyAlertSettings,
  defaultAlertSettings,
  describeAlerts,
  diffNewAlerts,
  fetchAdminAlertsResult,
  normalizeAlertSettings,
  subscribeToAlerts,
  topSeverity,
  type AdminAlert,
  type AlertSettings,
  type LiveAlertSettings,
} from '@/lib/notifications';
import { playAlertSound, armAlertSoundOnFirstGesture, resumeAlertSound, unlockAlertSound } from '@/lib/alert-sound';
import { showSystemNotification, wireSystemNotificationClicks } from '@/lib/push';
import { toast } from '@/lib/toast';

interface AlertsState {
  /** التنبيهات الظاهرة بعد تطبيق القواعد والكتم */
  alerts: AdminAlert[];
  loading: boolean;
  /** true عندما تكون هناك أحداث أقدم مما تعرضه النافذة الحالية */
  truncated: boolean;
  /** عدد غير المقروء المهم — وهو ما يظهر على الجرس */
  unread: number;
  /** ما أخفته القواعد المعطّلة */
  hiddenByRules: number;
  /** ما أخفاه الكتم المؤقت أو الدائم */
  mutedCount: number;
  settings: AlertSettings;
  seenAt: string | null;
  refresh: () => Promise<void>;
  markAllSeen: () => void;
  saveSettings: (next: AlertSettings) => void;
  /** يبدّل إعدادات الإشعار اللحظي (إشعار النظام / التنبيه الداخلي / الصوت) */
  saveLive: (patch: Partial<LiveAlertSettings>) => void;
  /** يفتح سياق الصوت بعد تفاعل المستخدم فيرتفع الحظر في المتصفح */
  primeSound: () => void;
  muteEntity: (target: { id: string; label: string; entityType: ActivityEntityType }, until: string | null) => void;
  muteActor: (target: { id: string; name: string }, until: string | null) => void;
  unmute: (kind: 'entity' | 'actor', id: string) => void;
}

const AlertsContext = createContext<AlertsState | null>(null);

export function useAlerts(): AlertsState {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error('useAlerts must be used within AlertsProvider');
  return ctx;
}

function storageKey(kind: 'seen' | 'settings', userId: string): string {
  return kind === 'seen' ? `mt_alerts_seen_${userId}` : `mt_alert_settings_${userId}`;
}

/** قراءة آمنة للتخزين المحلي — الهيكل العام يُرسم على العميل فقط بعد التحقق من الجلسة. */
function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readSettings(userId: string): AlertSettings {
  const raw = readStorage(storageKey('settings', userId));
  if (!raw) return defaultAlertSettings();
  try {
    return normalizeAlertSettings(JSON.parse(raw));
  } catch {
    return defaultAlertSettings();
  }
}

/** الفترة الاحتياطية للتحقق الدوري (تعمل حتى لو لم يُضف الجدول إلى منشور realtime). */
const POLL_INTERVAL = 90 * 1000;

/**
 * فترة أطول تُستعمل عندما تكون الصفحة في الخلفية أو المتصفح مصغّراً.
 * المتصفح يخنق المؤقتات في التبويبات المخفية إلى نحو مرة في الدقيقة على أقل
 * تقدير، فاختيار أقل من ذلك لا يفيد. نختار 70 ثانية عمداً: يقع ضمن نافذة التنقيح
 * الدقيقة الواحدة، فيبقى الاستطلاع فعلياً على المتصفح المصغّر بدل أن يُجمد.
 *
 * ملاحظة مهمّة: هذه الطبقة تعمل ما دام المتصفح مفتوحاً. الإشعار عند إغلاق
 * المتصفح بالكامل يحتاج Web Push من الخادم (دالة marginalize) — وهو منفصل.
 */
const BACKGROUND_POLL_INTERVAL = 70 * 1000;

/**
 * يعلن عن التنبيهات الجديدة: تنبيه داخل التطبيق + إشعار نظام + صوت.
 * كلها محكومة بإعدادات المستخدم في `settings.live`، ولا شيء منها يوقف الجرس.
 */
function announceAlerts(alerts: AdminAlert[], live: LiveAlertSettings): void {
  if (alerts.length === 0) return;
  const copy = describeAlerts(alerts);
  const severity = topSeverity(alerts);

  if (live.sound) playAlertSound(severity);

  if (live.toast) {
    toast(copy.title, severity === 'critical' ? 'error' : 'info', 6000);
  }

  if (live.system) {
    void showSystemNotification({
      title: copy.title,
      body: copy.body,
      tag: copy.tag,
      url: '/alerts',
      // الحرج يبقى على الشاشة حتى يُغلق — على الكمبيوتر المصغّر يعني لا يفوته
      requireInteraction: severity === 'critical',
    });
  }
}

/**
 * مصدر واحد لتنبيهات المدير: يجلبها، يشترك في الجديد لحظياً،
 * ويطبّق إعدادات القواعد والكتم المحفوظة في هذا المتصفح.
 */
export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const profile = useProfile();
  const router = useRouter();
  const enabled = profile.role === 'manager';

  const [rawAlerts, setRawAlerts] = useState<AdminAlert[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [seenAt, setSeenAt] = useState<string | null>(() => readStorage(storageKey('seen', profile.id)));
  const [settings, setSettings] = useState<AlertSettings>(() => readSettings(profile.id));

  // مرآة الإعدادات تُقرأ من داخل async حتى لا تُعاد دورة الجلب مع كل تغيير في مفتاح
  const settingsRef = useRef(settings);
  // معرّفات التنبيهات المرئية سابقاً — null يعني «لم نتحقق بعد» فلا إعلان عن الأقدم
  const knownIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const result = await fetchAdminAlertsResult();
      const known = knownIdsRef.current;
      // أول تحميل: نسجّل ما يوجد ولا نُعلن عنه (إلا كان مجلداً حديثاً فعلاً)
      if (known !== null) {
        const fresh = applyAlertSettings(
          diffNewAlerts(result.alerts, known),
          settingsRef.current,
          null,
        ).alerts;
        announceAlerts(fresh, settingsRef.current.live);
      }
      knownIdsRef.current = new Set(result.alerts.map((a) => a.id));
      setRawAlerts(result.alerts);
      setTruncated(result.truncated);
    } catch {
      // فشل التحديث لا يُفقد ما هو معروض حالياً
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (disposed || timer) return;
      // تجميع دفعات الأحداث المتقاربة في تحديث واحد
      timer = setTimeout(() => {
        timer = null;
        void refresh();
      }, 1500);
    };

    // التحميل الأول مؤجّل لما بعد الرسم لتفادي تحديث متزامن داخل الـ effect نفسه
    const initial = requestAnimationFrame(() => void refresh());
    const unsubscribe = subscribeToAlerts(schedule);
    // النقر على إشعار النظام: إمّا من عامل الخدمة (رسالة) أو من إشعار الصفحة مباشرة.
    // نمرّ عبر الموجّه الداخلي (router.push) فلا تُفقد حالة الواجهة كما يحدث
    // مع إعادة تحميل الصفحة، ويصلح أيضاً للتبويب المُجمَّد عند العودة.
    const navigateTo = (url: string) => {
      const path = new URL(url, window.location.origin);
      if (path.origin !== window.location.origin) return;
      window.focus();
      const parsed = pathToView(path.pathname, path.search);
      if (parsed) router.push(parsed);
    };
    const onServiceWorkerMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (data?.type === 'NOTIFICATION_CLICK' && data.url) navigateTo(data.url);
    };
    navigator.serviceWorker?.addEventListener('message', onServiceWorkerMessage);
    // إشعارات الصفحة المباشرة (بلا عامل خدمة) لا تمرّ بالرسالة — نمررها هنا
    const unwireClicks = wireSystemNotificationClicks(navigateTo);
    // فتح الصوت عند أول نقرة/ضغطة مفتاح في الصفحة — شرط المتصفحات على الكمبيوتر
    const disarmSound = armAlertSoundOnFirstGesture();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_INTERVAL);

    // في الخلفية: نبضة أبطأ تضمن الإشعار حتى مع المتصفح مصغّراً أو بلا realtime
    const background = setInterval(() => {
      if (document.visibilityState !== 'visible') void refresh();
    }, BACKGROUND_POLL_INTERVAL);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        resumeAlertSound();
        schedule();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      cancelAnimationFrame(initial);
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      clearInterval(background);
      document.removeEventListener('visibilitychange', onVisibility);
      navigator.serviceWorker?.removeEventListener('message', onServiceWorkerMessage);
      unwireClicks();
      disarmSound();
      unsubscribe();
    };
  }, [enabled, refresh, router]);

  const saveSettings = useCallback(
    (next: AlertSettings) => {
      setSettings(next);
      try {
        window.localStorage.setItem(storageKey('settings', profile.id), JSON.stringify(next));
      } catch {
        // التخزين المحلي غير متاح — تبقى الإعدادات لهذه الجلسة
      }
    },
    [profile.id],
  );

  const saveLive = useCallback(
    (patch: Partial<LiveAlertSettings>) => {
      setSettings((current) => {
        const next: AlertSettings = { ...current, live: { ...current.live, ...patch } };
        try {
          window.localStorage.setItem(storageKey('settings', profile.id), JSON.stringify(next));
        } catch {
          // تجاهل
        }
        return next;
      });
    },
    [profile.id],
  );

  const primeSound = useCallback(() => {
    unlockAlertSound();
  }, []);
  const muteEntity = useCallback(
    (target: { id: string; label: string; entityType: ActivityEntityType }, until: string | null) => {
      setSettings((current) => {
        const next: AlertSettings = {
          ...current,
          mutedEntities: [
            ...current.mutedEntities.filter((m) => m.id !== target.id),
            { ...target, until },
          ],
        };
        try {
          window.localStorage.setItem(storageKey('settings', profile.id), JSON.stringify(next));
        } catch {
          // تجاهل
        }
        return next;
      });
    },
    [profile.id],
  );

  const muteActor = useCallback(
    (target: { id: string; name: string }, until: string | null) => {
      setSettings((current) => {
        const next: AlertSettings = {
          ...current,
          mutedActors: [...current.mutedActors.filter((m) => m.id !== target.id), { ...target, until }],
        };
        try {
          window.localStorage.setItem(storageKey('settings', profile.id), JSON.stringify(next));
        } catch {
          // تجاهل
        }
        return next;
      });
    },
    [profile.id],
  );

  const unmute = useCallback(
    (kind: 'entity' | 'actor', id: string) => {
      setSettings((current) => {
        const next: AlertSettings =
          kind === 'entity'
            ? { ...current, mutedEntities: current.mutedEntities.filter((m) => m.id !== id) }
            : { ...current, mutedActors: current.mutedActors.filter((m) => m.id !== id) };
        try {
          window.localStorage.setItem(storageKey('settings', profile.id), JSON.stringify(next));
        } catch {
          // تجاهل
        }
        return next;
      });
    },
    [profile.id],
  );

  const markAllSeen = useCallback(() => {
    const now = new Date().toISOString();
    setSeenAt(now);
    try {
      window.localStorage.setItem(storageKey('seen', profile.id), now);
    } catch {
      // التخزين المحلي غير متاح — تبقى الحالة لهذه الجلسة فقط
    }
  }, [profile.id]);

  // الجرس والقائمة يعملان كالمعتاد — إعدادات الإشعار اللحظي لا تؤثر عليهما إطلاقاً
  const feed = useMemo(
    () => (enabled ? applyAlertSettings(rawAlerts, settings, seenAt) : { alerts: [], unread: 0, hiddenByRules: 0, muted: 0 }),
    [enabled, rawAlerts, settings, seenAt],
  );

  const value = useMemo(
    () => ({
      alerts: feed.alerts,
      loading,
      truncated,
      unread: feed.unread,
      hiddenByRules: feed.hiddenByRules,
      mutedCount: feed.muted,
      settings,
      seenAt,
      refresh,
      markAllSeen,
      saveSettings,
      saveLive,
      primeSound,
      muteEntity,
      muteActor,
      unmute,
    }),
    [
      feed,
      loading,
      truncated,
      settings,
      seenAt,
      refresh,
      markAllSeen,
      saveSettings,
      saveLive,
      primeSound,
      muteEntity,
      muteActor,
      unmute,
    ],
  );

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

/** جرس التنبيهات مع عدّاد غير المقروء — يظهر للمدير فقط. */
export function AlertsBell({ className }: { className?: string }) {
  const profile = useProfile();
  const router = useRouter();
  const { unread } = useAlerts();

  if (profile.role !== 'manager') return null;

  return (
    <button
      type="button"
      onClick={() => router.push({ name: 'alerts' })}
      title="التنبيهات"
      className={
        className ??
        'relative grid place-items-center w-9 h-9 rounded-[12px] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-variant)] active:scale-95 transition-[background-color,color,border-color,transform]'
      }
    >
      <Bell className="w-4.5 h-4.5" />
      {unread > 0 && (
        <span className="absolute -top-1 -left-1 min-w-[19px] h-[19px] px-1 rounded-full bg-[var(--error)] text-white text-[10px] font-bold grid place-items-center ring-2 ring-[var(--surface)] tnum">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}
