'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useProfile } from '@/components/ProfileContext';
import { useRouter } from '@/components/RouterContext';
import { signOut } from '@/lib/supabase';
import { updateProfileName, changePasswordForm } from '@/lib/data/profiles';
import { countAllStores } from '@/lib/data/stores';
import { countAllProducts } from '@/lib/data/products';
import { roleLabels } from '@/lib/constants';
import { nameValidator } from '@/lib/utils';
import { toastError, toastSuccess } from '@/lib/toast';
import { Avatar, Button, Chip, PageHeader, StatCard, Toggle } from '@/components/ui/controls';
import { Modal, ConfirmDialog } from '@/components/ui/modals';
import { TextField } from '@/components/ui/fields';
import { useTheme } from '@/components/ThemeProvider';
import { useInstall, isStandalone } from '@/components/pwa/useInstall';
import NotificationPrefsCard from '@/components/notifications/NotificationPrefsCard';
import { LogOut, Pencil, Shield, ShieldCheck, FileText, Store, Package, User as UserIcon, Download, Smartphone, HardDriveDownload } from 'lucide-react';

function subscribeDisplayMode(onChange: () => void): () => void {
  const mq = window.matchMedia('(display-mode: standalone)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** معرفات متاجر التاجر — للحد من عدّاد منتجاته بمتاجره فقط */
async function fetchOwnStoreIds(profileId: string): Promise<string[]> {
  const { fetchStores } = await import('@/lib/data/stores');
  const res = await fetchStores({ page: 0, pageSize: 200, createdBy: profileId });
  return res.items.map((s) => s.id);
}

export default function ProfilePage() {
  const profile = useProfile();
  const router = useRouter();
  const theme = useTheme();
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(profile.fullName);
  // عرض فوري للاسم الجديد حتى قبل وصول تحديث البروفايل عبر السياق/الـ realtime
  const [displayName, setDisplayName] = useState(profile.fullName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { canInstall, install } = useInstall();
  const standalone = useSyncExternalStore(subscribeDisplayMode, isStandalone, () => false);
  const isMerchant = profile.role === 'merchant';

  // الإجماليات الكلية للمتاجر والمنتجات — للمدير الكل، وللتاجر متاجره فقط
  const [totals, setTotals] = useState<{ stores: number | null; products: number | null }>({ stores: null, products: null });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, p] = await Promise.all([
          countAllStores({ createdBy: isMerchant ? profile.id : undefined }),
          countAllProducts({ storeIds: isMerchant ? await fetchOwnStoreIds(profile.id) : undefined }),
        ]);
        if (cancelled) return;
        setTotals({ stores: s, products: p });
      } catch {
        if (!cancelled) setTotals({ stores: null, products: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isMerchant, profile.id]);

  // تزامن العرض مع البروفايل القادم من السياق (بعد الحفظ أو التعديل من صفحة الحسابات)
  const [syncedName, setSyncedName] = useState(profile.fullName);
  if (syncedName !== profile.fullName) {
    setSyncedName(profile.fullName);
    setDisplayName(profile.fullName);
  }

  const openNameEditor = () => {
    setName(profile.fullName);
    setNameError(null);
    setEditName(true);
  };

  const submitName = async () => {
    const error = nameValidator(name);
    if (error) {
      setNameError(error);
      return;
    }
    const trimmed = name.trim();
    if (trimmed === profile.fullName) {
      setEditName(false);
      return;
    }
    setSavingName(true);
    try {
      await updateProfileName(profile.id, trimmed);
      setDisplayName(trimmed);
      setEditName(false);
      toastSuccess('تم تحديث الاسم');
    } catch (e) {
      toastError(typeof e === 'string' ? e : 'تعذر تحديث الاسم');
    } finally {
      setSavingName(false);
    }
  };

  const submitPassword = async () => {
    setPwError(null);
    if (newPassword.length < 8) {
      setPwError('كلمة المرور الجديدة يجب أن تكون 8 محارف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('كلمتا المرور غير متطابقتين');
      return;
    }
    setSavingPw(true);
    try {
      await changePasswordForm(oldPassword, newPassword);
      toastSuccess('تم تغيير كلمة المرور');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      setPwError(typeof e === 'string' ? e : 'تعذر تغيير كلمة المرور');
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="الملف الشخصي" />

      <div className="flex items-center gap-4 card p-5 mb-5">
        <Avatar name={displayName} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[16px] font-bold text-[var(--text)] truncate">{displayName}</p>
            {profile.role === 'manager' && (
              <button
                type="button"
                onClick={openNameEditor}
                title="تعديل الاسم"
                className="grid place-items-center w-7 h-7 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] flex items-center gap-1">
            <UserIcon className="w-3.5 h-3.5" /> {roleLabels[profile.role]}
          </p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {(profile.canEdit || profile.canDelete) && (
              <Chip tone="purple" icon={<Shield className="w-3 h-3" />} label="صلاحيات ضمن المتجر" />
            )}
            {profile.isActive === false && <Chip tone="neutral" label="الحساب معطّل" />}
          </div>
        </div>
      </div>

      {profile.isActive === false && (
        <div className="rounded-2xl border border-[var(--warning)] bg-[var(--warning-surface)] text-[var(--warning)] p-3.5 text-[12px] font-semibold mb-5">
          تم تعطيل حسابك من قبل الإدارة. لن تتمكن من إجراء أي تعديلات.
        </div>
      )}

      <h3 className="text-[13px] font-bold text-[var(--text)] mb-2">إحصائيات عامة</h3>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="المتاجر الكلي" value={totals.stores ?? '…'} icon={<Store className="w-4 h-4" />} tint="accent" />
        <StatCard label="المنتجات الكلي" value={totals.products ?? '…'} icon={<Package className="w-4 h-4" />} tint="purple" />
      </div>

      <h3 className="text-[13px] font-bold text-[var(--text)] mb-2">المظهر</h3>
      <div className="flex items-center justify-between card px-4 py-3.5 mb-6">
        <div>
          <p className="text-[13px] font-semibold text-[var(--text)]">الوضع الليلي</p>
          <p className="text-[11px] text-[var(--text-secondary)]">تفعيل الألوان الداكنة</p>
        </div>
        <Toggle checked={theme.theme === 'dark'} onChange={() => theme.toggle()} />
      </div>

      <h3 className="text-[13px] font-bold text-[var(--text)] mb-2">السياسات</h3>
      <div className="grid grid-cols-1 gap-2.5 mb-6">
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="card p-3.5 flex items-center gap-3 hover:border-[var(--border-light)] transition-colors"
        >
          <span className="w-9 h-9 rounded-xl bg-[var(--primary-surface-light)] text-[var(--primary)] grid place-items-center"><FileText className="w-4 h-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-[var(--text)]">شروط الاستخدام</span>
            <span className="block text-[11px] text-[var(--text-secondary)]">الأحكام المنظّمة لاستخدام المنصة</span>
          </span>
          <span aria-hidden="true" className="text-[var(--text-muted)]">↗</span>
        </a>
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="card p-3.5 flex items-center gap-3 hover:border-[var(--border-light)] transition-colors"
        >
          <span className="w-9 h-9 rounded-xl bg-[var(--primary-surface-light)] text-[var(--primary)] grid place-items-center"><ShieldCheck className="w-4 h-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-[var(--text)]">سياسة الخصوصية</span>
            <span className="block text-[11px] text-[var(--text-secondary)]">كيف نتعامل مع بياناتك ونحميها</span>
          </span>
          <span aria-hidden="true" className="text-[var(--text-muted)]">↗</span>
        </a>
      </div>

      {!standalone && (
        <div className="flex items-center justify-between card px-4 py-3.5 mb-6">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-[var(--primary-surface-light)] text-[var(--primary)]">
              <Smartphone className="w-4 h-4" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-[var(--text)]">تثبيت التطبيق</p>
              <p className="text-[11px] text-[var(--text-secondary)]">أضف متجر تراك إلى شاشتك الرئيسية</p>
            </div>
          </div>
          {canInstall ? (
            <Button size="sm" onClick={() => install()} icon={<Download className="w-4 h-4" />}>
              تثبيت
            </Button>
          ) : (
            <p className="text-[11px] text-[var(--text-muted)] max-w-[180px] text-end">
              افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»
            </p>
          )}
        </div>
      )}

      {profile.role === 'manager' && (
        <>
          <h3 className="text-[13px] font-bold text-[var(--text)] mb-2">التنبيهات</h3>
          <div className="mb-6">
            <NotificationPrefsCard />
          </div>

          <h3 className="text-[13px] font-bold text-[var(--text)] mb-2">لوحة الإدارة</h3>
          <div className="grid grid-cols-1 gap-2.5 mb-6">
            <button onClick={() => router.push({ name: 'employees' })} className="card p-3.5 flex items-center gap-3 hover:border-[var(--border-light)] transition-colors">
              <span className="w-9 h-9 rounded-xl bg-[var(--primary-surface-light)] text-[var(--primary)] grid place-items-center"><UserIcon className="w-4 h-4" /></span>
              <span className="text-[13px] font-bold text-[var(--text)]">إدارة الموظفين</span>
            </button>
            <button onClick={() => router.push({ name: 'merchants' })} className="card p-3.5 flex items-center gap-3 hover:border-[var(--border-light)] transition-colors">
              <span className="w-9 h-9 rounded-xl bg-[var(--primary-surface-light)] text-[var(--primary)] grid place-items-center"><UserIcon className="w-4 h-4" /></span>
              <span className="text-[13px] font-bold text-[var(--text)]">إدارة التجار</span>
            </button>
            <button onClick={() => router.push({ name: 'accounts' })} className="card p-3.5 flex items-center gap-3 hover:border-[var(--border-light)] transition-colors">
              <span className="w-9 h-9 rounded-xl bg-[var(--primary-surface-light)] text-[var(--primary)] grid place-items-center"><Shield className="w-4 h-4" /></span>
              <span className="text-[13px] font-bold text-[var(--text)]">حسابات الفريق (إعادة تعيين كلمات المرور)</span>
            </button>
            <button onClick={() => router.push({ name: 'backup' })} className="card p-3.5 flex items-center gap-3 hover:border-[var(--border-light)] transition-colors">
              <span className="w-9 h-9 rounded-xl bg-[var(--primary-surface-light)] text-[var(--primary)] grid place-items-center"><HardDriveDownload className="w-4 h-4" /></span>
              <span className="text-[13px] font-bold text-[var(--text)]">النسخ الاحتياطي (تصدير البيانات)</span>
            </button>
          </div>
        </>
      )}

      <h3 className="text-[13px] font-bold text-[var(--text)] mb-2">تغيير كلمة المرور</h3>
      <div className="card p-4 space-y-3 mb-6">
        <TextField label="كلمة المرور الحالية" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="••••••••" />
        <TextField label="كلمة المرور الجديدة" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="8 محارف على الأقل" />
        <TextField label="تأكيد كلمة المرور" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" error={pwError} />
        <div className="flex justify-end">
          <Button onClick={submitPassword} loading={savingPw}>تغيير كلمة المرور</Button>
        </div>
      </div>

      <Button variant="danger" className="w-full mb-6" onClick={() => setConfirmLogout(true)} icon={<LogOut className="w-4 h-4" />}>
        تسجيل الخروج
      </Button>

      <Modal open={editName} onClose={() => setEditName(false)} title="تعديل الاسم">
        <div className="space-y-4">
          <TextField
            label="الاسم الكامل"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
            error={nameError ?? undefined}
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditName(false)} disabled={savingName}>إلغاء</Button>
            <Button onClick={submitName} loading={savingName}>حفظ</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmLogout}
        title="تسجيل الخروج"
        confirmText="خروج"
        tone="danger"
        onClose={() => setConfirmLogout(false)}
        onConfirm={async () => {
          await signOut();
          window.location.href = '/';
        }}
      >
        <p className="text-[13px] text-[var(--text-secondary)]">هل أنت متأكد من تسجيل الخروج؟</p>
      </ConfirmDialog>
    </div>
  );
}