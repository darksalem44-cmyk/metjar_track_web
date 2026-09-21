'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { useProfile } from '@/components/ProfileContext';
import { useRouter } from '@/components/RouterContext';
import type { ActivityEntityType } from '@/lib/types';
import {
  applyAlertSettings,
  defaultAlertSettings,
  fetchAdminAlerts,
  normalizeAlertSettings,
  subscribeToAlerts,
  type AdminAlert,
  type AlertSettings,
} from '@/lib/notifications';

interface AlertsState {
  /** التنبيهات الظاهرة بعد تطبيق القواعد والكتم */
  alerts: AdminAlert[];
  loading: boolean;
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
 * مصدر واحد لتنبيهات المدير: يجلبها، يشترك في الجديد لحظياً،
 * ويطبّق إعدادات القواعد والكتم المحفوظة في هذا المتصفح.
 */
export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const profile = useProfile();
  const enabled = profile.role === 'manager';

  const [rawAlerts, setRawAlerts] = useState<AdminAlert[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [seenAt, setSeenAt] = useState<string | null>(() => readStorage(storageKey('seen', profile.id)));
  const [settings, setSettings] = useState<AlertSettings>(() => readSettings(profile.id));

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setRawAlerts(await fetchAdminAlerts());
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

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_INTERVAL);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') schedule();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      cancelAnimationFrame(initial);
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribe();
    };
  }, [enabled, refresh]);

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

  const feed = useMemo(
    () => (enabled ? applyAlertSettings(rawAlerts, settings, seenAt) : { alerts: [], unread: 0, hiddenByRules: 0, muted: 0 }),
    [enabled, rawAlerts, settings, seenAt],
  );

  const value = useMemo(
    () => ({
      alerts: feed.alerts,
      loading,
      unread: feed.unread,
      hiddenByRules: feed.hiddenByRules,
      mutedCount: feed.muted,
      settings,
      seenAt,
      refresh,
      markAllSeen,
      saveSettings,
      muteEntity,
      muteActor,
      unmute,
    }),
    [
      feed,
      loading,
      settings,
      seenAt,
      refresh,
      markAllSeen,
      saveSettings,
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
        'relative grid place-items-center w-9 h-9 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)]'
      }
    >
      <Bell className="w-4.5 h-4.5" />
      {unread > 0 && (
        <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--error)] text-white text-[10px] font-bold grid place-items-center">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}
