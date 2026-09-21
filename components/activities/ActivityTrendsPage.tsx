'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  FileSpreadsheet,
  Printer,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useProfile } from '@/components/ProfileContext';
import { useRouter } from '@/components/RouterContext';
import ActivityWeeklyChart from '@/components/activities/ActivityWeeklyChart';
import {
  buildActivityTrendSeries,
  buildTopEntities,
  formatDelta,
  trendToCsv,
  weekDelta,
  type TrendPoint,
} from '@/lib/trends';
import { fetchAdminAlerts } from '@/lib/notifications';
import { downloadTextFile, openPrintDocument } from '@/lib/export';
import { cn } from '@/lib/utils';
import { toastError } from '@/lib/toast';
import {
  Button,
  CenteredSpinner,
  Chip,
  EmptyState,
  PageHeader,
} from '@/components/ui/controls';

const TREND_WEEKS = 8;
const TREND_DAYS = TREND_WEEKS * 7 + 7;

const entityTone = { store: 'primary', branch: 'purple', product: 'orange' } as const;
const entityLabels = { store: 'متجر', branch: 'فرع', product: 'منتج' } as const;

/** رأس قسم موحّد. */
function SectionTitle({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 mb-2">
      <h3 className="text-[13px] font-bold text-[var(--text)] flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      {hint && <span className="text-[10.5px] text-[var(--text-muted)]">{hint}</span>}
    </div>
  );
}

/** بطاقة مقارنة أسبوعية: إجمالي + فرق عن السابق + تصنيفات صغيرة. */
function WeekCompareCard({ point, series }: { point: TrendPoint; series: TrendPoint[] }) {
  const delta = weekDelta(point, series);
  const up = delta !== null && delta > 0;
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 min-w-[150px] flex-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-bold text-[var(--text)]">{point.label}</p>
        {delta !== null && delta !== 0 && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-[10.5px] font-semibold',
              up ? 'text-[var(--error)]' : 'text-[var(--green)]',
            )}
          >
            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {up ? `+${delta}` : `−${Math.abs(delta)}`}
          </span>
        )}
      </div>
      <p className="text-[22px] font-bold text-[var(--primary)] leading-none mt-2">{point.total}</p>
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        <Chip tone="success" label={`+${point.created}`} />
        <Chip tone="primary" label={`~${point.updated}`} />
        {point.deleted > 0 && <Chip tone="error" label={`✕${point.deleted}`} />}
      </div>
    </div>
  );
}

