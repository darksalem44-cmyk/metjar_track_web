'use client';

import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ensureProfileRow } from '@/lib/data/profiles';
import { Store, Lock, Mail, User, Camera, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { translateError } from '@/lib/constants';
import { emailValidator, passwordValidator, nameValidator } from '@/lib/utils';
import { toastError } from '@/lib/toast';

type Mode = 'login' | 'signup';

export default function AuthPage({ initialMode = 'login' }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fullName, setFullName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  // مراجع للحقول: بعض المتصفحات (وإضافات إدارة كلمات المرور) تعبأ الحقول
  // دون تحديث حالة React، فقراءة القيمة الفعلية من DOM تضمن صحتها عند الإرسال.
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const fullNameRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const fail = (msg: string) => {
    setError(msg);
    toastError(msg);
  };

  const handleSubmit = async () => {
    // القيم الفعلية من الحقول مع الاحتفاظ بالحالة كبديل احتياطي
    const emailValue = (emailRef.current?.value ?? email).trim();
    const passwordValue = passwordRef.current?.value ?? password;
    const fullNameValue = (fullNameRef.current?.value ?? fullName).trim();
    const confirmValue = confirmRef.current?.value ?? confirm;

    // مزامنة الحالة مع القيم الفعلية (للملء التلقائي وغيره)
    setEmail(emailValue);
    setPassword(passwordValue);
    setFullName(fullNameValue);
    setConfirm(confirmValue);

    if (!emailValue) return fail('يرجى إدخال بريد إلكتروني صحيح');
    if (mode === 'signup') {
      if (!emailValidator(emailValue)) return fail('يرجى إدخال بريد إلكتروني صحيح');
      if (!passwordValidator(passwordValue)) return fail('كلمة المرور يجب أن تكون 8 محارف على الأقل');
      if (!nameValidator(fullNameValue)) return fail('الاسم مطلوب');
      if (!passwordValidator(confirmValue)) return fail('تأكيد كلمة المرور مطلوب');
      if (passwordValue !== confirmValue) return fail('كلمتا المرور غير متطابقتين');
      if (!agreed) return fail('يرجى الموافقة على شروط الاستخدام');
    } else {
      // تسجيل الدخول: يُكتفى بوجود بريد غير فارغ، صحة الصيغة تقع على الخادم
      if (!passwordValue) return fail('كلمة المرور مطلوبة');
    }

    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailValue,
          password: passwordValue,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: emailValue,
          password: passwordValue,
          options: {
            data: { full_name: fullNameValue },
          },
        });
        if (error) throw error;
        // كما في تطبيق الموبايل: نضمن وجود صف profile للحساب الجديد
        if (data.user) {
          await ensureProfileRow(data.user.id, {
            fullName: fullNameValue,
            email: emailValue,
          });
        }
        if (data.session === null && data.user) {
          setError(
            'تم إنشاء الحساب بنجاح. يرجى تفعيل البريد الإلكتروني عبر الرابط المرسل إلى بريدك لاستكمال التسجيل.',
          );
          return;
        }
      }
    } catch (err: any) {
      setError(translateError(err));
      toastError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--background)]">
      <div className="max-w-md w-full bg-[var(--surface)] rounded-2xl shadow-sm border border-[var(--border)] p-7">
        <div className="text-center mb-7">
          <div className="w-16 h-16 bg-[var(--primary-surface)] text-[var(--primary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text)]">متجر تراك</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            {mode === 'login' ? 'تسجيل الدخول إلى لوحة التحكم' : 'إنشاء حساب تاجر جديد'}
          </p>
        </div>

        {error && (
          <div className={`mb-5 p-3.5 rounded-xl flex items-start gap-2.5 text-[12px] font-medium leading-relaxed ${error.startsWith('تم') ? 'bg-[var(--primary-surface)] border border-[var(--primary-light)] text-[var(--primary-dark)] dark:text-[var(--accent-text)]' : 'bg-[var(--error-surface)]/40 border border-[var(--error)]/40 text-[var(--error)]'}`}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">الاسم الكامل</label>
              <div className="relative">
                <User className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--text-muted)]" />
                <input
                  ref={fullNameRef}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="اسمك الكامل"
                  autoComplete="name"
                  className="w-full pe-4 ps-10 py-2.5 bg-[var(--input)] border border-[var(--border)] rounded-xl text-[13px] focus:border-[var(--primary)]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--text-muted)]" />
<input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  dir="ltr"
                  autoComplete={mode === 'login' ? 'username' : 'email'}
                  className="w-full pe-4 ps-10 py-2.5 bg-[var(--input)] border border-[var(--border)] rounded-xl text-[13px] text-left focus:border-[var(--primary)]"
                />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--text-muted)]" />
<input
                  ref={passwordRef}
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full pe-10 ps-10 py-2.5 bg-[var(--input)] border border-[var(--border)] rounded-xl text-[13px] text-left focus:border-[var(--primary)]"
                />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">تأكيد كلمة المرور</label>
              <div className="relative">
                <Camera className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--text-muted)]" />
                <input
                  ref={confirmRef}
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  autoComplete="new-password"
                  className="w-full pe-10 ps-10 py-2.5 bg-[var(--input)] border border-[var(--border)] rounded-xl text-[13px] text-left focus:border-[var(--primary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === 'login' && (
            <div className="text-end">
              <button
                onClick={() => setShowForgot(true)}
                className="text-[12px] font-semibold text-[var(--primary)] hover:underline"
              >
                نسيت كلمة المرور؟
              </button>
            </div>
          )}

          {mode === 'signup' && (
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-4.5 h-4.5 mt-0.5 rounded accent-[var(--primary)]"
              />
              <span className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                أوافق على{' '}
                <span className="text-[var(--primary)] font-semibold">شروط الاستخدام</span>وخدمات متجر تراك
              </span>
            </label>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 bg-[var(--primary)] hover:opacity-90 text-[var(--on-primary)] font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-[var(--on-primary)]/40 border-t-[var(--on-primary)] rounded-full animate-spin" />
            ) : mode === 'login' ? (
              'تسجيل الدخول'
            ) : (
              'إنشاء الحساب'
            )}
          </button>
        </div>

        {mode === 'signup' && (
          <div className="mt-6 text-center text-[12px] text-[var(--text-muted)]">
            <span>لديك حساب بالفعل؟</span>{' '}
            <button onClick={() => switchMode('login')} className="text-[var(--primary)] font-semibold hover:underline">
              تسجيل الدخول
            </button>
          </div>
        )}

        {showForgot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowForgot(false)} />
            <div className="relative w-full max-w-sm bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-xl">
              <div className="flex items-start gap-3">
                <span className="grid place-items-center w-10 h-10 rounded-full bg-[var(--warning-surface)] text-[var(--warning)] shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-[14px] font-bold text-[var(--text)]">نسيت كلمة المرور؟</h3>
                  <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mt-1">
                    تواصل مع المدير لإعادة تعيين كلمة المرور الخاصة بك.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowForgot(false)}
                className="w-full mt-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text)] text-[13px] font-semibold hover:bg-[var(--surface-variant)]"
              >
                حسناً، فهمت
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}