'use client';

import { useId } from 'react';
import { Ruler } from 'lucide-react';
import { unitGroups } from '@/lib/constants';
import { cn } from '@/lib/utils';

const UNIT_VALUE_ERROR = 'أدخل السعة بقيمة أكبر من 0';
const UNIT_MISSING_ERROR = 'اختر وحدة القياس';

/**
 * يتحقق من السعة الأساسية: اختيارية، لكن القيمة والوحدة تأتيان معاً والقيمة موجبة.
 * يعيد الرسالة أو null، و`parsed` هي القيمة الرقمية الجاهزة للحفظ (أو undefined بلا سعة).
 */
export function checkUnit(value: string, unit: string): { error: string | null; parsed?: number } {
  const hasValue = value.trim() !== '';
  const num = Number(value.replace(/,/g, ''));
  if (hasValue && (Number.isNaN(num) || num <= 0)) return { error: UNIT_VALUE_ERROR };
  if (hasValue !== !!unit) return { error: hasValue ? UNIT_MISSING_ERROR : UNIT_VALUE_ERROR };
  return { error: null, parsed: hasValue ? num : undefined };
}

/** حقل «السعة / الوحدة»: رقم وبجانبه قائمة الوحدات مجمّعة حسب النوع. */
export default function UnitField({
  value,
  unit,
  onValueChange,
  onUnitChange,
  error,
}: {
  value: string;
  unit: string;
  onValueChange: (next: string) => void;
  onUnitChange: (next: string) => void;
  error?: string | null;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">
        <Ruler className="w-3.5 h-3.5" />
        السعة / الوحدة
        <span className="font-normal text-[var(--text-muted)]">(اختياري)</span>
      </label>
      <div
        className={cn(
          'flex items-stretch rounded-xl border bg-[var(--input)] overflow-hidden focus-within:border-[var(--primary)] transition-colors',
          error ? 'border-[var(--error)]' : 'border-[var(--border)]',
        )}
      >
        <input
          id={id}
          value={value}
          onChange={(e) => onValueChange(e.target.value.replace(/[^\d.,]/g, ''))}
          placeholder="مثال: 500"
          dir="ltr"
          inputMode="decimal"
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[13px] text-[var(--text)] outline-none"
        />
        <select
          aria-label="وحدة القياس"
          value={unit}
          onChange={(e) => onUnitChange(e.target.value)}
          className="w-[44%] max-w-[180px] bg-[var(--surface-variant)] border-s border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--text)] outline-none"
        >
          <option value="">اختر الوحدة</option>
          {unitGroups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.units.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label} ({u.value})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {error ? (
        <p className="text-[11.5px] text-[var(--error)] mt-1">{error}</p>
      ) : (
        <p className="text-[11px] text-[var(--text-muted)] mt-1">مثال: 500 غ، 1.5 لتر، 12 قطعة</p>
      )}
    </div>
  );
}