export default function ActivityTrendsPage() {
  const profile = useProfile();
  const router = useRouter();
  const isManager = profile.role === 'manager';

  const [loading, setLoading] = useState(isManager);
  const [alerts, setAlerts] = useState<Awaited<ReturnType<typeof fetchAdminAlerts>>>([]);

  useEffect(() => {
    if (!isManager) return;
    let disposed = false;
    (async () => {
      try {
        const data = await fetchAdminAlerts({ days: TREND_DAYS, limit: 500 });
        if (!disposed) setAlerts(data);
      } catch (e: any) {
        if (!disposed) toastError(typeof e === 'string' ? e : 'تعذر تحميل الاتجاهات');
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [isManager]);

  const series = useMemo(
    () => buildActivityTrendSeries(alerts, { weeks: TREND_WEEKS }),
    [alerts],
  );
  const tops = useMemo(
    () => buildTopEntities(alerts, { weeks: TREND_WEEKS, limit: 5 }),
    [alerts],
  );
  const totals = useMemo(
    () =>
      series.reduce(
        (acc, p) => ({
          total: acc.total + p.total,
          created: acc.created + p.created,
          updated: acc.updated + p.updated,
          deleted: acc.deleted + p.deleted,
        }),
        { total: 0, created: 0, updated: 0, deleted: 0 },
      ),
    [series],
  );
  const latest = series[0];
  const latestDelta = latest ? weekDelta(latest, series) : null;

  const exportCsv = () => {
    if (totals.total === 0) {
      toastError('لا توجد بيانات للتصدير');
      return;
    }
    downloadTextFile('metjar-track-trends.csv', trendToCsv(series, tops));
  };

  const printReport = () => {
    const html = buildTrendsHtml(series, tops, totals);
    const opened = openPrintDocument(html);
    if (!opened) toastError('منع المتصفح فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة');
  };

  if (!isManager) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="اتجاهات النشاط" onBack={() => router.pop()} />
        <EmptyState
          icon={<CalendarRange className="w-6 h-6" />}
          title="غير متاح"
          subtitle="لوحة الاتجاهات متاحة للمدير فقط"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="اتجاهات النشاط"
        subtitle={`مقارنة آخر ${TREND_WEEKS} أسابيع • إجمالي ${totals.total} حدثاً`}
        onBack={() => router.pop()}
        action={
          <div className="flex items-center gap-2">
            {totals.total > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <FileSpreadsheet className="w-4 h-4" />
                  CSV
                </Button>
                <Button variant="outline" size="sm" onClick={printReport}>
                  <Printer className="w-4 h-4" />
                  طباعة / PDF
                </Button>
              </>
            )}
          </div>
        }
      />

      {loading ? (
        <CenteredSpinner label="جاري تحميل الاتجاهات..." />
      ) : totals.total === 0 ? (
        <EmptyState
          icon={<CalendarRange className="w-6 h-6" />}
          title="لا توجد بيانات كافية"
          subtitle={`لم تُسجَّل أحداث حساسة في آخر ${TREND_WEEKS} أسابيع`}
        />
      ) : (
        <div className="space-y-5">
          {/* المخطط الأسبوعي */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <SectionTitle
              icon={<CalendarRange className="w-4 h-4 text-[var(--primary)]" />}
              title="حجم النشاط أسبوعياً"
              hint={`${totals.created} إضافة • ${totals.updated} تعديل • ${totals.deleted} حذف`}
            />
            <ActivityWeeklyChart series={series} />
            {latestDelta !== null && (
              <p className="text-[11.5px] text-[var(--text-secondary)] mt-2 text-center">
                الأسبوع الحالي: <span className="font-semibold text-[var(--text)]">{latest.total}</span> حدثاً —{' '}
                {formatDelta(latestDelta)}
              </p>
            )}
          </div>

          {/* بطاقات المقارنة */}
          <div>
            <SectionTitle icon={<TrendingUp className="w-4 h-4 text-[var(--primary)]" />} title="مقارنة الأأسابيع" />
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {series.slice(0, 4).map((point) => (
                <WeekCompareCard key={point.key} point={point} series={series} />
              ))}
            </div>
          </div>

          {/* الأكثر نشاطاً */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <SectionTitle
                icon={<Users className="w-4 h-4 text-[var(--primary)]" />}
                title="أكثر الموظفين نشاطاً"
                hint="آخر 8 أسابيع"
              />
              {tops.actors.length === 0 ? (
                <p className="text-[12px] text-[var(--text-muted)] py-4 text-center">لا توجد بيانات</p>
              ) : (
                <TopList
                  rows={tops.actors.map((a) => ({
                    key: a.id,
                    label: a.name,
                    count: a.count,
                    created: a.created,
                    updated: a.updated,
                    deleted: a.deleted,
                  }))}
                />
              )}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <SectionTitle
                icon={<TrendingUp className="w-4 h-4 text-[var(--primary)]" />}
                title="أكثر المتاجر والمنتجات تغييراً"
                hint="آخر 8 أسابيع"
              />
              {tops.entities.length === 0 ? (
                <p className="text-[12px] text-[var(--text-muted)] py-4 text-center">لا توجد بيانات</p>
              ) : (
                <div className="space-y-2">
                  {tops.entities.map((entity) => (
                    <div key={entity.key} className="flex items-center gap-2.5">
                      <Chip tone={entityTone[entity.entityType]} label={entityLabels[entity.entityType]} />
                      <p className="text-[12.5px] font-semibold text-[var(--text)] flex-1 truncate">
                        {entity.name}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        <Chip tone="success" label={`+${entity.created}`} />
                        <Chip tone="primary" label={`~${entity.updated}`} />
                        {entity.deleted > 0 && <Chip tone="error" label={`✕${entity.deleted}`} />}
                      </div>
                      <span className="text-[13px] font-bold text-[var(--primary)] w-7 text-center shrink-0">
                        {entity.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TopList({
  rows,
}: {
  rows: { key: string; label: string; count: number; created: number; updated: number; deleted: number }[];
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.key}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-[12.5px] font-semibold text-[var(--text)] truncate">{row.label}</p>
            <span className="text-[12px] font-bold text-[var(--primary)] shrink-0">{row.count}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--surface-variant)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-all"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-1 mt-1">
            <Chip tone="success" label={`+${row.created}`} />
            <Chip tone="primary" label={`~${row.updated}`} />
            {row.deleted > 0 && <Chip tone="error" label={`✕${row.deleted}`} />}
          </div>
        </div>
      ))}
    </div>
  );
}

/** يبني تقرير طباعة HTML مستقلاً من سلسلة الاتجاهات. */
function buildTrendsHtml(
  series: TrendPoint[],
  tops: ReturnType<typeof buildTopEntities>,
  totals: { total: number; created: number; updated: number; deleted: number },
): string {
  const esc = (v: unknown) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const now = new Date();

  const weekRows = [...series]
    .reverse()
    .map(
      (p) => `<tr>
        <td class="nowrap">${esc(p.label)}</td>
        <td>${p.total}</td>
        <td>${p.created}</td>
        <td>${p.updated}</td>
        <td>${p.deleted}</td>
        <td>${p.entityCount}</td>
        <td>${p.actorCount}</td>
        <td>${esc(formatDelta(weekDelta(p, series)) || '—')}</td>
      </tr>`,
    )
    .join('');

  const actorRows = tops.actors
    .map((a) => `<tr><td>${esc(a.name)}</td><td>${a.count}</td><td>${a.created}</td><td>${a.updated}</td><td>${a.deleted}</td></tr>`)
    .join('');
  const entityRows = tops.entities
    .map((e) => `<tr><td>${esc(e.name)}</td><td>${esc(entityLabels[e.entityType])}</td><td>${e.count}</td><td>${e.created}</td><td>${e.updated}</td><td>${e.deleted}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>تقرير اتجاهات النشاط</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #1c1c1c; margin: 0; font-size: 12px; }
  header { border-bottom: 2px solid #984399; padding-bottom: 8px; margin-bottom: 14px; }
  header h1 { margin: 0; font-size: 18px; color: #984399; }
  header p { margin: 4px 0 0; color: #666; font-size: 11px; }
  .summary { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; font-size: 11.5px; }
  .summary span { background: #f4eef6; border: 1px solid #e2d3e7; border-radius: 6px; padding: 4px 9px; }
  h2 { font-size: 13.5px; margin: 0 0 6px; color: #4a2a52; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: right; vertical-align: top; }
  th { background: #f7f4f8; font-size: 10.5px; }
  td { font-size: 10.5px; }
  .nowrap { white-space: nowrap; }
</style>
</head>
<body>
  <header>
    <h1>تقرير اتجاهات النشاط</h1>
    <p>متجر تراك • آخر ${series.length} أسابيع • أُنشئ في ${esc(`${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`)}</p>
  </header>
  <div class="summary">
    <span>إجمالي الأحداث: ${totals.total}</span>
    <span>إضافات: ${totals.created}</span>
    <span>تعديلات: ${totals.updated}</span>
    <span>حذف: ${totals.deleted}</span>
  </div>
  <h2>حجم النشاط أسبوعياً</h2>
  <table>
    <thead>
      <tr><th>الأسبوع</th><th>الإجمالي</th><th>إضافات</th><th>تعديلات</th><th>حذف</th><th>كيانات</th><th>فاعلون</th><th>الفرق عن السابق</th></tr>
    </thead>
    <tbody>${weekRows}</tbody>
  </table>
  <h2>أكثر الموظفين نشاطاً</h2>
  <table>
    <thead><tr><th>الاسم</th><th>الأحداث</th><th>إضافات</th><th>تعديلات</th><th>حذف</th></tr></thead>
    <tbody>${actorRows || '<tr><td colspan="5">—</td></tr>'}</tbody>
  </table>
  <h2>أكثر الكيانات تغييراً</h2>
  <table>
    <thead><tr><th>الاسم</th><th>النوع</th><th>الأحداث</th><th>إضافات</th><th>تعديلات</th><th>حذف</th></tr></thead>
    <tbody>${entityRows || '<tr><td colspan="6">—</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}
