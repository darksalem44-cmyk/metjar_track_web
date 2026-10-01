'use client';

import { useEffect, useState } from 'react';
import { adminResetPassword } from '@/lib/data/accounts';
import type { ActorWithProfile } from '@/lib/types';
import { toastError, toastSuccess } from '@/lib/toast';
import { Eye, EyeOff, Power, Store as StoreIcon } from 'lucide-react';
import { Avatar, Button, Chip } from '@/components/ui/controls';
import { ConfirmDialog, Modal } from '@/components/ui/modals';

/**
 * نافذة تغيير كلمة مرور مستخدم (موظف/تاجر) — مشتركة بين صفحة
 * «حسابات الفريق» وصفحتي «الموظفون» و«التجار».
 *
 * الخادم (edge function) يرفض تغيير كلمة مرور الحساب المعطّل، لذا نمنع
 * الإرسال مبكراً مع تنبيه واضح داخل النافذة بدل إظهار خطأ الخادم بعد المحاولة.
 */
export default function PasswordResetDialog({
  target,
  onClose,
}: {
  target: ActorWithProfile | null;
  onClose: () => void;
}) {
  const [newPw, setNewPw] = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const open = !!target;

  // تصفير الحقول عند كل فتح للنافذة (أو تغيير المستخدم المستهدف)
  useEffect(() => {
    if (open) {
      setNewPw('');
      setNewPwConfirm('');
      setShowPw(false);
      setShowPwConfirm(false);
      setPwError(null);
      setConfirmOpen(false);
    }
  }, [open, target?.id]);

  // إغلاق نافذة التأكيد تلقائياً عند إغلاق النافذة الرئيسية
  useEffect(() => {
    if (!open) setConfirmOpen(false);
  }, [open]);

  if (!target) return null;

  const disabledAccount = target.isActive === false;
  const roleLabelText = target.role === 'merchant' ? 'تاجر' : 'موظف';

  const validatePw = (): string | null => {
    if (newPw.length < 8) return 'كلمة المرور يجب أن تكون 8 محارف على الأقل';
    if (newPw.length > 128) return 'كلمة المرور يجب ألا تتجاوز 128 محرفاً';
    if (newPw !== newPwConfirm) return 'كلمتا المرور غير متطابقتين';
    return null;
  };

  const submitPw = () => {
    if (disabledAccount) return;
    const v = validatePw();
    if (v) {
      setPwError(v);
      return;
    }
    setPwError(null);
    setConfirmOpen(true);
  };

  const doReset = async () => {
    setResetting(true);
    try {
      await adminResetPassword(target.id, newPw);
      toastSuccess('تم تغيير كلمة مرور المستخدم بنجاح');
      setConfirmOpen(false);
      onClose();
    } catch (e) {
      toastError(typeof e === 'string' ? e : 'تعذر إعادة تعيين كلمة المرور');
      setConfirmOpen(false);
    } finally {
      setResetting(false);
    }
  };

  const inputClass =
    'w-full pe-10 ps-3.5 py-2.5 bg-[var(--input)] border border-[var(--border)] rounded-xl text-[13px] text-left focus:border-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <>
      <Modal open={open} onClose={onClose} title="تغيير كلمة المرور">
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
            <Avatar name={target.fullName} size={40} />
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-[var(--text)] truncate">{target.fullName}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <Chip tone={target.role === 'merchant' ? 'primary' : 'purple'} icon={target.role === 'merchant' ? <StoreIcon className="w-3 h-3" /> : undefined} label={roleLabelText} />
                <Chip tone={target.isActive ? 'success' : 'neutral'} label={target.isActive ? 'نشط' : 'معطّل'} />
              </div>
            </div>
          </div>

          {disabledAccount && (
            <div className="rounded-xl border border-[var(--warning)]/40 bg-[var(--warning-surface)] p-3 text-[12px] font-semibold text-[var(--warning)] flex items-start gap-2">
              <Power className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>هذا الحساب معطّل حالياً ولا يمكن تغيير كلمة مروره. فعّله أولاً من «تعديل» أو مفتاح التفعيل، ثم أعد تعيين كلمة المرور.</span>
            </div>
          )}

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
                autoComplete="new-password"
                disabled={disabledAccount}
                autoFocus={!disabledAccount}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                disabled={disabledAccount}
                aria-label={showPw ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
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
                autoComplete="new-password"
                disabled={disabledAccount}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPwConfirm(!showPwConfirm)}
                disabled={disabledAccount}
                aria-label={showPwConfirm ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
              >
                {showPwConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {pwError && <p className="text-[12px] font-semibold text-[var(--error)]">{pwError}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} disabled={resetting}>
              إلغاء
            </Button>
            <Button onClick={submitPw} disabled={resetting || disabledAccount || !newPw || !newPwConfirm}>
              تغيير كلمة المرور
            </Button>
          </div>
        </div>
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
          هل أنت متأكد من تغيير كلمة مرور «{target.fullName}»؟
          <br />
          بعد التأكيد ستصبح كلمة المرور الجديدة فعالة مباشرة.
        </p>
      </ConfirmDialog>
    </>
  );
}
