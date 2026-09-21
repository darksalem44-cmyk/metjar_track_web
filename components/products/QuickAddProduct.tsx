'use client';

import { useState } from 'react';
import { useProfile } from '@/components/ProfileContext';
import { createProduct } from '@/lib/data/products';
import { currencyOptions } from '@/lib/constants';
import type { CurrencyCode } from '@/lib/types';
import { toastError, toastSuccess } from '@/lib/toast';
import { Modal } from '@/components/ui/modals';
import { Button, Toggle } from '@/components/ui/controls';
import { TextField, CategoryAutocomplete } from '@/components/ui/fields';

export default function QuickAddProduct({
  open,
  onClose,
  storeId,
  branchId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  storeId: string;
  branchId?: string;
  onAdded: () => void;
}) {
  const profile = useProfile();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('SYP');
  const [category, setCategory] = useState('');
  const [isBestSeller, setIsBestSeller] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('اسم المنتج مطلوب');
      return;
    }
    const priceNum = Number(price);
    if (priceNum < 0 || price.trim() === '' || Number.isNaN(priceNum)) {
      setError('سعر المنتج غير صحيح');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createProduct(
        {
          storeId,
          branchId,
          name: name.trim(),
          price: priceNum,
          currency,
          imageUrls: [],
          category: category.trim() || undefined,
          isBestSeller,
        },
        profile.id,
      );
      toastSuccess('تمت إضافة المنتج بنجاح');
      setName('');
      setPrice('');
      setCategory('');
      setIsBestSeller(false);
      onAdded();
    } catch (e: any) {
      toastError(typeof e === 'string' ? e : 'تعذر إضافة المنتج');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="إضافة منتج سريع">
      <div className="space-y-4">
        <TextField label="اسم المنتج" required value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: علبة ماء" autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="السعر"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0.0"
            dir="ltr"
            inputMode="decimal"
          />
          <div>
            <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">العملة</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-[13px] text-[var(--text)]"
            >
              {currencyOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <CategoryAutocomplete label="التصنيف" value={category} onChange={setCategory} placeholder="اختر أو اكتب الفئة" />
        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
          <div>
            <p className="text-[13px] font-semibold text-[var(--text)]">الأنسب مبيعاً</p>
            <p className="text-[11px] text-[var(--text-secondary)]">إبراز المنتج كالأكثر رواجاً</p>
          </div>
          <Toggle checked={isBestSeller} onChange={setIsBestSeller} size="sm" />
        </div>
        {error && <p className="text-[12px] font-semibold text-[var(--error)]">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button onClick={submit} loading={saving}>إضافة</Button>
        </div>
      </div>
    </Modal>
  );
}