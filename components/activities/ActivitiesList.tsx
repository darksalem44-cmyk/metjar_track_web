'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import { fetchAllAccounts } from '@/lib/data/accounts';
import { getActorSummariesForActors } from '@/lib/data/activities';
import type { ActorSummary, ActorWithProfile, PeriodKey, AccountFilter, UserRole } from '@/lib/types';
import { accountFilterOptions } from '@/lib/constants';
import { getPeriodRange, cn } from '@/lib/utils';
import { toastError } from '@/lib/toast';
import { BarChart3, CalendarRange, TrendingUp, Users } from 'lucide-react';
import { Avatar, CenteredSpinner, Chip, EmptyState } from '@/components/ui/controls';
import { SearchField } from '@/components/ui/fields';
import ActivityWeeklyChart from '@/components/activities/ActivityWeeklyChart';
import { fetchAdminAlerts } from '@/lib/notifications';
import { buildActivityTrendSeries } from '@/lib/trends';

const ZERO_SUMMARY: ActorSummary = {
  actor_id: '',
  total: 0,
  created: 0,
  updated: 0,
  deleted: 0,
  stores: 0,
  branches: 0,
  products: 0,
};

const PERIODS: { value: PeriodKey | 'all'; label: string }[] = [
  { value: 'today', label: 'اليوم' },
  { value: 'last7', label: 'آخر 7 أيام' },
  { value: 'last30', label: 'آخر 30 يوماً' },
  { value: 'all', label: 'الكل' },
];

const ROLE_FILTERS: [UserRole | 'all', string][] = [
  ['all', 'الكل'],
  ['merchant', 'تجار'],
  ['employee', 'موظفون'],
  ['manager', 'مديرون'],
];

/** 8 أسابيع للمخطط العام (بيانات التنبيهات تغطي 60 يوماً). */
const CHART_WEEKS = 8;
const CHART_DAYS = CHART_WEEKS * 7 + 7;

