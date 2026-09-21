'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import { fetchAllAccounts } from '@/lib/data/accounts';
import { getActorSummaries } from '@/lib/data/activities';
import type { ActorWithProfile, PeriodKey, AccountFilter } from '@/lib/types';
import { accountFilterOptions } from '@/lib/constants';
import { getPeriodRange, cn } from '@/lib/utils';
import { toastError } from '@/lib/toast';
import { BarChart3 } from 'lucide-react';
import { Avatar, CenteredSpinner, Chip, EmptyState } from '@/components/ui/controls';
import { SearchField } from '@/components/ui/fields';

type Summary = { total: number; stores: number; branches: number; products: number };

const PERIODS: { value: PeriodKey | 'all'; label: string }[] = [
  { value: 'today', label: 'اليوم' },
  { value: 'last7', label: 'آخر 7 أيام' },
  { value: 'last30', label: 'آخر 30 يوماً' },
  { value: 'all', label: 'الكل' },
];

export default function ActivitiesList() {
  const router = useRouter();
  const [actors, setActors] = useState<ActorWithProfile[]>([]);
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<PeriodKey | 'all'>('last7');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchAllAccounts();
      setActors(all);
      if (all.length === 0) return;
      const ids = all.map((a) => a.id);
      const { from, to } = getPeriodRange(range === 'all' ? 'last7' : range, new Date());
      if (range === 'all') from.setFullYear(2000);
      const rows = await getActorSummaries({ actorIds: ids, actorRole: 'all', from, to });
      const map: Record<string, Summary> = {};
      for (const r of Object.values(rows)) {
        map[r.actor_id] = { total: r.total, stores: r.stores, branches: r.branches, products: r.products };
      }
      setSummaries(map);
    } catch (e: any) {
      toastError(typeof e === 'string' ? e : 'تعذر تحميل النشاطات');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const total = useMemo(() => Object.values(summaries).reduce((s, x) => s + x.total, 0), [summaries]);

  const filtered = useMemo(
    () =>
      [...actors]
        .filter((a) => {
          const q = search.trim().toLowerCase();
          if (!q) return true;
          return a.fullName.toLowerCase().includes(q) || (a.email ?? '').toLowerCase().includes(q);
        })
        .filter((a) => {
          if (statusFilter === 'active') return a.isActive;
          if (statusFilter === 'disabled') return !a.isActive;
          if (statusFilter === 'withPermissions') return a.canEdit || a.canDelete;
          return true;
        })
        .map((a) => ({ actor: a, s: summaries[a.id] ?? { total: 0, stores: 0, branches: 0, products: 0 } }))
        .sort((a, b) => b.s.total - a.s.total),
    [actors, summaries, search, statusFilter],
  );

  const rangeLabel = PERIODS.find((p) => p.value === range)?.label ?? '';

  const go = (a: ActorWithProfile) => {
    router.push({ name: 'user-report', actorId: a.id, role: a.role, actorName: a.fullName, actorEmail: a.email ?? '' });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text)]">النشاطات</h1>
          <p className="text-[12px] text-[var(--text-secondary)]">
            {rangeLabel} • {total} حدثاً إجمالاً
          </p>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setRange(p.value)}
              className={cn(
                'px-3 py-1.5 rounded-full border text-[12px] font-semibold transition-colors whitespace-nowrap',
                range === p.value
                  ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]'
                  : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--border-light)]',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <SearchField value={search} onChange={setSearch} placeholder="بحث عن مستخدم بالاسم أو البريد..." className="max-w-md" />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-4">
        {accountFilterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={cn(
              'px-3 py-1.5 rounded-full border text-[12px] font-semibold transition-colors whitespace-nowrap',
              statusFilter === opt.value
                ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--border-light)]',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <CenteredSpinner label="جاري تحميل النشاطات..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="w-6 h-6" />}
          title={search || statusFilter !== 'all' ? 'لا توجد نتائج مطابقة' : 'لا توجد نشاطات'}
          subtitle={search || statusFilter !== 'all' ? 'جرّب تعديل البحث أو المرشحات' : 'لم يتم تسجيل أي أحداث في هذه الفترة'}
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map(({ actor, s }) => (
            <button
              key={actor.id}
              type="button"
              onClick={() => go(actor)}
              className="w-full text-start rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--border-light)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar name={actor.fullName} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[var(--text)] truncate">{actor.fullName}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">{actor.email || '—'}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <Chip tone={actor.role === 'merchant' ? 'primary' : actor.role === 'employee' ? 'purple' : 'neutral'} label={actor.role === 'merchant' ? 'تاجر' : actor.role === 'employee' ? 'موظف' : 'مدير'} />
                    {!actor.isActive && <Chip tone="neutral" label="معطّل" />}
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-center">
                    <p className="text-[18px] font-bold text-[var(--primary)] leading-none">{s.total}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">إجمالي</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[18px] font-bold text-[var(--text)] leading-none">{s.stores}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">متاجر</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[18px] font-bold text-[var(--text)] leading-none">{s.branches}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">فروع</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[18px] font-bold text-[var(--text)] leading-none">{s.products}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">منتجات</p>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}