'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, BellOff, BellRing, RotateCcw, UserX } from 'lucide-react';
import { useProfile } from '@/components/ProfileContext';
import { useAlerts } from '@/components/notifications/AlertsProvider';
import {
  currentPushSubscription,
  disablePush,
  enablePush,
  pushConfigured,
  pushHints,
  pushStatus,
  pushSupported,
  type PushStatus,
} from '@/lib/push';
import { toast, toastError } from '@/lib/toast';
import {
  alertRuleDescriptions,
  alertRuleLabels,
  defaultAlertSettings,
  isMuteActive,
  type AlertRuleKey,
} from '@/lib/notifications';
import { relativeTime } from '@/lib/utils';
import { Button, Chip, Toggle } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modals';

const RULE_ORDER: AlertRuleKey[] = [
  'store_deleted',
  'branch_deleted',
  'product_deleted',
  'product_price_changed',
  'entity_updated',
  'entity_created',
];

function muteLabel(until: string | null): string {
  if (!until) return 'دائم';
  const remaining = Date.parse(until) - Date.now();
  if (remaining <= 0) return 'منتهٍ';
  const hours = Math.round(remaining / (60 * 60 * 1000));
  if (hours <= 1) return `ينتهي خلال أقل من ساعة`;
  if (hours < 24) return `ينتهي خلال ${hours} ساعة`;
  return `ينتهي خلال ${Math.round(hours / 24)} يوم`;
}

