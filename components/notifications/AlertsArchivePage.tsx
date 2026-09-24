'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarRange, ChevronDown, FileSpreadsheet, MailCheck, Printer, Users } from 'lucide-react';
import { useProfile } from '@/components/ProfileContext';
import { useRouter } from '@/components/RouterContext';
import AlertRow from '@/components/notifications/AlertRow';
import { useAlerts } from '@/components/notifications/AlertsProvider';
import {
  alertsToCsv,
  applySettingsToArchive,
  archiveFileName,
  buildArchiveReportHtml,
  buildWeeklyArchive,
  fetchAdminAlerts,
  fetchWeeklyReports,
  type AdminAlert,
  type WeeklyArchive,
  type WeeklyReport,
} from '@/lib/notifications';
import { downloadTextFile, openPrintDocument } from '@/lib/export';
import { cn, relativeTime } from '@/lib/utils';
import { toast, toastError } from '@/lib/toast';
import { Button, CenteredSpinner, Chip, EmptyState, PageHeader, Toggle } from '@/components/ui/controls';

const ARCHIVE_WEEKS = 8;
/** نافذة الجلب أوسع من عدد الأسابيع لضمان تغطية كامل الأسبوع الأقدم. */
const ARCHIVE_DAYS = ARCHIVE_WEEKS * 7 + 7;

