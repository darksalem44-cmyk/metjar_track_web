'use client';

import { Plus, Scale, X } from 'lucide-react';
import { unitGroups } from '@/lib/constants';
import { cn } from '@/lib/utils';

/** صف تحرير سعة إضافية: القيم نصوص كما كُتبت، وتُحوَّل إلى أرقام عند الحفظ. */
export interface PriceOptionDraft {
  unitValue: string;
  unit: string;
  price: string;
}

export const emptyPriceOption = (): PriceOptionDraft => ({ unitValue: '', unit: '', price: '' });

/** يحوّل نص رقم (مع فواصل الآلاف) إلى رقم، أو NaN. */
export function parseDraftNumber(text: string): number {
  return text.trim() === '' ? NaN : Number(text.replace(/,/g, ''));
}

/** صف فارغ تماماً يُتجاهل عند الحفظ بدل أن يُعدّ خطأ. */
export function isBlankOption(o: PriceOptionDraft): boolean {
  return !o.unitValue.trim() && !o.unit && !o.price.trim();
}

/** رسالة خطأ لأول صف غير مكتمل، أو null إن كانت كل الصفوف صالحة. */
export function priceOptionsError(rows: PriceOptionDraft[], hasMainUnit: boolean): string | null {
  const filled = rows.filter((o) => !isBlankOption(o));
  if (filled.length === 0) return null;
  if (!hasMainUnit) return 'حدّد سعة المنتج أولاً قبل إضافة سعات أخرى';
  for (const [i, o] of filled.entries()) {
    const value = parseDraftNumber(o.unitValue);
    const price = parseDraftNumber(o.price);
    if (!(value > 0) || !o.unit || !(price >= 0)) return `أكمل السعة الإضافية رقم ${i + 1}: السعة والوحدة والسعر`;
  }
  return null;
}

const inputClass =
  'min-w-0 bg-[var(--input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-[13px] text-[var(--text)] outline-none focus:border-[var(--primary)] transition-colors';

/**
 * «سعات وأسعار إضافية»: كل صف سعة + وحدة + سعر بعملة المنتج، وزر (+) يضيف صفاً بلا حد.
 * السعة الأساسية تبقى في حقول السعر والسعة أعلى النموذج.
 */
export default function PriceOptionsField({
  value,
  onChange,
  currencyLabel,
  error,
}: {
  value: PriceOptionDraft[];
  onChange: (next: PriceOptionDraft[]) => void;
  currencyLabel: string;
  error?: string | null;
}) {
  const setAt = (index: number, patch: Partial<PriceOptionDraft>) =>
    onChange(value.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  const removeAt = (index: number) => onChange(value.filter((_, i) => i !== index));
  const add = () => onChange([...value, emptyPriceOption()]);
  const numeric = (text: string) => text.replace(/[^\d.,]/g, '');

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
          <Scale className="w-3.5 h-3.5" />
          سعات وأسعار إضافية
          <span className="font-normal text-[var(--text-muted)]">(اختياري)</span>
        </span>
        {value.length > 0 && <span className="text-[11px] text-[var(--text-muted)]">السعر بعملة المنتج: {currencyLabel}</span>}
      </div>

      {value.length > 0 && (
        <div className="space-y-2 mb-2">
          {value.map((o, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={o.unitValue}
                onChange={(e) => setAt(index, { unitValue: numeric(e.target.value) })}
                placeholder="السعة"
                aria-label={`سعة الخيار ${index + 1}`}
                dir="ltr"
                inputMode="decimal"
                className={cn(inputClass, 'w-[22%] flex-none')}
              />
              <select
                value={o.unit}
                onChange={(e) => setAt(index, { unit: e.target.value })}
                aria-label={`وحدة الخيار ${index + 1}`}
                className={cn(inputClass, 'w-[30%] flex-none px-2')}
              >
                <option value="">الوحدة</option>
                {unitGroups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.units.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <input
                value={o.price}
                onChange={(e) => setAt(index, { price: numeric(e.target.value) })}
                placeholder="السعر"
                aria-label={`سعر الخيار ${index + 1}`}
                dir="ltr"
                inputMode="decimal"
                className={cn(inputClass, 'flex-1')}
              />
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label={`حذف الخيار ${index + 1}`}
                className="grid place-items-center w-9 h-9 shrink-0 rounded-xl btn-quiet text-[var(--text-secondary)] hover:text-[var(--error)] active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[var(--primary)]/40 px-3 py-2 text-[12px] font-semibold text-[var(--primary)] hover:bg-[var(--primary-surface)] transition-colors"
      >
        <Plus className="w-4 h-4" />
        إضافة سعة بسعر مختلف
      </button>

      {error ? (
        <p className="text-[11.5px] text-[var(--error)] mt-1.5">{error}</p>
      ) : (
        value.length === 0 && (
          <p className="text-[11px] text-[var(--text-muted)] mt-1">مثال: نفس المنتج بسعة 1 كغ بسعر آخر</p>
        )
      )}
    </div>
  );
}
