'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import {
  getActorDaily,
  getTimeline,
  getActorSummariesForActors,
  actionLabel,
} from '@/lib/data/activities';
import { periodOptions } from '@/lib/constants';
import type { ActivityEvent, ActivityEntityType, PeriodKey, UserRole } from '@/lib/types';
import { getPeriodRange, relativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { toastError } from '@/lib/toast';
import { CalendarDays, PlusCircle, PenLine, Trash2, Box, Split } from 'lucide-react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button, CenteredSpinner, Chip, EmptyState, PageHeader } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modals';

export default function UserReport({
  actorId,
  role,
  actorName,
  actorEmail,
}: {
  actorId: string;
  role: UserRole | string;
  actorName: string;
  actorEmail: string;
}) {
  const router = useRouter();
  const [range, setRange] = useState<PeriodKey>('last7');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [daily, setDaily] = useState<{ day: string; created: number; updated: number; deleted: number; total: number }[]>([]);
  const [entities, setEntities] = useState<{ stores: number; branches: number; products: number }>({ stores: 0, branches: 0, products: 0 });
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [entityFilter, setEntityFilter] = useState<ActivityEntityType | 'all'>('all');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayEvents, setDayEvents] = useState<ActivityEvent[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  const [from, to] = useMemo(() => {
    if (range === 'custom') {
      if (customFrom && customTo) {
        const f = new Date(`${customFrom}T00:00:00`);
        const t = new Date(`${customTo}T23:59:59.999`);
        return [f, t];
      }
      const f = new Date();
      f.setDate(f.getDate() - 6);
      f.setHours(0, 0, 0, 0);
      return [f, new Date()];
    }
    const { from: rf, to: rt } = getPeriodRange(range, new Date());
    return [rf, rt];
  }, [range, customFrom, customTo]);

  const loadStats = async (reloadChart: boolean) => {
    try {
      const d = await getActorDaily({ actorId, from, to, timezone: 'Asia/Damascus' });
      setDaily(d);
      // نمرّر دور صاحب التقرير الحقيقي (الـ RPC يفلتر بـ p_actor_role ولا يفهم 'all')
      const s = await getActorSummariesForActors([{ id: actorId, role }], { from, to });
      const row = s[actorId];
      setEntities({
        stores: row?.stores ?? 0,
        branches: row?.branches ?? 0,
        products: row?.products ?? 0,
      });
      if (reloadChart) {
        const ev = await getTimeline({ actorId, from, to, fromRow: 0, limit: 20 });
        setEvents(ev);
        setHasMore(ev.length === 20);
      }
    } catch (e: any) {
      toastError(typeof e === 'string' ? e : 'تعذر تحميل التقرير');
    }
  };

  useEffect(() => {
    setLoading(true);
    (async () => {
      await loadStats(true);
      setLoading(false);
    })();
  }, [range, customFrom, customTo]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const more = await getTimeline({
        actorId,
        from,
        to,
        filter: entityFilter === 'all' ? undefined : { entityType: entityFilter },
        fromRow: events.length,
        limit: 20,
      });
      setEvents((list) => [...list, ...more]);
      setHasMore(more.length === 20);
    } catch (e: any) {
      toastError(typeof e === 'string' ? e : 'تعذر تحميل المزيد');
    } finally {
      setLoadingMore(false);
    }
  };

  const setEntityFilterAll = async (f: ActivityEntityType | 'all') => {
    setEntityFilter(f);
    try {
      const ev = await getTimeline({
        actorId,
        from,
        to,
        filter: f === 'all' ? undefined : { entityType: f },
        fromRow: 0,
        limit: 20,
      });
      setEvents(ev);
      setHasMore(ev.length === 20);
    } catch (e: any) {
      toastError(typeof e === 'string' ? e : 'تعذر تحديث التصفية');
    }
  };

  const openDay = async (day: string) => {
    if (!day) return;
    setSelectedDay(day);
    setDayLoading(true);
    try {
      const f = new Date(`${day}T00:00:00`);
      const t = new Date(`${day}T23:59:59.999`);
      const ev = await getTimeline({ actorId, from: f, to: t, fromRow: 0, limit: 100 });
      setDayEvents(ev);
    } catch (e: any) {
      toastError(typeof e === 'string' ? e : 'تعذر تحميل تفاصيل اليوم');
      setDayEvents([]);
    } finally {
      setDayLoading(false);
    }
  };

  const totals = useMemo(
    () => daily.reduce((acc, d) => ({ created: acc.created + d.created, updated: acc.updated + d.updated, deleted: acc.deleted + d.deleted }), { created: 0, updated: 0, deleted: 0 }),
    [daily],
  );
  const grandTotal = totals.created + totals.updated + totals.deleted;

  const chartData = daily.map((d) => {
    const parts = d.day.split('-');
    return { ...d, label: `${parts[2]}/${parts[1]}` };
  });

  const toneForAction = (action: string): 'success' | 'primary' | 'error' =>
  action === 'created' ? 'success' : action === 'updated' ? 'primary' : 'error';

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={actorName}
        subtitle={`${actorEmail || ''} • ${role === 'manager' ? 'مدير' : role === 'merchant' ? 'تاجر' : 'موظف'}`}
        onBack={() => router.pop()}
      />

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-3">
        {periodOptions.map((p) => (
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

      {range === 'custom' && (
        <div className="flex items-center gap-2 mb-4">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="flex-1 bg-[var(--input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[13px] text-[var(--text)]"
          />
          <span className="text-[12px] text-[var(--text-muted)]">إلى</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="flex-1 bg-[var(--input)] border border-[var(--border)] rounded-xl px-3 py-2 text-[13px] text-[var(--text)]"
          />
        </div>
      )}

      {loading ? (
        <CenteredSpinner label="جاري تحميل التقرير..." />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2.5 mb-5">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
              <p className="text-[18px] font-bold text-[var(--primary)] leading-none">{grandTotal}</p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">إجمالي النشاط</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
              <p className="text-[18px] font-bold text-[var(--text)] leading-none">{totals.created}</p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">إضافات</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
              <p className="text-[18px] font-bold text-[var(--text)] leading-none">{totals.updated}</p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">تعديلات</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
              <p className="text-[18px] font-bold text-[var(--error)] leading-none">{totals.deleted}</p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">حذف</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mb-5">
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <Box className="w-4 h-4 text-[var(--primary)]" />
              <div>
                <p className="text-[14px] font-bold text-[var(--text)] leading-none">{entities.stores}</p>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">متاجر</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <Split className="w-4 h-4 text-[var(--primary)]" />
              <div>
                <p className="text-[14px] font-bold text-[var(--text)] leading-none">{entities.branches}</p>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">فروع</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <Box className="w-4 h-4 text-[var(--primary)]" />
              <div>
                <p className="text-[14px] font-bold text-[var(--text)] leading-none">{entities.products}</p>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">منتجات</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 mb-6">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[var(--primary)]" />
              <h3 className="text-[13px] font-bold text-[var(--text)]">النشاط اليومي</h3>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1 mb-3">اضغط على أحد الأعمدة لعرض أحداث ذلك اليوم</p>
            {chartData.length === 0 ? (
              <p className="text-[12px] text-[var(--text-muted)] py-6 text-center">لا توجد بيانات في هذه الفترة</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={230} dir="ltr">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'var(--surface-variant)', opacity: 0.5 }}
                      formatter={(value: any, name: any) => [`${value} حدث`, name]}
                      labelFormatter={(l) => `التاريخ: ${l}`}
                      contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12, direction: 'rtl' }}
                    />
                    <Bar dataKey="created" name="إضافة" fill="var(--green)" radius={[3, 3, 0, 0]} maxBarSize={16} className="cursor-pointer" onClick={(d: any) => openDay(d?.payload?.day)} />
                    <Bar dataKey="updated" name="تعديل" fill="var(--primary)" radius={[3, 3, 0, 0]} maxBarSize={16} className="cursor-pointer" onClick={(d: any) => openDay(d?.payload?.day)} />
                    <Bar dataKey="deleted" name="حذف" fill="var(--error)" radius={[3, 3, 0, 0]} maxBarSize={16} className="cursor-pointer" onClick={(d: any) => openDay(d?.payload?.day)} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-5 mt-3">
                  <LegendDot color="var(--green)" label="إضافة" />
                  <LegendDot color="var(--primary)" label="تعديل" />
                  <LegendDot color="var(--error)" label="حذف" />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-bold text-[var(--text)]">سجل النشاطات</h3>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {([['all', 'الكل'], ['store', 'متاجر'], ['branch', 'فروع'], ['product', 'منتجات']] as [ActivityEntityType | 'all', string][]).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setEntityFilterAll(v)}
                  className={cn(
                    'px-3 py-1 rounded-full border text-[11px] font-semibold transition-colors whitespace-nowrap',
                    entityFilter === v ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]' : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)]',
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {events.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="w-6 h-6" />}
              title="لا توجد نشاطات"
              subtitle="لم يسجل المستخدم أي أحداث في هذه الفترة"
            />
          ) : (
            <div className="space-y-2">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
                  <span className="w-9 h-9 rounded-xl bg-[var(--primary-surface-light)] text-[var(--primary)] grid place-items-center shrink-0">
                    {ev.action === 'created' ? <PlusCircle className="w-4 h-4" /> : ev.action === 'deleted' ? <Trash2 className="w-4 h-4" /> : <PenLine className="w-4 h-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-[var(--text)]">
                      {actionLabel(ev.action)}{' '}
                      <span className="font-normal text-[var(--text-secondary)]">
                        {ev.entityType === 'store' ? 'للمتجر' : ev.entityType === 'branch' ? 'للفرع' : 'للمنتج'}
                      </span>{' '}
                      «{ev.entityName || ''}»
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{relativeTime(ev.eventAt)}</p>
                  </div>
                  <Chip tone={toneForAction(ev.action)} label={actionLabel(ev.action)} />
                </div>
              ))}
              {hasMore && (
                <div className="text-center pt-1">
                  <Button variant="outline" size="sm" onClick={loadMore} loading={loadingMore}>تحميل المزيد</Button>
                </div>
              )}
            </div>
          )}

          <Modal
            open={!!selectedDay}
            onClose={() => setSelectedDay(null)}
            title={selectedDay ? `أحداث يوم ${formatDayLabel(selectedDay)}` : 'تفاصيل اليوم'}
          >
            {dayLoading ? (
              <div className="py-8 grid place-items-center">
                <span className="w-6 h-6 border-2 border-[var(--border-light)] border-t-[var(--primary)] rounded-full animate-spin" />
              </div>
            ) : dayEvents.length === 0 ? (
              <p className="text-[12px] text-[var(--text-muted)] py-6 text-center">لا توجد أحداث في هذا اليوم</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pe-1">
                {dayEvents.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <span className="w-8 h-8 rounded-lg bg-[var(--primary-surface-light)] text-[var(--primary)] grid place-items-center shrink-0">
                      {ev.action === 'created' ? <PlusCircle className="w-4 h-4" /> : ev.action === 'deleted' ? <Trash2 className="w-4 h-4" /> : <PenLine className="w-4 h-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-bold text-[var(--text)]">
                        {actionLabel(ev.action)}{' '}
                        <span className="font-normal text-[var(--text-secondary)]">
                          {ev.entityType === 'store' ? 'للمتجر' : ev.entityType === 'branch' ? 'للفرع' : 'للمنتج'}
                        </span>{' '}
                        «{ev.entityName || ''}»
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{relativeTime(ev.eventAt)}</p>
                    </div>
                    <Chip tone={toneForAction(ev.action)} label={actionLabel(ev.action)} />
                  </div>
                ))}
              </div>
            )}
          </Modal>
        </>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function formatDayLabel(day: string): string {
  return day.split('-').reverse().join('/');
}