export default function ActivitiesList() {
  const router = useRouter();
  const [actors, setActors] = useState<ActorWithProfile[]>([]);
  const [summaries, setSummaries] = useState<Record<string, ActorSummary>>({});
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<PeriodKey | 'all'>('last7');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountFilter>('all');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof fetchAdminAlerts>>>([]);

  const profileRole = actors.length >= 0 ? undefined : undefined; // (يُستخدم أدناه عبر useProfile)
  void profileRole;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchAllAccounts();
      setActors(all);
      if (all.length === 0) return;
      const { from, to } = getPeriodRange(range === 'all' ? 'last7' : range, new Date());
      if (range === 'all') from.setFullYear(2000);
      // نمرّر دور كل حساب كما هو: الدالة تفلتر بـ p_actor_role ولا تفهم قيمة تجميعية
      const rows = await getActorSummariesForActors(
        all.map((a) => ({ id: a.id, role: a.role })),
        { from, to },
      );
      setSummaries(rows);
    } catch (e: any) {
      toastError(typeof e === 'string' ? e : 'تعذر تحميل النشاطات');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  // بيانات المخطط العام (آخر 8 أسابيع) — تجلب مرة واحدة عند فتح الصفحة
  useEffect(() => {
    let disposed = false;
    fetchAdminAlerts({ days: CHART_DAYS, limit: 500 })
      .then((data) => {
        if (!disposed) setOverview(data);
      })
      .catch(() => {
        // المخطط العام اختياري — فشله لا يمنع القائمة
      });
    return () => {
      disposed = true;
    };
  }, []);

  const total = useMemo(() => Object.values(summaries).reduce((s, x) => s + x.total, 0), [summaries]);

  const stats = useMemo(() => {
    const list = Object.values(summaries);
    return {
      total: list.reduce((s, x) => s + x.total, 0),
      created: list.reduce((s, x) => s + x.created, 0),
      updated: list.reduce((s, x) => s + x.updated, 0),
      deleted: list.reduce((s, x) => s + x.deleted, 0),
    };
  }, [summaries]);

  const trendSeries = useMemo(
    () => buildActivityTrendSeries(overview, { weeks: CHART_WEEKS }),
    [overview],
  );
  const activeCount = useMemo(() => {
    const active = new Set<string>();
    for (const event of overview) if (event.actorId) active.add(event.actorId);
    return active.size;
  }, [overview]);

  const filtered = useMemo(
    () =>
      [...actors]
        .filter((a) => (roleFilter === 'all' ? true : a.role === roleFilter))
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
        .map((a) => ({ actor: a, s: summaries[a.id] ?? ZERO_SUMMARY }))
        .sort((a, b) => b.s.total - a.s.total),
    [actors, summaries, search, statusFilter, roleFilter],
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

      {/* بطاقات الإحصاء العامة */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
          <p className="text-[20px] font-bold text-[var(--primary)] leading-none">{stats.total}</p>
          <p className="text-[10.5px] text-[var(--text-secondary)] mt-1.5">إجمالي الأحداث</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
          <p className="text-[20px] font-bold text-[var(--green)] leading-none">{stats.created}</p>
          <p className="text-[10.5px] text-[var(--text-secondary)] mt-1.5">إضافات</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
          <p className="text-[20px] font-bold text-[var(--text)] leading-none">{stats.updated}</p>
          <p className="text-[10.5px] text-[var(--text-secondary)] mt-1.5">تعديلات</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
          <p className="text-[20px] font-bold text-[var(--error)] leading-none">{stats.deleted}</p>
          <p className="text-[10.5px] text-[var(--text-secondary)] mt-1.5">حذف</p>
        </div>
      </div>

      {/* المخطط العام + رابط الاتجاهات (للمدير) */}
      {overview.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 mb-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-[13px] font-bold text-[var(--text)] flex items-center gap-1.5">
              <CalendarRange className="w-4 h-4 text-[var(--primary)]" />
              النشاط الأسبوعي (الكل)
            </h3>
            <button
              type="button"
              onClick={() => router.reset({ name: 'activity-trends' })}
              className="flex items-center gap-1 text-[11.5px] font-semibold text-[var(--primary)] hover:underline"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              لوحة الاتجاهات
            </button>
          </div>
          <ActivityWeeklyChart series={trendSeries} height={200} />
          <p className="flex items-center justify-center gap-1.5 text-[10.5px] text-[var(--text-muted)] mt-2">
            <Users className="w-3.5 h-3.5" />
            {activeCount} مستخدماً نشطاً في آخر 8 أسابيع
          </p>
        </div>
      )}

      <div className="mb-3">
        <SearchField value={search} onChange={setSearch} placeholder="بحث عن مستخدم بالاسم أو البريد..." className="max-w-md" />
      </div>

      {/* مرشح الدور */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-2">
        {ROLE_FILTERS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setRoleFilter(value)}
            className={cn(
              'px-3 py-1.5 rounded-full border text-[12px] font-semibold transition-colors whitespace-nowrap',
              roleFilter === value
                ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--border-light)]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* مرشح الحالة */}
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
          title={search || statusFilter !== 'all' || roleFilter !== 'all' ? 'لا توجد نتائج مطابقة' : 'لا توجد نشاطات'}
          subtitle={search || statusFilter !== 'all' || roleFilter !== 'all' ? 'جرّب تعديل البحث أو المرشحات' : 'لم يتم تسجيل أي أحداث في هذه الفترة'}
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
                <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                  <div className="text-center">
                    <p className="text-[18px] font-bold text-[var(--primary)] leading-none">{s.total}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">إجمالي</p>
                  </div>
                  <div className="hidden xs:block text-center">
                    <p className="text-[18px] font-bold text-[var(--text)] leading-none">{s.stores}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">متاجر</p>
                  </div>
                  <div className="hidden sm:block text-center">
                    <p className="text-[18px] font-bold text-[var(--text)] leading-none">{s.branches}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">فروع</p>
                  </div>
                  <div className="hidden sm:block text-center">
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
