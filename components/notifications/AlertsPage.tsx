'use client';

import { useEffect, useMemo, useState } from 'react';
import { BellOff, CalendarRange, CheckCheck, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { useProfile } from '@/components/ProfileContext';
import { useRouter } from '@/components/RouterContext';
import { useAlerts } from '@/components/notifications/AlertsProvider';
import AlertRow from '@/components/notifications/AlertRow';
import AlertSettingsModal from '@/components/notifications/AlertSettingsModal';
import { groupNearbyAlerts, type AlertSeverity } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { Button, CenteredSpinner, EmptyState, PageHeader, Toggle } from '@/components/ui/controls';

const SEVERITY_FILTERS: [AlertSeverity | 'all', string][] = [
  ['all', 'الكل'],
  ['critical', 'حرج'],
  ['warning', 'تحذير'],
  ['info', 'معلوماتي'],
];

export default function AlertsPage() {
  const profile = useProfile();
  const router = useRouter();
  const { alerts, loading, unread, hiddenByRules, mutedCount, markAllSeen } = useAlerts();
  const [severity, setSeverity] = useState<AlertSeverity | 'all'>('all');
  const [grouping, setGrouping] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isManager = profile.role === 'manager';

  // فتح الصفحة يعني أن التنبيهات قد رُئيت — نؤجّلها لما بعد الرسم لتفادي تحديث متزامن داخل effect
  useEffect(() => {
    if (!isManager || loading) return;
    const frame = requestAnimationFrame(() => markAllSeen());
    return () => cancelAnimationFrame(frame);
  }, [isManager, loading, markAllSeen]);

  const rows = useMemo(() => (grouping ? groupNearbyAlerts(alerts) : alerts), [alerts, grouping]);

  const filtered = useMemo(
    () => (severity === 'all' ? rows : rows.filter((a) => a.severity === severity)),
    [rows, severity],
  );

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  // كم حدثاً اختفى من العرض بسبب الدمج
  const mergedCount = alerts.length - rows.length;

  if (!isManager) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="التنبيهات" onBack={() => router.pop()} />
        <EmptyState
          icon={<ShieldAlert className="w-6 h-6" />}
          title="غير متاح"
          subtitle="تنبيهات الأحداث الحساسة متاحة للمدير فقط"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="التنبيهات"
        subtitle={
          alerts.length === 0
            ? 'لا توجد أحداث حساسة مسجّلة'
            : `${alerts.length} حدثاً • ${criticalCount} حرج${unread > 0 ? ` • ${unread} غير مقروء` : ''}`
        }
        onBack={() => router.pop()}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <SlidersHorizontal className="w-4 h-4" />
              قواعد التنبيهات
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push({ name: 'alerts-archive' })}>
              <CalendarRange className="w-4 h-4" />
              الأرشيف الأسبوعي
            </Button>
            {alerts.length > 0 && (
              <Button variant="outline" size="sm" onClick={markAllSeen}>
                <CheckCheck className="w-4 h-4" />
                تحديد الكل كمقروء
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {SEVERITY_FILTERS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setSeverity(value)}
            className={cn(
              'px-3 py-1.5 rounded-full border text-[12px] font-semibold transition-colors whitespace-nowrap',
              severity === value
                ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--border-light)]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 mb-4">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[var(--text)]">دمج الأحداث المتقاربة</p>
          <p className="text-[10.5px] text-[var(--text-secondary)]">
            تعديلات نفس الكيان خلال ساعة تُجمع في تنبيه واحد مع ملخص
          </p>
        </div>
        <Toggle checked={grouping} onChange={setGrouping} size="sm" />
      </div>

      {loading ? (
        <CenteredSpinner label="جاري تحميل التنبيهات..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BellOff className="w-6 h-6" />}
          title={severity === 'all' ? 'لا توجد تنبيهات' : 'لا توجد تنبيهات بهذا التصنيف'}
          subtitle={
            severity === 'all'
              ? 'لم تُسجَّل أحداث في آخر 30 يوماً — تُحدَّث القائمة لحظياً عند أي حدث جديد'
              : 'جرّب تصنيفاً آخر'
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      {grouping && mergedCount > 0 && (
        <p className="text-[10.5px] text-[var(--text-muted)] text-center mt-3">
          تم دمج {mergedCount} حدثاً متقارباً — أوقف الدمج لعرض كل حدث على حدة
        </p>
      )}

      {(hiddenByRules > 0 || mutedCount > 0) && (
        <p className="text-[10.5px] text-[var(--text-muted)] text-center mt-2">
          مخفي بقواعد التنبيهات: {hiddenByRules} • مكتوم:{' '}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="underline hover:text-[var(--text)]"
          >
            إدارة الكتم والقواعد
          </button>
        </p>
      )}

      <AlertSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
