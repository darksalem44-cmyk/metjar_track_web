'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, BadgeDollarSign, CircleOff, FileSpreadsheet, RefreshCw, ShoppingBag, Store as StoreIcon } from 'lucide-react';
import { useRouter } from '@/components/RouterContext';
import { fetchStoreProductStats, type StoreProductStats } from '@/lib/data/storeProductStats';
import { downloadTextFile } from '@/lib/export';
import { toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { Button, CenteredSpinner, EmptyState, PageHeader, StatCard } from '@/components/ui/controls';
import { SearchField } from '@/components/ui/fields';

type SortKey = 'storeName' | 'total' | 'unpriced' | 'priced';

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'storeName', label: 'اسم المتجر', numeric: false },
  { key: 'total', label: 'إجمالي المنتجات', numeric: true },
  { key: 'unpriced', label: 'غير مسعّرة (السعر 0)', numeric: true },
  { key: 'priced', label: 'مسعّرة', numeric: true },
];

const fmt = (n: number) => n.toLocaleString('ar');

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function StoreProductStatsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<StoreProductStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'total', dir: 'desc' });

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

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({ total: acc.total + r.total, unpriced: acc.unpriced + r.unpriced, priced: acc.priced + r.priced }),
        { total: 0, unpriced: 0, priced: 0 },
      ),
    [rows],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => r.storeName.toLowerCase().includes(q)) : rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const diff = sort.key === 'storeName' ? a.storeName.localeCompare(b.storeName, 'ar') : a[sort.key] - b[sort.key];
      return diff !== 0 ? diff * factor : a.storeName.localeCompare(b.storeName, 'ar');
    });
  }, [rows, search, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'storeName' ? 'asc' : 'desc' }));

  const exportCsv = () => {
    const lines = [
      COLUMNS.map((c) => c.label).join(','),
      ...visible.map((r) => [csvCell(r.storeName), r.total, r.unpriced, r.priced].join(',')),
    ];
    downloadTextFile(`store-products-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'));
  };

  return (
    <div>
      <PageHeader
        title="إحصائية منتجات المتاجر"
        subtitle="عدد المنتجات المسعّرة وغير المسعّرة لكل متجر"
        trailing={
          <Button variant="surface" size="sm" onClick={load} loading={loading} icon={<RefreshCw className="w-4 h-4" />}>
            تحديث
          </Button>
        }
        action={
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={loading || visible.length === 0} icon={<FileSpreadsheet className="w-4 h-4" />}>
            تصدير CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="المتاجر" value={fmt(rows.length)} icon={<StoreIcon className="w-4.5 h-4.5" />} tint="primary" />
        <StatCard label="إجمالي المنتجات" value={fmt(totals.total)} icon={<ShoppingBag className="w-4.5 h-4.5" />} tint="purple" />
        <StatCard label="غير مسعّرة" value={fmt(totals.unpriced)} icon={<CircleOff className="w-4.5 h-4.5" />} tint="warning" />
        <StatCard label="مسعّرة" value={fmt(totals.priced)} icon={<BadgeDollarSign className="w-4.5 h-4.5" />} tint="success" />
      </div>

      <SearchField value={search} onChange={setSearch} placeholder="ابحث باسم المتجر" className="mb-4 max-w-sm" />

      {loading && rows.length === 0 ? (
        <CenteredSpinner label="جاري حساب الإحصائية..." />
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState icon={<StoreIcon />} title={search.trim() ? 'لا توجد نتائج مطابقة' : 'لا توجد متاجر بعد'} />
        </div>
      ) : (
        <div className="card anim-enter overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
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
                  <td className={cn('px-4 py-3 text-center font-semibold tnum', r.unpriced > 0 ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]')}>
                    {fmt(r.unpriced)}
                  </td>
                  <td className={cn('px-4 py-3 text-center font-semibold tnum', r.priced > 0 ? 'text-[var(--green)]' : 'text-[var(--text-muted)]')}>
                    {fmt(r.priced)}
                  </td>
                </tr>
              ))}
            </tbody>
            {!search.trim() && (
              <tfoot>
                <tr className="border-t-2 border-[var(--border)] bg-[var(--surface-variant)] font-bold">
                  <td className="px-4 py-3 text-[var(--text)]">الإجمالي</td>
                  <td className="px-4 py-3 text-center tnum text-[var(--text)]">{fmt(totals.total)}</td>
                  <td className="px-4 py-3 text-center tnum text-[var(--warning)]">{fmt(totals.unpriced)}</td>
                  <td className="px-4 py-3 text-center tnum text-[var(--green)]">{fmt(totals.priced)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