export default function AlertsArchivePage() {
  const profile = useProfile();
  const router = useRouter();
  const { settings } = useAlerts();
  const isManager = profile.role === 'manager';
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [loading, setLoading] = useState(isManager);
  const [grouping, setGrouping] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [newReportIds, setNewReportIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isManager) return;
    let disposed = false;
    (async () => {
      try {
        const data = await fetchAdminAlerts({ days: ARCHIVE_DAYS, limit: 500 });
        if (!disposed) setAlerts(data);
      } catch (e: any) {
        if (!disposed) toastError(typeof e === 'string' ? e : 'تعذر تحميل الأرشيف');
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [isManager]);

  // التقارير التي أنشأتها الدالة المجدولة (إن كان الجدول مُهيّأ)
  useEffect(() => {
    if (!isManager) return;
    const frame = requestAnimationFrame(() => {
      void fetchWeeklyReports().then((items) => {
        setReports(items);
        const seenKey = `mt_reports_seen_${profile.id}`;
        let seenAt = 0;
        try {
          seenAt = Date.parse(window.localStorage.getItem(seenKey) ?? '') || 0;
        } catch {
          seenAt = 0;
        }
        setNewReportIds(items.filter((item) => Date.parse(item.generatedAt) > seenAt).map((item) => item.id));
        try {
          window.localStorage.setItem(seenKey, new Date().toISOString());
        } catch {
          // تجاهل
        }
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [isManager, profile.id]);

  // نطبّق نفس قواعد التنبيهات والكتم حتى يكون الأرشيف والتقرير متطابقين مع ما يراه المدير
  const weeks = useMemo(
    () => applySettingsToArchive(buildWeeklyArchive(alerts, { weeks: ARCHIVE_WEEKS }), settings),
    [alerts, settings],
  );
  const busiest = useMemo(
    () => [...weeks].sort((a, b) => b.total - a.total)[0],
    [weeks],
  );

  const toggle = (key: string) => setExpanded((current) => (current === key ? null : key));

  const exportCsv = (rows: AdminAlert[], name: string) => {
    if (rows.length === 0) {
      toast('لا توجد أحداث للتصدير', 'info');
      return;
    }
    downloadTextFile(name, alertsToCsv(rows));
  };

  const exportAllCsv = () => exportCsv(alerts, archiveFileName('csv'));

  const printWeeks = (target: WeeklyArchive[], filenameHint: string) => {
    const opened = openPrintDocument(buildArchiveReportHtml(target, { title: filenameHint }));
    if (!opened) toastError('منع المتصفح فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة');
  };

  const printAll = () => printWeeks(weeks, 'تقرير التنبيهات الأسبوعي');

  if (!isManager) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="الأرشيف الأسبوعي" onBack={() => router.pop()} />
        <EmptyState
          icon={<CalendarRange className="w-6 h-6" />}
          title="غير متاح"
          subtitle="أرشيف التنبيهات متاح للمدير فقط"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="الأرشيف الأسبوعي"
        subtitle={`ملخص آخر ${ARCHIVE_WEEKS} أسابيع • إجمالي ${alerts.length} حدثاً`}
        onBack={() => router.pop()}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push({ name: 'alerts' })}>
              <Bell className="w-4 h-4" />
              التنبيهات الحية
            </Button>
            {weeks.some((week) => week.total > 0) && (
              <>
                <Button variant="outline" size="sm" onClick={exportAllCsv}>
                  <FileSpreadsheet className="w-4 h-4" />
                  CSV
                </Button>
                <Button variant="outline" size="sm" onClick={printAll}>
                  <Printer className="w-4 h-4" />
                  طباعة / PDF
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 mb-4">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[var(--text)]">دمج الأحداث المتقاربة</p>
          <p className="text-[10.5px] text-[var(--text-secondary)]">
            يجعل قائمة كل أسبوع أقصر وأسهل للمراجعة
          </p>
        </div>
        <Toggle checked={grouping} onChange={setGrouping} size="sm" />
      </div>

      {reports.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[13px] font-bold text-[var(--text)] flex items-center gap-1.5">
              <MailCheck className="w-4 h-4 text-[var(--primary)]" />
              تقارير أُرسلت تلقائياً
            </h3>
            <span className="text-[10.5px] text-[var(--text-muted)]">تُنشأ كل أحد صباحاً</span>
          </div>
          <div className="space-y-2">
            {reports.map((report) => (
              <div
                key={report.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 flex items-start gap-3"
              >
                <span className="w-9 h-9 rounded-xl bg-[var(--primary-surface-light)] text-[var(--primary)] grid place-items-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold text-[var(--text)] flex-1">
                      تقرير أسبوع {report.label}
                    </p>
                    {newReportIds.includes(report.id) && <Chip tone="error" label="جديد" />}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Chip tone="neutral" label={`${report.total} حدثاً`} />
                    {report.critical > 0 && <Chip tone="error" label={`${report.critical} حرج`} />}
                    {report.warning > 0 && <Chip tone="warning" label={`${report.warning} تحذير`} />}
                    {report.info > 0 && <Chip tone="neutral" label={`${report.info} معلوماتي`} />}
                  </div>
                  <p className="text-[10.5px] text-[var(--text-muted)] mt-1">
                    أُنشئ {relativeTime(report.generatedAt)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const opened = openPrintDocument(report.html);
                    if (!opened) toastError('منع المتصفح فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة');
                  }}
                >
                  <Printer className="w-4 h-4" />
                  PDF
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <CenteredSpinner label="جاري تحميل الأرشيف..." />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={<CalendarRange className="w-6 h-6" />}
          title="لا يوجد أرشيف بعد"
          subtitle={`لم تُسجَّل أحداث حساسة في آخر ${ARCHIVE_WEEKS} أسابيع`}
        />
      ) : (
        <div className="space-y-2.5">
          {busiest && busiest.total > 0 && (
            <p className="text-[11px] text-[var(--text-secondary)] mb-1">
              الأسبوع الأكثر نشاطاً: <span className="font-semibold text-[var(--text)]">{busiest.label}</span> بـ {busiest.total} حدثاً
            </p>
          )}

          {weeks.map((week) => {
            const rows = grouping ? week.groupedAlerts : week.alerts;
            const isOpen = expanded === week.key;
            return (
              <div
                key={week.key}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggle(week.key)}
                  className="w-full text-start px-3.5 py-3 flex items-center gap-3 hover:bg-[var(--surface-variant)] transition-colors"
                >
                  <span
                    className={cn(
                      'w-9 h-9 rounded-xl grid place-items-center shrink-0',
                      week.critical > 0
                        ? 'bg-[var(--error)]/10 text-[var(--error)]'
                        : 'bg-[var(--primary-surface-light)] text-[var(--primary)]',
                    )}
                  >
                    <CalendarRange className="w-4 h-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-[var(--text)]">{week.label}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Chip tone="neutral" label={`${week.total} حدثاً`} />
                      {week.critical > 0 && <Chip tone="error" label={`${week.critical} حرج`} />}
                      {week.warning > 0 && <Chip tone="warning" label={`${week.warning} تحذير`} />}
                      {week.info > 0 && <Chip tone="neutral" label={`${week.info} معلوماتي`} />}
                      {week.entityCount > 0 && <Chip tone="primary" label={`${week.entityCount} كياناً`} />}
                    </div>
                    {week.topActors.length > 0 && (
                      <p className="flex items-center gap-1 text-[10.5px] text-[var(--text-muted)] mt-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {week.topActors
                          .map((actor) => `${actor.name} (${actor.count})`)
                          .join(' • ')}
                      </p>
                    )}
                  </div>

                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-[var(--text-secondary)] shrink-0 transition-transform',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-[var(--border)] p-3 space-y-2 bg-[var(--surface-main)]">
                    {rows.length === 0 ? (
                      <p className="text-[12px] text-[var(--text-muted)] py-3 text-center">
                        لا أحداث في هذا الأسبوع
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center justify-end gap-2 pb-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportCsv(week.alerts, archiveFileName('csv'))}
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            CSV
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => printWeeks([week], `تقرير أسبوع ${week.label}`)}
                          >
                            <Printer className="w-4 h-4" />
                            طباعة
                          </Button>
                        </div>

                        {rows.map((alert) => (
                          <AlertRow key={alert.id} alert={alert} />
                        ))}
                        {grouping && week.alerts.length !== rows.length && (
                          <p className="text-[10.5px] text-[var(--text-muted)] text-center pt-1">
                            {week.alerts.length} حدثاً مدموجاً في {rows.length} تنبيهاً
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {grouping && (
            <p className="text-[10.5px] text-[var(--text-muted)] text-center pt-1">
              عدد الأحداث الأصلية في الأرشيف: {alerts.length} — أوقف الدمج لمراجعة كل حدث على حدة
            </p>
          )}
        </div>
      )}
    </div>
  );
}
