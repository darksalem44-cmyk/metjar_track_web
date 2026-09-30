'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { Store, Lock, Mail, Eye, EyeOff, AlertCircle, BarChart3, Bell } from 'lucide-react';
import { translateError } from '@/lib/constants';
import { toastError } from '@/lib/toast';

/**
 * شاشة الدخول فقط: إنشاء الحسابات يتم من لوحة الإدارة (إدارة الحسابات)
 * ولا يُسمح بأي تسجيل ذاتي من الموقع.
 */
export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const emailId = useId();
  const passId = useId();
  const submitOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) void handleSubmit();
  };

  // مراجع للحقول: بعض المتصفحات (وإضافات إدارة كلمات المرور) تعبأ الحقول
  // دون تحديث حالة React، فقراءة القيمة الفعلية من DOM تضمن صحتها عند الإرسال.
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const fail = (msg: string) => {
    setError(msg);
    toastError(msg);
  };

  const handleSubmit = async () => {
    // القيم الفعلية من الحقول مع الاحتفاظ بالحالة كبديل احتياطي
    const emailValue = (emailRef.current?.value ?? email).trim();
    const passwordValue = passwordRef.current?.value ?? password;

    // مزامنة الحالة مع القيم الفعلية (للملء التلقائي وغيره)
    setEmail(emailValue);
    setPassword(passwordValue);

    if (!emailValue) return fail('يرجى إدخال بريد إلكتروني صحيح');
    // تسجيل الدخول: يُكتفى بوجود بريد غير فارغ، صحة الصيغة تقع على الخادم
    if (!passwordValue) return fail('كلمة المرور مطلوبة');

    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailValue,
        password: passwordValue,
      });
      if (error) throw error;
    } catch (err) {
      setError(translateError(err));
      toastError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden p-12 bg-[image:var(--primary-gradient)] text-white">
        <div
          className="absolute inset-0 opacity-[0.14] [background-image:radial-gradient(circle_at_20%_18%,white_0,transparent_42%),radial-gradient(circle_at_78%_72%,white_0,transparent_38%)]"
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3">
          <img src="/icons/Icon-192.png?v=3" alt="متجر تراك" className="w-11 h-11 rounded-[14px] ring-1 ring-white/35" />
          <span className="text-[17px] font-bold tracking-[-0.01em]">متجر تراك</span>
        </div>
        <div className="relative max-w-[24rem]">
          <h2 className="text-[30px] leading-[1.35] font-bold">منصّتك لإدارة المتاجر والفروع وتتبع النشاطات</h2>
          <p className="text-[14px] leading-relaxed mt-3 text-white/85">
            بيانات منظّمة، صلاحيات دقيقة، وتنبيهات فورية — بواجهة عربية واحدة.
          </p>
          <ul className="mt-7 space-y-3 text-[13px] font-medium">
            <li className="flex items-center gap-2.5">
              <Store className="w-4 h-4 shrink-0" />
              إدارة المتاجر وفروعها ورموزها
            </li>
            <li className="flex items-center gap-2.5">
              <BarChart3 className="w-4 h-4 shrink-0" />
              متابعة المنتجات والأسعار والنشاطات
            </li>
            <li className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 shrink-0" />
              تنبيهات لحظية للأسعار الحرجة والتعديلات
            </li>
          </ul>
        </div>
        <p className="relative text-[11px] text-white/70">© {new Date().getFullYear()} متجر تراك</p>
      </div>

      <div className="flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full card shadow-[var(--shadow-lg)] rounded-[22px] anim-scale p-7 sm:p-8">
        <div className="text-center mb-7">
          <div className="w-16 h-16 bg-[image:var(--primary-gradient)] text-[var(--on-primary)] rounded-[20px] flex items-center justify-center mx-auto mb-4 shadow-[var(--shadow-brand)] ring-1 ring-[var(--primary)]/25">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-[24px] font-bold tracking-[-0.02em] text-[var(--text)]">متجر تراك</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1.5">تسجيل الدخول إلى لوحة التحكم</p>
        </div>

        {error && (
          <div className="anim-fade mb-5 p-3.5 rounded-[12px] flex items-start gap-2.5 text-[12px] font-medium leading-relaxed bg-[var(--error-surface)] border border-[var(--error)]/30 text-[var(--error)]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor={emailId} className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 ps-0.5">البريد الإلكتروني</label>
            <div className="group relative">
              <Mail className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--text-muted)] transition-colors group-focus-within:text-[var(--primary)]" aria-hidden="true" />
              <input
                id={emailId}
                ref={emailRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={submitOnEnter}
                placeholder="name@example.com"
                dir="ltr"
                autoComplete="username"
                className="w-full field pe-4 ps-10 py-2.5 rounded-[12px] text-[13px] text-left"
              />
            </div>
          </div>

          <div>
            <label htmlFor={passId} className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 ps-0.5">كلمة المرور</label>
            <div className="group relative">
              <Lock className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--text-muted)] transition-colors group-focus-within:text-[var(--primary)]" aria-hidden="true" />
              <input
                id={passId}
                ref={passwordRef}
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={submitOnEnter}
                placeholder="••••••••"
                dir="ltr"
                autoComplete="current-password"
                className="w-full field pe-10 ps-10 py-2.5 rounded-[12px] text-[13px] text-left"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                aria-pressed={showPass}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-variant)] active:scale-90 transition-[background-color,color,transform]"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="text-end">
            <button
              onClick={() => setShowForgot(true)}
              className="text-[12px] font-semibold text-[var(--primary)] hover:text-[var(--primary-dark)] dark:hover:text-[var(--brand-700)] transition-colors"
            >
              نسيت كلمة المرور؟
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-brand w-full py-3 rounded-[14px] font-semibold flex items-center justify-center gap-2 text-[14px] transition-[box-shadow,transform,opacity] duration-[var(--dur-2)] ease-[var(--ease-out)] hover:-translate-y-[1px] disabled:opacity-50 disabled:pointer-events-none disabled:translate-y-0"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-[var(--on-primary)]/40 border-t-[var(--on-primary)] rounded-full animate-spin" />
            ) : (
              'تسجيل الدخول'
            )}
          </button>
        </div>

        <p className="mt-5 text-center text-[11px] text-[var(--text-muted)] leading-relaxed">
          إنشاء الحسابات يتم من قِبل الإدارة فقط. لطلب حساب جديد تواصل مع مدير النظام.
        </p>

        <div className="mt-4 text-center text-[11px] text-[var(--text-muted)] flex items-center justify-center gap-3">
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--primary)] hover:underline underline-offset-2 transition-colors"
          >
            شروط الاستخدام
          </a>
          <span aria-hidden="true">•</span>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--primary)] hover:underline underline-offset-2 transition-colors"
          >
            سياسة الخصوصية
          </a>
        </div>

        {showForgot && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="modal-scrim absolute inset-0" onClick={() => setShowForgot(false)} />
            <div className="modal-panel relative w-full sm:w-auto max-w-sm rounded-t-[20px] sm:rounded-[20px] p-5">
              <div className="flex items-start gap-3">
                <span className="grid place-items-center w-10 h-10 rounded-full bg-[var(--warning-surface)] text-[var(--warning)] border border-[var(--warning)]/25 shrink-0">
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
                className="btn-quiet w-full mt-4 py-2.5 rounded-[12px] text-[var(--text)] text-[13px] font-semibold"
              >
                حسناً، فهمت
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}