'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchAllAccounts, adminResetPassword, updateAccountDetails, promoteEmployeeToManager } from '@/lib/data/accounts';
import type { ActorWithProfile } from '@/lib/types';
import { toastError, toastSuccess } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { cacheKey, cachedLoad } from '@/lib/cache';
import { userValidator } from '@/lib/utils';
import { KeyRound, UserRound, Store as StoreIcon, Eye, EyeOff, Pencil, ShieldCheck, ShieldOff } from 'lucide-react';
import { Avatar, Button, CenteredSpinner, Chip, EmptyState, StatCard, Toggle } from '@/components/ui/controls';
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
  const aliveRef = useRef(true);

  // تدفق إعادة تعيين كلمة المرور: نموذج بحقلين (مثل تطبيق الموبايل)
  const [target, setTarget] = useState<ActorWithProfile | null>(null);
  const [newPw, setNewPw] = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // تدفق تعديل معلومات المستخدم: الاسم والبريد وحالة التفعيل
  const [editTarget, setEditTarget] = useState<ActorWithProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editActive, setEditActive] = useState(true);

  // تدفق ترقية موظف إلى مدير
  const [promoteTarget, setPromoteTarget] = useState<ActorWithProfile | null>(null);
  const [promoteConfirmName, setPromoteConfirmName] = useState('');
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await cachedLoad(
        cacheKey('accounts', 'team-all'),
        async () => {
          const all = await fetchAllAccounts();
          return all.filter((a) => a.role !== 'manager');
        },
        (rows) => {
          if (!aliveRef.current) return;
          setAccounts(rows);
          // النسخة المخزنة تُعرض فوراً بلا سبينر، والشبكة تحدّث القائمة عند وصولها
          setLoading(false);
        },
      );
    } catch (e) {
      if (!aliveRef.current) return;
      toastError(typeof e === 'string' ? e : 'تعذر تحميل الحسابات');
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    load();
    return () => {
      aliveRef.current = false;
    };
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
    } catch (e) {
      toastError(typeof e === 'string' ? e : 'تعذر إعادة تعيين كلمة المرور');
      setConfirmOpen(false);
    } finally {
      setResetting(false);
    }
  };

  const openEdit = (acc: ActorWithProfile) => {
    setEditTarget(acc);
    setEditName(acc.fullName);
    setEditEmail(acc.email ?? '');
    setEditActive(acc.isActive);
    setEditError(null);
  };

  const closeEdit = () => {
    setEditTarget(null);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const error = userValidator(editName, editEmail);
    if (error) {
      setEditError(error);
      return;
    }
    const emailChanged = editEmail.trim().toLowerCase() !== (editTarget.email ?? '').trim().toLowerCase();
    if (emailChanged) {
      setEditError('لا يمكن تغيير البريد الإلكتروني بعد إنشاء الحساب');
      return;
    }
    const nameChanged = editName.trim() !== editTarget.fullName;
    const activeChanged = editActive !== editTarget.isActive;
    if (!nameChanged && !activeChanged) {
      closeEdit();
      return;
    }
    setEditSaving(true);
    try {
      await updateAccountDetails(editTarget.id, { fullName: editName.trim(), isActive: editActive });
      toastSuccess('تم تحديث بيانات المستخدم');
      closeEdit();
      await load();
    } catch (e) {
      toastError(typeof e === 'string' ? e : 'تعذر تحديث بيانات المستخدم');
    } finally {
      setEditSaving(false);
    }
  };

  const openPromote = (acc: ActorWithProfile) => {
    setPromoteTarget(acc);
    setPromoteConfirmName('');
    setPromoteError(null);
  };

  const closePromote = () => {
    setPromoteTarget(null);
    setPromoteError(null);
  };

  const doPromote = async () => {
    if (!promoteTarget) return;
    if (promoteConfirmName.trim() !== promoteTarget.fullName.trim()) {
      setPromoteError('اكتب اسم المستخدم بشكل صحيح للتأكيد');
      return;
    }
    setPromoting(true);
    try {
      await promoteEmployeeToManager(promoteTarget.id);
      toastSuccess(`تمت ترقية ${promoteTarget.fullName} إلى مدير`);
      closePromote();
      await load();
    } catch (e) {
      toastError(typeof e === 'string' ? e : 'تعذرت عملية الترقية');
    } finally {
      setPromoting(false);
    }
  };

  const filterBtn = (active: boolean) =>
    cn(
      'pill',
      active
        ? 'pill-on'
        : '',
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
          ['all', 'كل الحالات'],
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
            <div key={acc.id} className="card p-4">
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
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEdit(acc)} icon={<Pencil className="w-3.5 h-3.5" />}>
                    تعديل
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openReset(acc)} icon={<KeyRound className="w-4 h-4" />}>
                    كلمة المرور
                  </Button>
                  {acc.role === 'employee' && (
                    <Button variant="outline" size="sm" onClick={() => openPromote(acc)} icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                      ترقية لمدير
                    </Button>
                  )}
                </div>
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

      {/* نافذة تعديل بيانات المستخدم */}
      <Modal open={!!editTarget} onClose={closeEdit} title="تعديل بيانات المستخدم">
        {editTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
              <Avatar name={editTarget.fullName} size={40} />
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-[var(--text)] truncate">{editTarget.fullName}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <Chip tone={editTarget.role === 'merchant' ? 'primary' : 'purple'} icon={editTarget.role === 'merchant' ? <StoreIcon className="w-3 h-3" /> : undefined} label={roleLabel(editTarget.role)} />
                  <Chip tone={editTarget.isActive ? 'success' : 'neutral'} label={editTarget.isActive ? 'نشط' : 'معطّل'} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">الاسم الكامل *</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  setEditError(null);
                }}
                autoFocus
                className="w-full px-3.5 py-2.5 bg-[var(--input)] border border-[var(--border)] rounded-xl text-[13px] focus:border-[var(--primary)]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">البريد الإلكتروني</label>
              <input
                type="email"
                value={editEmail}
                disabled
                dir="ltr"
                className="w-full px-3.5 py-2.5 bg-[var(--surface-variant)] border border-[var(--border)] rounded-xl text-[13px] text-left opacity-70 cursor-not-allowed"
              />
              <p className="text-[11px] text-[var(--text-muted)] mt-1">البريد الإلكتروني لا يمكن تغييره بعد إنشاء الحساب</p>
            </div>

            <div className="flex items-center justify-between card rounded-[12px] px-3.5 py-3">
              <div>
                <p className="text-[13px] font-semibold text-[var(--text)]">حالة الحساب</p>
                <p className="text-[11px] text-[var(--text-secondary)]">تعطيل الحساب يمنع صاحبه من تسجيل الدخول</p>
              </div>
              <Toggle size="sm" checked={editActive} onChange={setEditActive} />
            </div>

            {editError && <p className="text-[12px] font-semibold text-[var(--error)]">{editError}</p>}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={closeEdit} disabled={editSaving}>إلغاء</Button>
              <Button onClick={saveEdit} loading={editSaving}>حفظ التعديلات</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* نافذة ترقية موظف إلى مدير */}
      <Modal open={!!promoteTarget} onClose={closePromote} title="ترقية إلى مدير">
        {promoteTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
              <Avatar name={promoteTarget.fullName} size={40} />
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-[var(--text)] truncate">{promoteTarget.fullName}</p>
                <p className="text-[11px] text-[var(--text-secondary)] truncate" dir="ltr">{promoteTarget.email || '—'}</p>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--warning)]/40 bg-[var(--warning-surface)] p-3">
              <p className="text-[12px] font-semibold text-[var(--warning)] flex items-center gap-1.5 mb-1">
                <ShieldOff className="w-3.5 h-3.5" />
                عملية حساسة
              </p>
              <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                سيصبح «{promoteTarget.fullName}» مديراً بصلاحيات كاملة على كل المتاجر والفروع والمنتجات
                والحسابات والتنبيهات والنسخ الاحتياطي، ولن يظهر ضمن قائمة الموظفين بعدها.
              </p>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">
                اكتب اسم المستخدم للتأكيد: <span className="text-[var(--error)]">{promoteTarget.fullName}</span>
              </label>
              <input
                type="text"
                value={promoteConfirmName}
                onChange={(e) => {
                  setPromoteConfirmName(e.target.value);
                  setPromoteError(null);
                }}
                autoFocus
                className="w-full px-3.5 py-2.5 bg-[var(--input)] border border-[var(--border)] rounded-xl text-[13px] focus:border-[var(--primary)]"
              />
            </div>

            {promoteError && <p className="text-[12px] font-semibold text-[var(--error)]">{promoteError}</p>}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={closePromote} disabled={promoting}>إلغاء</Button>
              <Button
                onClick={doPromote}
                loading={promoting}
                disabled={promoteConfirmName.trim() !== promoteTarget.fullName.trim()}
              >
                تأكيد الترقية
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
