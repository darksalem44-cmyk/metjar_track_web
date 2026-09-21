'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useInstall, isStandalone } from './useInstall';

const DISMISS_KEY = 'pwa_install_dismissed';

/** دعوة تثبيت PWA تظهر مرة واحدة بعد مهلة قصيرة، مع احترام رفض المستخدم. */
export default function InstallPrompt() {
  const { canInstall, install } = useInstall();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!canInstall) {
      setVisible(false);
      return;
    }
    if (localStorage.getItem(DISMISS_KEY) === '1') return;
    if (isStandalone()) return;

    // مهلة قصيرة حتى لا تظهر فور الدخول
    const t = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(t);
  }, [canInstall]);

  if (!canInstall || !visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const doInstall = async () => {
    const outcome = await install();
    if (outcome === 'accepted') localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-20 lg:bottom-6 inset-x-4 lg:inset-x-auto lg:end-6 z-[90] lg:max-w-sm">
      <div className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
        <span className="grid place-items-center w-10 h-10 rounded-xl bg-[var(--primary-surface)] text-[var(--primary)] shrink-0">
          <Download className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-[var(--text)]">ثبّت تطبيق متجر تراك</p>
          <p className="text-[12px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
            وصول أسرع وتجربة تشبه التطبيقات على جهازك.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={doInstall}
              className="px-3.5 py-1.5 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-[12px] font-semibold"
            >
              تثبيت
            </button>
            <button
              onClick={dismiss}
              className="px-3 py-1.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-[12px] font-semibold hover:bg-[var(--surface-variant)]"
            >
              لاحقاً
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="text-[var(--text-muted)] hover:text-[var(--text)] shrink-0" aria-label="إغلاق">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
