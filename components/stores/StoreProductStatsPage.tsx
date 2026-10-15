'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeDollarSign,
  CalendarRange,
  CircleOff,
  FileSpreadsheet,
  RefreshCw,
  ShoppingBag,
  Store as StoreIcon,
  X,
} from 'lucide-react';
import { useRouter } from '@/components/RouterContext';
import {
  fetchStoreIdsWithProductActivity,
  fetchStoreProductStats,
  type StoreProductStats,
} from '@/lib/data/storeProductStats';
import { downloadTextFile } from '@/lib/export';
import { toastError } from '@/lib/toast';
import { cn, getPeriodRange } from '@/lib/utils';
import { Button, CenteredSpinner, EmptyState, PageHeader, StatCard } from '@/components/ui/controls';
import { SearchField } from '@/components/ui/fields';

type SortKey = 'storeName' | 'total' | 'unpriced' | 'priced' | 'ratio';

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'storeName', label: 'اسم المتجر', numeric: false },
  { key: 'total', label: 'إجمالي المنتجات', numeric: true },
  { key: 'unpriced', label: 'غير مسعّرة (السعر 0)', numeric: true },
  { key: 'priced', label: 'مسعّرة', numeric: true },
  { key: 'ratio', label: 'نسبة التسعير', numeric: true },
];

const fmt = (n: number) => n.toLocaleString('ar');

/** نسبة المنتجات المسعّرة (0..1)، أو null لمتجر بلا منتجات. */
const pricedRatio = (r: { total: number; priced: number }) => (r.total > 0 ? r.priced / r.total : null);

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** شريط نسبة التسعير: أخضر للمكتمل تقريباً، برتقالي للمتوسط، أحمر للضعيف. */
function PricedBar({ ratio }: { ratio: number | null }) {
  if (ratio === null) return <span className="text-[var(--text-muted)]">—</span>;
  const pct = Math.round(ratio * 100);
  const tone = ratio >= 0.8 ? 'var(--green)' : ratio >= 0.4 ? 'var(--warning)' : 'var(--error)';
  return (
    <div className="flex items-center gap-2 min-w-[120px]" title={`${pct}% من المنتجات مسعّرة`}>
      <div
        className="h-2 flex-1 rounded-full bg-[var(--surface-variant)] border border-[var(--border)] overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: tone }} />
      </div>
      <span className="w-10 text-[12px] font-bold tnum text-end" style={{ color: tone }}>
        {pct}%
      </span>
    </div>
  );
}

/** تاريخ محلي بصيغة حقل الإدخال (YYYY-MM-DD). */
function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type PresetKey = 'today' | 'last7' | 'last30' | 'month';

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'اليوم' },
  { key: 'last7', label: 'آخر 7 أيام' },
  { key: 'last30', label: 'آخر 30 يوماً' },
  { key: 'month', label: 'هذا الشهر' },
];

