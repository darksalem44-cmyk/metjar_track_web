'use client';

import { useRef } from 'react';
import { Layers, Plus, X } from 'lucide-react';

/**
 * حقل «المتغيرات»: يبدأ بحقل واحد، وزر (+) بجانب آخر حقل يضيف حقلاً جديداً بلا حد.
 * الحقول الفارغة تُحذف عند الحفظ (cleanVariants)، لذلك يبقى حقل واحد على الأقل دائماً.
 */
export default function VariantsField({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const rows = value.length > 0 ? value : [''];
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const setAt = (index: number, text: string) => onChange(rows.map((v, i) => (i === index ? text : v)));

  const add = () => {
    onChange([...rows, '']);
    // تركيز الحقل الجديد بعد رسمه
    requestAnimationFrame(() => inputsRef.current[rows.length]?.focus());
  };

  const removeAt = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : ['']);
  };

  return (
    <div>
      <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">
        <Layers className="w-3.5 h-3.5" />
        المتغيرات
        <span className="font-normal text-[var(--text-muted)]">(اختياري)</span>
      </label>
      <div className="space-y-2">
        {rows.map((variant, index) => {
          const isLast = index === rows.length - 1;
          return (
            <div key={index} className="flex items-center gap-2">
              <input
                ref={(el) => {
                  inputsRef.current[index] = el;
                }}
                value={variant}
                onChange={(e) => setAt(index, e.target.value)}
                onKeyDown={(e) => {
                  // Enter في آخر حقل غير فارغ يضيف حقلاً جديداً بدل إرسال النموذج
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (isLast && variant.trim()) add();
                  }
                }}
                placeholder={index === 0 ? 'مثال: أحمر، XL، نكهة الفانيلا' : `متغير ${index + 1}`}
                aria-label={`المتغير ${index + 1}`}
                className="min-w-0 flex-1 bg-[var(--input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-[13px] text-[var(--text)] outline-none focus:border-[var(--primary)] transition-colors"
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  aria-label={`حذف المتغير ${index + 1}`}
                  className="grid place-items-center w-9 h-9 shrink-0 rounded-xl btn-quiet text-[var(--text-secondary)] hover:text-[var(--error)] active:scale-95"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {isLast && (
                <button
                  type="button"
                  onClick={add}
                  aria-label="إضافة متغير"
                  className="grid place-items-center w-9 h-9 shrink-0 rounded-xl bg-[var(--primary-surface)] text-[var(--primary)] border border-[var(--primary)]/25 hover:border-[var(--primary)]/50 active:scale-95 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
