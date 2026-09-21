'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import {
  fetchAccounts,
  fetchAllAccountsByRole,
  updateAccountActive,
  updateAccountPermissions,
} from '@/lib/data/accounts';
import { accountFilterOptions } from '@/lib/constants';
import type { ActorWithProfile, AccountFilter, UserRole } from '@/lib/types';
import { PAGE_SIZE } from '@/lib/data/base';
import { toastError, toastSuccess } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { Plus, User as UserIcon, ShieldCheck, Power, Shield } from 'lucide-react';
import { Avatar, Button, CenteredSpinner, Chip, EmptyState, PaginationFooter, StatCard, Toggle } from '@/components/ui/controls';
import { SearchField } from '@/components/ui/fields';
import { ConfirmDialog, Modal } from '@/components/ui/modals';
import { PermissionRow } from '@/components/ui/accountUtils';
import AddAccountDialog from './AddAccountDialog';

export default function AccountListPage({ role }: { role: 'employee' | 'merchant' }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<ActorWithProfile[]>([]);
  const [stats, setStats] = useState<{ total: number; active: number; withPermissions: number }>({ total: 0, active: 0, withPermissions: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AccountFilter>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const queryRef = useRef('');
  const [addOpen, setAddOpen] = useState(false);
  const [target, setTarget] = useState<ActorWithProfile | null>(null);
  const [permTarget, setPermTarget] = useState<ActorWithProfile | null>(null);
  const [permEdit, setPermEdit] = useState(false);
  const [permDelete, setPermDelete] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [permUnlock, setPermUnlock] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const title = role === 'merchant' ? 'التجار' : 'الموظفون';
  const label = role === 'merchant' ? 'تاجر' : 'موظف';

  const loadStats = useCallback(async () => {
    try {
      const all = await fetchAllAccountsByRole(role);
      setStats({
        total: all.length,
        active: all.filter((a) => a.isActive).length,
        withPermissions: all.filter((a) => a.canEdit || a.canDelete).length,
      });
    } catch {
      // تجاهل
    }
  }, [role]);

  const load = useCallback(
    async (q: string, pg: number, f: AccountFilter) => {
      setLoading(true);
      try {
        const res = await fetchAccounts({ page: pg, pageSize: PAGE_SIZE, role, search: q, filter: f });
        setAccounts(res.items);
        setHasMore(res.hasMore);
        setPage(pg);
      } catch (e: any) {
        toastError(typeof e === 'string' ? e : 'تعذر تحميل الحسابات');
      } finally {
        setLoading(false);
      }
    },
    [role],
  );

  useEffect(() => {
    loadStats();
    load('', 0, 'all');
  }, [load, loadStats]);

  useEffect(() => {
    const t = setTimeout(() => {
      const q = search.trim();
      if (q !== queryRef.current) {
        queryRef.current = q;
        load(q, 0, filter);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [search, load, filter]);

  const sorted = useMemo(
    () => [...accounts].sort((a, b) => (a.isActive === b.isActive ? a.fullName.localeCompare(b.fullName, 'ar') : a.isActive ? -1 : 1)),
    [accounts],
  );

  const applyActive = async (acc: ActorWithProfile, active: boolean) => {
    setBusyId(acc.id);
    const prev = accounts;
    setAccounts((list) => list.map((x) => (x.id === acc.id ? { ...x, isActive: active } : x)));
    try {
      await updateAccountActive(acc.id, active);
      toastSuccess(active ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب');
      loadStats();
    } catch (e: any) {
      setAccounts(prev);
      toastError(typeof e === 'string' ? e : 'تعذر تحديث الحالة');
    } finally {
      setBusyId(null);
      setTarget(null);
    }
  };

  const openPermissions = (acc: ActorWithProfile) => {
    setPermTarget(acc);
    setPermEdit(acc.canEdit);
    setPermDelete(acc.canDelete);
    setPermUnlock(false);
  };

  const applyPermissions = async () => {
    if (!permTarget) return;
    if (permDelete && !permUnlock) {
      setPermUnlock(true);
      return;
    }
    if (!permDelete && permUnlock) {
      // أُلغي وضع التأكيد
    }
    setPermSaving(true);
    const prev = accounts;
    setAccounts((list) => list.map((x) => (x.id === permTarget.id ? { ...x, canEdit: permEdit, canDelete: permDelete } : x)));
    try {
      await updateAccountPermissions(permTarget.id, permEdit, permDelete);
      toastSuccess('تم تحديث الصلاحيات');
      setPermTarget(null);
      setPermUnlock(false);
      loadStats();
    } catch (e: any) {
      setAccounts(prev);
      toastError(typeof e === 'string' ? e : 'تعذر تحديث الصلاحيات');
    } finally {
      setPermSaving(false);
    }
  };

  const goToReport = (acc: ActorWithProfile) => {
    router.push({ name: 'user-report', actorId: acc.id, role: acc.role, actorName: acc.fullName, actorEmail: acc.email });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text)]">{title}</h1>
          <p className="text-[12px] text-[var(--text-secondary)]">إدارة حسابات {label} والصلاحيات</p>
        </div>
        <Button onClick={() => setAddOpen(true)} icon={<Plus className="w-4 h-4" />}>
          إضافة {label}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="الإجمالي" value={stats.total} />
        <StatCard label="نشط" value={stats.active} tint="success" />
        <StatCard label="بصلاحيات" value={stats.withPermissions} tint="purple" />
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <SearchField value={search} onChange={setSearch} placeholder={`بحث عن ${label} بالاسم أو البريد...`} className="flex-1 min-w-[200px]" />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-4">
        {accountFilterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={cn(
              'px-3 py-1.5 rounded-full border text-[12px] font-semibold transition-colors whitespace-nowrap',
              filter === opt.value
                ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--border-light)]',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading && page === 0 ? (
        <CenteredSpinner label={`جاري تحميل ${title}...`} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<UserIcon className="w-6 h-6" />}
          title={search ? 'لا توجد نتائج مطابقة' : `لا يوجد ${label} بعد`}
          subtitle={search ? 'جرّب كلمات بحث مختلفة' : `استخدم زر إضافة ${label} للبدء`}
        />
      ) : (
        <>
          <div className="space-y-2.5">
            {sorted.map((acc) => (
              <div key={acc.id} className={cn('rounded-2xl border bg-[var(--surface)] p-4', acc.isActive ? 'border-[var(--border)]' : 'border-[var(--border)] opacity-80')}>
                <div className="flex items-center gap-3">
                  <Avatar name={acc.fullName} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-[var(--text)] truncate">{acc.fullName}</p>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate" dir="ltr">
                      {acc.email || '—'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Chip tone={acc.isActive ? 'success' : 'neutral'} label={acc.isActive ? 'نشط' : 'معطّل'} />
                      {(acc.canEdit || acc.canDelete) && <Chip tone="purple" icon={<Shield className="w-3 h-3" />} label="صلاحيات" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => goToReport(acc)}>
                      التقارير
                    </Button>
                    <Button variant="surface" size="sm" onClick={() => openPermissions(acc)} icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                      الصلاحيات
                    </Button>
                    {busyId === acc.id ? (
                      <span className="w-8 h-8 grid place-items-center"><span className="w-4 h-4 border-2 border-[var(--border-light)] border-t-[var(--primary)] rounded-full animate-spin" /></span>
                    ) : (
                      <Toggle size="sm" checked={acc.isActive} onChange={() => setTarget(acc)} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <PaginationFooter
            page={page}
            hasMore={hasMore}
            onPrev={() => load(search.trim(), page - 1, filter)}
            onNext={() => load(search.trim(), page + 1, filter)}
          />
        </>
      )}

      <AddAccountDialog open={addOpen} onClose={() => setAddOpen(false)} role={role} onCreated={() => { loadStats(); load(queryRef.current, 0, filter); }} />

      <ConfirmDialog
        open={!!target}
        title="تغيير حالة الحساب"
        confirmText={target?.isActive ? 'تعطيل' : 'تفعيل'}
        tone={target?.isActive ? 'danger' : 'primary'}
        loading={busyId === target?.id}
        onClose={() => setTarget(null)}
        onConfirm={() => {
          if (target) applyActive(target, !target.isActive);
        }}
      >
        <p className="text-[13px] text-[var(--text-secondary)]">
          {target?.isActive
            ? `سيتم تعطيل حساب «${target.fullName}» ولن يتمكن من تسجيل الدخول.`
            : `سيتم تفعيل حساب «${target?.fullName}» والعودة للسماح له بتسجيل الدخول.`}
        </p>
      </ConfirmDialog>

      <Modal open={!!permTarget} onClose={() => setPermTarget(null)} title="إدارة الصلاحيات" footer={<></>}>
        {permTarget && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
              <Avatar name={permTarget.fullName} size={40} />
              <div>
                <p className="text-[14px] font-bold text-[var(--text)]">{permTarget.fullName}</p>
                <Chip tone={permTarget.isActive ? 'success' : 'neutral'} label={permTarget.isActive ? 'نشط' : 'معطّل'} />
              </div>
            </div>
            <PermissionRow
              title="السماح بالتعديل"
              description="إتاحة إضافة وتعديل المتاجر والفروع والمنتجات"
              checked={permEdit}
              disabled={!permTarget.isActive || permSaving}
              onChange={setPermEdit}
            />
            <PermissionRow
              title="السماح بالحذف"
              description="إتاحة حذف المتاجر والفروع والمنتجات"
              danger
              checked={permDelete}
              disabled={!permTarget.isActive || permSaving}
              onChange={setPermDelete}
            />
            {permTarget.isActive === false && (
              <p className="text-[11px] text-[var(--text-muted)]">الحساب معطّل، فعّله أولاً لتعديل الصلاحيات.</p>
            )}
            {permDelete && !permUnlock && permTarget.isActive && (
              <p className="text-[12px] font-semibold text-[var(--warning)] flex items-center gap-1.5">
                <Power className="w-3.5 h-3.5" />
                منح صلاحية الحذف يُعدّ إجراءً حساساً اضغط مرة أخرى للتأكيد.
              </p>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setPermTarget(null)} disabled={permSaving}>إلغاء</Button>
              <Button onClick={applyPermissions} loading={permSaving}>
                {permDelete && !permUnlock ? 'تأكيد منح الحذف' : 'حفظ الصلاحيات'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}