/** مدى الفترة الجاهزة كتاريخي إدخال، ينتهي دائماً باليوم الحالي. */
function presetRange(key: PresetKey, now: Date = new Date()): { from: string; to: string } {
  const to = toInputDate(now);
  if (key === 'month') return { from: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  const { from } = getPeriodRange(key, now);
  return { from: toInputDate(from), to };
}

const dateInputClass =
  'bg-[var(--input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[13px] text-[var(--text)] min-w-0';

export default function StoreProductStatsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<StoreProductStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'total', dir: 'desc' });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  /** نتيجة آخر استعلام للمدى الزمني، موسومة بمفتاح المدى الذي أنتجها. */
  const [rangeResult, setRangeResult] = useState<{ key: string; ids: Set<string> } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchStoreProductStats());
    } catch (e) {
      toastError(typeof e === 'string' ? e : 'تعذر تحميل إحصائية المنتجات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // التحميل الأول: loading يبدأ true، فلا حاجة لتغيير الحالة قبل وصول النتيجة
    let cancelled = false;
    fetchStoreProductStats()
      .then((data) => !cancelled && setRows(data))
      .catch((e) => !cancelled && toastError(typeof e === 'string' ? e : 'تعذر تحميل إحصائية المنتجات'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const rangeInvalid = !!from && !!to && from > to;
  const rangeKey = (from || to) && !rangeInvalid ? `${from}|${to}` : '';

  useEffect(() => {
    if (!rangeKey) return;
    let cancelled = false;
    fetchStoreIdsWithProductActivity({ from: from || undefined, to: to || undefined })
      .then((ids) => !cancelled && setRangeResult({ key: rangeKey, ids }))
      .catch((e) => !cancelled && toastError(typeof e === 'string' ? e : 'تعذر تطبيق فلتر التاريخ'));
    return () => {
      cancelled = true;
    };
  }, [rangeKey, from, to]);

  // الفترة الجاهزة المطابقة للتاريخين الحاليين — أي تعديل يدوي يلغي تمييزها تلقائياً
  const activePreset = PRESETS.find((p) => {
    const r = presetRange(p.key);
    return r.from === from && r.to === to;
  })?.key;

  const applyPreset = (key: PresetKey) => {
    const r = presetRange(key);
    setFrom(r.from);
    setTo(r.to);
  };

  const activeIds = rangeKey && rangeResult?.key === rangeKey ? rangeResult.ids : null;
  const rangeLoading = !!rangeKey && !activeIds;

  const refresh = () => {
    load();
    // إعادة جلب نتيجة المدى أيضاً؛ النتيجة موسومة بمفتاحها فلا تُطبَّق إن تغيّر المدى قبل وصولها
    if (rangeKey) {
      setRangeResult(null);
      fetchStoreIdsWithProductActivity({ from: from || undefined, to: to || undefined })
        .then((ids) => setRangeResult({ key: rangeKey, ids }))
        .catch((e) => toastError(typeof e === 'string' ? e : 'تعذر تطبيق فلتر التاريخ'));
    }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter(
      (r) => (!q || r.storeName.toLowerCase().includes(q)) && (!activeIds || activeIds.has(r.storeId)),
    );
    const factor = sort.dir === 'asc' ? 1 : -1;
    const value = (r: StoreProductStats) => (sort.key === 'ratio' ? pricedRatio(r) ?? -1 : sort.key === 'storeName' ? 0 : r[sort.key]);
    return filtered.sort((a, b) => {
      const diff = sort.key === 'storeName' ? a.storeName.localeCompare(b.storeName, 'ar') : value(a) - value(b);
      return diff !== 0 ? diff * factor : a.storeName.localeCompare(b.storeName, 'ar');
    });
  }, [rows, search, sort, activeIds]);

  const totals = useMemo(
    () =>
      visible.reduce(
        (acc, r) => ({ total: acc.total + r.total, unpriced: acc.unpriced + r.unpriced, priced: acc.priced + r.priced }),
        { total: 0, unpriced: 0, priced: 0 },
      ),
    [visible],
  );

  const filtered = !!search.trim() || !!activeIds;

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'storeName' ? 'asc' : 'desc' }));

  const openUnpriced = (storeId: string) =>
    router.push({ name: 'products', scope: { type: 'store', storeId }, unpriced: true });

  const exportCsv = () => {
    const lines = [
      COLUMNS.map((c) => c.label).join(','),
      ...visible.map((r) => {
        const ratio = pricedRatio(r);
        return [csvCell(r.storeName), r.total, r.unpriced, r.priced, ratio === null ? '' : `${Math.round(ratio * 100)}%`].join(',');
      }),
    ];
    const suffix = rangeKey ? `_${from || 'start'}_${to || 'end'}` : '';
    downloadTextFile(`store-products-${new Date().toISOString().slice(0, 10)}${suffix}.csv`, lines.join('\n'));
  };

  return (
    <div>
      <PageHeader
        title="إحصائية منتجات المتاجر"
        subtitle="عدد المنتجات المسعّرة وغير المسعّرة لكل متجر"
        trailing={
          <Button variant="surface" size="sm" onClick={refresh} loading={loading} icon={<RefreshCw className="w-4 h-4" />}>
            تحديث
          </Button>
        }
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={exportCsv}
            disabled={loading || rangeLoading || visible.length === 0}
            icon={<FileSpreadsheet className="w-4 h-4" />}
          >
            تصدير CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label={filtered ? 'المتاجر المعروضة' : 'المتاجر'} value={fmt(visible.length)} icon={<StoreIcon className="w-4.5 h-4.5" />} tint="primary" />
        <StatCard label="إجمالي المنتجات" value={fmt(totals.total)} icon={<ShoppingBag className="w-4.5 h-4.5" />} tint="purple" />
        <StatCard label="غير مسعّرة" value={fmt(totals.unpriced)} icon={<CircleOff className="w-4.5 h-4.5" />} tint="warning" />
        <StatCard label="مسعّرة" value={fmt(totals.priced)} icon={<BadgeDollarSign className="w-4.5 h-4.5" />} tint="success" />
      </div>

      <div className="card p-3.5 mb-4 flex flex-col lg:flex-row lg:items-end gap-3">
        <SearchField value={search} onChange={setSearch} placeholder="ابحث باسم المتجر" className="lg:max-w-xs lg:flex-1" />
        <div className="flex flex-col gap-1.5 lg:flex-1">
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--text-secondary)]">
            <CalendarRange className="w-3.5 h-3.5" />
            متاجر أُضيفت أو عُدّلت منتجاتها خلال الفترة
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                aria-pressed={activePreset === p.key}
                className={cn('pill', activePreset === p.key ? 'pill-on' : '')}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="من تاريخ"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className={cn(dateInputClass, 'flex-1')}
            />
            <span className="text-[12px] text-[var(--text-muted)]">إلى</span>
            <input
              type="date"
              aria-label="إلى تاريخ"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className={cn(dateInputClass, 'flex-1')}
            />
            {(from || to) && (
              <button
                type="button"
                onClick={() => {
                  setFrom('');
                  setTo('');
                }}
                aria-label="مسح فلتر التاريخ"
                className="grid place-items-center w-9 h-9 shrink-0 rounded-xl btn-quiet active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {rangeInvalid && <p className="text-[11.5px] text-[var(--error)]">تاريخ البداية يجب أن يسبق تاريخ النهاية</p>}
        </div>
      </div>

      {(loading && rows.length === 0) || rangeLoading ? (
        <CenteredSpinner label={rangeLoading ? 'جاري تطبيق فلتر التاريخ...' : 'جاري حساب الإحصائية...'} />
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<StoreIcon />}
            title={filtered ? 'لا توجد نتائج مطابقة' : 'لا توجد متاجر بعد'}
            subtitle={activeIds ? 'لم تُضف أو تُعدّل منتجات في أي متجر خلال هذه الفترة' : undefined}
          />
        </div>
      ) : (
        <div className="card anim-enter overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-variant)]">
                {COLUMNS.map((col) => {
                  const active = sort.key === col.key;
                  const SortIcon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={cn('px-4 py-3 font-semibold text-[12px] text-[var(--text-secondary)]', col.numeric ? 'text-center' : 'text-start')}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={cn('inline-flex items-center gap-1.5 hover:text-[var(--text)] transition-colors', active && 'text-[var(--text)]')}
                      >
                        {col.label}
                        <SortIcon className={cn('w-3.5 h-3.5', !active && 'opacity-40')} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.storeId} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-variant)]/60 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => router.push({ name: 'store-details', storeId: r.storeId })}
                      className="font-semibold text-[var(--text)] hover:text-[var(--primary)] text-start transition-colors"
                    >
                      {r.storeName || '—'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center font-bold tnum text-[var(--text)]">{fmt(r.total)}</td>
                  <td className="px-4 py-3 text-center">
                    {r.unpriced > 0 ? (
                      <button
                        type="button"
                        onClick={() => openUnpriced(r.storeId)}
                        title="عرض المنتجات غير المسعّرة"
                        className="font-semibold tnum text-[var(--warning)] underline decoration-dotted underline-offset-4 hover:decoration-solid"
                      >
                        {fmt(r.unpriced)}
                      </button>
                    ) : (
                      <span className="font-semibold tnum text-[var(--text-muted)]">{fmt(0)}</span>
                    )}
                  </td>
                  <td className={cn('px-4 py-3 text-center font-semibold tnum', r.priced > 0 ? 'text-[var(--green)]' : 'text-[var(--text-muted)]')}>
                    {fmt(r.priced)}
                  </td>
                  <td className="px-4 py-3">
                    <PricedBar ratio={pricedRatio(r)} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--border)] bg-[var(--surface-variant)] font-bold">
                <td className="px-4 py-3 text-[var(--text)]">{filtered ? 'إجمالي المعروض' : 'الإجمالي'}</td>
                <td className="px-4 py-3 text-center tnum text-[var(--text)]">{fmt(totals.total)}</td>
                <td className="px-4 py-3 text-center tnum text-[var(--warning)]">{fmt(totals.unpriced)}</td>
                <td className="px-4 py-3 text-center tnum text-[var(--green)]">{fmt(totals.priced)}</td>
                <td className="px-4 py-3">
                  <PricedBar ratio={pricedRatio(totals)} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
