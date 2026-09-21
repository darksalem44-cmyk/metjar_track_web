'use client';

import { useState } from 'react';
import { createEmployeeAccount, createMerchantAccount } from '@/lib/data/accounts';
import { generatePassword } from '@/lib/utils';
import { toastError } from '@/lib/toast';
import { Modal } from '@/components/ui/modals';
import { Button } from '@/components/ui/controls';
import { TextField } from '@/components/ui/fields';
import { CreatedAccountActions } from '@/components/ui/accountUtils';
import { KeyRound, Loader2 } from 'lucide-react';
import type { UserRole } from '@/lib/types';

export default function AddAccountDialog({
  open,
  onClose,
  role,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  role: UserRole;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(generatePassword());
  const [auto, setAuto] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string; name: string } | null>(null);

  const regenerate = () => setPassword(generatePassword());

  const submit = async () => {
    setError(null);
    if (!email.trim() || !email.includes('@')) {
      setError('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }
    if (!name.trim()) {
      setError('يرجى إدخال الاسم الكامل');
      return;
    }
    if (password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 محارف على الأقل');
      return;
    }
    setSaving(true);
    try {
      if (role === 'merchant') {
        await createMerchantAccount({ email, password, fullName: name });
      } else {
        await createEmployeeAccount({ email, password, fullName: name });
      }
      setCreated({ email: email.trim().toLowerCase(), password, name: name.trim() });
      onCreated();
    } catch (e: any) {
      setError(typeof e === 'string' ? e : 'تعذر إنشاء الحساب');
      toastError(typeof e === 'string' ? e : 'تعذر إنشاء الحساب');
    } finally {
      setSaving(false);
    }
  };

  const closeAll = () => {
    onClose();
    setName('');
    setEmail('');
    setPassword(generatePassword());
    setAuto(true);
    setError(null);
    setCreated(null);
  };

  return (
    <Modal
      open={open}
      onClose={closeAll}
      title={created ? 'تم إنشاء الحساب' : `إضافة ${role === 'merchant' ? 'تاجر' : 'موظف'}`}
    >
      {created ? (
        <div className="space-y-4">
          <CreatedAccountActions email={created.email} password={created.password} name={created.name} />
          <Button className="w-full" onClick={closeAll}>تم</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <TextField label="الاسم الكامل" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المستخدم" autoFocus />
          <TextField
            label="البريد الإلكتروني"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            dir="ltr"
          />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-semibold text-[var(--text-secondary)]">كلمة المرور</label>
              <button type="button" onClick={() => setAuto(!auto)} className="text-[11px] font-semibold text-[var(--primary)]">
                {auto ? 'إدخال يدوي' : 'توليد تلقائي'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                className="flex-1 bg-[var(--input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-[13px] text-[var(--text)] font-mono"
              />
              <Button variant="outline" size="sm" onClick={regenerate} title="توليد كلمة مرور جديدة">
                <KeyRound className="w-4 h-4" />
              </Button>
            </div>
            {auto && <p className="text-[11px] text-[var(--text-muted)] mt-1">يتم توليد كلمة مرور آمنة تلقائياً.</p>}
          </div>
          {error && <p className="text-[12px] font-semibold text-[var(--error)]">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={closeAll} disabled={saving}>إلغاء</Button>
            <Button onClick={submit} loading={saving}>{saving ? '' : 'إنشاء الحساب'}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}