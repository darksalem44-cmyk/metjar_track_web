'use client';

import type { ReactNode } from 'react';
import { Store, ArrowRight, FileText } from 'lucide-react';

/**
 * إطار موحّد لصفحات السياسات (الشروط / الخصوصية).
 * مكوّن عميل بسيط بلا حالة — نفس هوية التصميم في باقي التطبيق.
 */
export default function LegalPageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-main)]">
      <header className="glass sticky top-0 z-20 border-b border-[var(--border)]">
        <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/icons/Icon-192.png?v=3"
              alt="متجر تراك"
              className="w-8 h-8 rounded-[10px] ring-1 ring-[var(--primary)]/25 shrink-0"
            />
            <span className="text-[14px] font-bold text-[var(--text)] truncate">متجر تراك</span>
          </div>
          <a
            href="/"
            className="pill pill-sm shrink-0"
            aria-label="العودة إلى التطبيق"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            العودة للتطبيق
          </a>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="anim-fade">
          <div className="flex items-start gap-3.5 mb-7">
            <span className="grid place-items-center w-12 h-12 rounded-[15px] bg-[image:var(--primary-gradient)] text-[var(--on-primary)] shrink-0 shadow-[var(--shadow-brand)] ring-1 ring-[var(--primary)]/25">
              <FileText className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.02em] text-[var(--text)] leading-tight">
                {title}
              </h1>
              <p className="text-[13px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">{subtitle}</p>
            </div>
          </div>

          <article className="legal-doc">{children}</article>
        </div>
      </main>

      <footer className="border-t border-[var(--border)]">
        <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5" />
            متجر تراك — منصّة لإدارة المتاجر والفروع
          </span>
          <span>© {new Date().getFullYear()} جميع الحقوق محفوظة</span>
        </div>
      </footer>
    </div>
  );
}