export default function AlertSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useProfile();
  const { settings, saveSettings, unmute, hiddenByRules, mutedCount } = useAlerts();
  const [push, setPush] = useState<PushStatus | 'loading'>('loading');
  const [pushBusy, setPushBusy] = useState(false);

  // قراءة حالة الإشعارات على هذا الجهاز بعد الرسم (تفادي تحديث متزامن داخل الـ effect)
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void pushStatus().then((status) => setPush(status));
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const togglePush = async (next: boolean) => {
    setPushBusy(true);
    try {
      if (next) {
        const result = await enablePush(profile.id);
        if (result === 'ok') {
          setPush('on');
          toast('تم تفعيل إشعارات النظام على هذا الجهاز', 'success');
        } else if (result === 'denied') {
          setPush('denied');
          toastError('المتصفح رفض الإشعارات — اسمح بها من إعدادات الموقع');
        } else if (result === 'unconfigured') {
          setPush('unconfigured');
          toastError('مفاتيح VAPID غير مضبوطة بعد');
        } else if (result === 'development') {
          setPush('development');
          toast('إشعارات النظام تُختبر في النسخة المنشورة فقط', 'info');
        } else {
          setPush('off');
          toastError('تعذر تفعيل الإشعارات');
        }
      } else {
        await disablePush();
        setPush(await currentPushSubscription() ? 'on' : 'off');
        toast('تم إيقاف إشعارات هذا الجهاز', 'info');
      }
    } finally {
      setPushBusy(false);
    }
  };

  const activeMutedEntities = settings.mutedEntities.filter((m) => isMuteActive(m.until));
  const activeMutedActors = settings.mutedActors.filter((m) => isMuteActive(m.until));

  const setRule = (key: AlertRuleKey, patch: Partial<{ enabled: boolean; badge: boolean }>) => {
    saveSettings({
      ...settings,
      rules: { ...settings.rules, [key]: { ...settings.rules[key], ...patch } },
    });
  };

  const resetAll = () => {
    if (!window.confirm('إعادة كل قواعد التنبيهات إلى الوضع الافتراضي وإلغاء كل الكتم؟')) return;
    saveSettings(defaultAlertSettings());
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="قواعد التنبيهات"
      maxWidth={560}
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          <Button variant="outline" size="sm" onClick={resetAll}>
            <RotateCcw className="w-4 h-4" />
            الوضع الافتراضي
          </Button>
          <Button size="sm" onClick={onClose}>
            تم
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[11px] text-[var(--text-secondary)] rounded-xl border border-[var(--border)] bg-[var(--surface-variant)] p-2.5">
          القواعد والكتم تُخفي التنبيهات عن العرض فقط — السجل في قاعدة البيانات يبقى كاملاً للمراجعة.
          الإعدادات محفوظة في هذا المتصفح.
          {(hiddenByRules > 0 || mutedCount > 0) &&
            ` (مخفي الآن: ${hiddenByRules} بالقواعد و${mutedCount} بالكتم)`}
        </p>

        <div>
          <p className="text-[12px] font-bold text-[var(--text)] mb-2">القواعد</p>
          <div className="space-y-2">
            {RULE_ORDER.map((key) => {
              const rule = settings.rules[key];
              return (
                <div
                  key={key}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 flex items-start gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-[var(--text)]">{alertRuleLabels[key]}</p>
                    <p className="text-[10.5px] text-[var(--text-secondary)] mt-0.5">
                      {alertRuleDescriptions[key]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {rule.enabled && (
                      <button
                        type="button"
                        onClick={() => setRule(key, { badge: !rule.badge })}
                        title={rule.badge ? 'مُحصى على الجرس — اضغط للاكتفاء بالعرض' : 'معروض بلا عدّاد — اضغط للإحصاء'}
                      >
                        <Chip
                          tone={rule.badge ? 'error' : 'neutral'}
                          label={rule.badge ? 'يُحصى' : 'بلا عدّاد'}
                        />
                      </button>
                    )}
                    <Toggle
                      size="sm"
                      checked={rule.enabled}
                      onChange={(checked) => setRule(key, { enabled: checked })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[12px] font-bold text-[var(--text)] mb-2 flex items-center gap-1.5">
            <BellRing className="w-4 h-4 text-[var(--text-secondary)]" />
            إشعارات النظام (PWA)
          </p>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold text-[var(--text)]">تقرير أسبوعي وإشعار عند الحاجة</p>
              <p className="text-[10.5px] text-[var(--text-secondary)] mt-0.5">
                {push === 'loading' ? 'جاري التحقق...' : pushHints[push]}
              </p>
              {push === 'off' && !pushConfigured() && (
                <p className="text-[10.5px] text-[var(--text-muted)] mt-1">
                  يُولّد المفتاح بـ: npx web-push generate-vapid-keys
                </p>
              )}
            </div>
            <Toggle
              size="sm"
              checked={push === 'on'}
              disabled={pushBusy || push === 'loading' || !pushSupported()}
              onChange={(next) => void togglePush(next)}
            />
          </div>
        </div>

        <div>
          <p className="text-[12px] font-bold text-[var(--text)] mb-2 flex items-center gap-1.5">
            <BellOff className="w-4 h-4 text-[var(--text-secondary)]" />
            الكتم المؤقت
          </p>

          {activeMutedEntities.length === 0 && activeMutedActors.length === 0 ? (
            <p className="text-[11px] text-[var(--text-muted)] rounded-xl border border-dashed border-[var(--border)] p-3 text-center">
              لا شيء مكتوم — يمكنك الكتم من زر الكتم على أي تنبيه
            </p>
          ) : (
            <div className="space-y-2">
              {activeMutedEntities.map((entity) => (
                <div
                  key={`entity-${entity.id}`}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-[var(--text)] truncate">{entity.label}</p>
                    <p className="text-[10.5px] text-[var(--text-muted)]">{muteLabel(entity.until)}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => unmute('entity', entity.id)}>
                    إلغاء الكتم
                  </Button>
                </div>
              ))}

              {activeMutedActors.map((actor) => (
                <div
                  key={`actor-${actor.id}`}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 flex items-center gap-2"
                >
                  <UserX className="w-4 h-4 text-[var(--warning)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-[var(--text)] truncate">{actor.name}</p>
                    <p className="text-[10.5px] text-[var(--text-muted)]">{muteLabel(actor.until)}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => unmute('actor', actor.id)}>
                    إلغاء الكتم
                  </Button>
                </div>
              ))}
            </div>
          )}

          {settings.mutedEntities.some((m) => !isMuteActive(m.until)) && (
            <p className="text-[10.5px] text-[var(--text-muted)] mt-2">
              يوجد كتم منتهٍ منذ {relativeTime(settings.mutedEntities.find((m) => !isMuteActive(m.until))!.until!)} — يمكنك
              إزالته بإعادة الوضع الافتراضي.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
