'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAllAccounts, adminResetPassword } from '@/lib/data/accounts';
import type { ActorWithProfile, UserRole } from '@/lib/types';
import { toastError, toastSuccess } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { KeyRound, UserRound, Store as StoreIcon, Eye, EyeOff } from 'lucide-react';
import { Avatar, Button, CenteredSpinner, Chip, EmptyState, StatCard } from '@/components/ui/controls';
import { SearchField } from '@/components/ui/fields';
import { ConfirmDialog, Modal } from '@/components/ui/modals';

type RoleFilter = 'all' | 'employee' | 'merchant';
type StatusFilter = 'all' | 'active' | 'disabled';

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<ActorWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // تدفق إعادة تعيين كلمة المرور: نموذج بحقلين (مثل تطبيق الموبايل)
  const [target, setTarget] = useState<ActorWithProfile | null>(null);
  const [newPw, setNewPw] = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchAllAccounts();
      setAccounts(all.filter((a) => a.role !== 'manager'));
    } catch (e: any) {
      toastError(typeof e === 'string' ? e : 'تعذر تحميل الحسابات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts
      .filter((a) =>
        q
          ? a.fullName.toLowerCase().includes(q) ||
            (a.email ?? '').toLowerCase().includes(q)
          : true,
      )
      .filter((a) => (roleFilter === 'all' ? true : a.role === roleFilter))
      .filter((a) =>
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? a.isActive
            : !a.isActive,
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
  }, [accounts, search, roleFilter, statusFilter]);

  const stats = useMemo(
    () => ({
      total: accounts.length,
      merchants: accounts.filter((a) => a.role === 'merchant').length,
      employees: accounts.filter((a) => a.role === 'employee').length,
    }),
    [accounts],
  );

  const roleLabel = (r: string) => (r === 'merchant' ? 'تاجر' : 'موظف');

  const openReset = (acc: ActorWithProfile) => {
    setTarget(acc);
    setNewPw('');
    setNewPwConfirm('');
    setShowPw(false);
    setShowPwConfirm(false);
    setPwError(null);
    setConfirmOpen(false);
  };

  const closeReset = () => {
    setTarget(null);
    setConfirmOpen(false);
  };

  const validatePw = (): string | null => {
    if (newPw.length < 8) return 'كلمة المرور يجب أن تكون 8 محارف على الأقل';
    if (newPw.length > 128) return 'كلمة المرور يجب ألا تتجاوز 128 محرفاً';
    if (newPw !== newPwConfirm) return 'كلمتا المرور غير متطابقتين';
    return null;
  };

  const submitPw = () => {
    const v = validatePw();
    if (v) {
      setPwError(v);
      return;
    }
    setPwError(null);
    setConfirmOpen(true);
  };

  const doReset = async () => {
    if (!target) return;
    setResetting(true);
    try {
      await adminResetPassword(target.id, newPw);
      toastSuccess('تم تغيير كلمة مرور المستخدم بنجاح');
      closeReset();
    } catch (e: any) {
      toastError(typeof e === 'string' ? e : 'تعذر إعادة تعيين كلمة المرور');
      setConfirmOpen(false);
    } finally {
      setResetting(false);
    }
  };

  const filterBtn = (active: boolean) =>
    cn(
      'px-3 py-1.5 rounded-full border text-[12px] font-semibold transition-colors whitespace-nowrap',
      active
        ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]'
        : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--border-light)]',
    );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <h1 className="text-[18px] font-bold text-[var(--text)]">حسابات الفريق</h1>
        <p className="text-[12px] text-[var(--text-secondary)]">إدارة الموظفين والتجار وإعادة تعيين كلمات المرور</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="الإجمالي" value={stats.total} />
        <StatCard label="التجار" value={stats.merchants} tint="primary" />
        <StatCard label="الموظفون" value={stats.employees} tint="purple" />
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <SearchField value={search} onChange={setSearch} placeholder="بحث بالاسم أو البريد..." className="flex-1 min-w-[200px]" />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-3">
        {([
          ['all', 'الكل'],
          ['employee', 'موظفون'],
          ['merchant', 'تجار'],
        ] as [RoleFilter, string][]).map(([v, l]) => (
          <button key={v} onClick={() => setRoleFilter(v)} className={filterBtn(roleFilter === v)}>
            {l}
          </button>
        ))}
        <span className="w-px h-5 bg-[var(--border)] mx-1" />
        {([
          ['all', 'الكل الحالات'],
          ['active', 'نشط'],
          ['disabled', 'معطّل'],
        ] as [StatusFilter, string][]).map(([v, l]) => (
          <button key={v} onClick={() => setStatusFilter(v)} className={filterBtn(statusFilter === v)}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <CenteredSpinner label="جاري تحميل الحسابات..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UserRound className="w-6 h-6" />}
          title={search ? 'لا توجد نتائج مطابقة' : 'لا توجد حسابات بعد'}
          subtitle="لا يوجد موظفون أو تجار لاستعراضهم"
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((acc) => (
            <div key={acc.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center gap-3">
                <Avatar name={acc.fullName} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[var(--text)] truncate">{acc.fullName}</p>
                  <p className="text-[11px] text-[var(--text-secondary)] truncate" dir="ltr">
                    {acc.email || '—'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <Chip tone={acc.role === 'merchant' ? 'primary' : 'purple'} icon={acc.role === 'merchant' ? <StoreIcon className="w-3 h-3" /> : undefined} label={roleLabel(acc.role)} />
                    <Chip tone={acc.isActive ? 'success' : 'neutral'} label={acc.isActive ? 'نشط' : 'معطّل'} />
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => openReset(acc)} icon={<KeyRound className="w-4 h-4" />}>
                  إعادة تعيين كلمة المرور
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* نموذج إعادة تعيين كلمة المرور */}
      <Modal open={!!target} onClose={closeReset} title="تغيير كلمة المرور">
        {target && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
              <Avatar name={target.fullName} size={40} />
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-[var(--text)] truncate">{target.fullName}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <Chip tone={target.role === 'merchant' ? 'primary' : 'purple'} icon={target.role === 'merchant' ? <StoreIcon className="w-3 h-3" /> : undefined} label={roleLabel(target.role)} />
                  <Chip tone={target.isActive ? 'success' : 'neutral'} label={target.isActive ? 'نشط' : 'معطّل'} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">
                كلمة المرور الجديدة <span className="text-[var(--error)]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => {
                    setNewPw(e.target.value);
                    setPwError(null);
                  }}
                  placeholder="8 محارف على الأقل"
                  dir="ltr"
                  autoFocus
                  className="w-full pe-10 ps-3.5 py-2.5 bg-[var(--input)] border border-[var(--border)] rounded-xl text-[13px] text-left focus:border-[var(--primary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">
                تأكيد كلمة المرور <span className="text-[var(--error)]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPwConfirm ? 'text' : 'password'}
                  value={newPwConfirm}
                  onChange={(e) => {
                    setNewPwConfirm(e.target.value);
                    setPwError(null);
                  }}
                  placeholder="أعد كتابة كلمة المرور"
                  dir="ltr"
                  className="w-full pe-10 ps-3.5 py-2.5 bg-[var(--input)] border border-[var(--border)] rounded-xl text-[13px] text-left focus:border-[var(--primary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPwConfirm(!showPwConfirm)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  {showPwConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {pwError && <p className="text-[12px] font-semibold text-[var(--error)]">{pwError}</p>}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={closeReset} disabled={resetting}>
                إلغاء
              </Button>
              <Button onClick={submitPw} disabled={resetting || !newPw || !newPwConfirm}>
                تغيير كلمة المرور
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="تغيير كلمة المرور"
        confirmText="تأكيد"
        loading={resetting}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doReset}
      >
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
          هل أنت متأكد من تغيير كلمة مرور «{target?.fullName}»؟
          <br />
          بعد التأكيد ستصبح كلمة المرور الجديدة فعالة مباشرة.
        </p>
      </ConfirmDialog>
    </div>
  );
}
