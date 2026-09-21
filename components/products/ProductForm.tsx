'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import { useProfile } from '@/components/ProfileContext';
import { createProduct, updateProduct, fetchProductById } from '@/lib/data/products';
import { fetchBranchesByStore } from '@/lib/data/branches';
import { deleteImageObjects, isStoredPath } from '@/lib/supabase';
import { currencyOptions } from '@/lib/constants';
import type { CurrencyCode, Product } from '@/lib/types';
import { toastError, toastSuccess } from '@/lib/toast';
import { PageHeader, Button, Toggle, CenteredSpinner } from '@/components/ui/controls';
import { TextField, TextArea, CategoryAutocomplete } from '@/components/ui/fields';
import { ImagePicker } from '@/components/ui/images';
import { Package, Split } from 'lucide-react';

export default function ProductForm({ storeId, productId }: { storeId: string; productId?: string }) {
  const router = useRouter();
  const profile = useProfile();
  const isEdit = !!productId;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('SYP');
  const [category, setCategory] = useState('');
  const [isBestSeller, setIsBestSeller] = useState(false);
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [original, setOriginal] = useState<Product | null>(null);

  const folder = `products/${profile.id}/`;

  useEffect(() => {
    (async () => {
      try {
        const br = await fetchBranchesByStore(storeId);
        setBranches(br.map((b) => ({ id: b.id, name: b.name })));
        if (!isEdit) {
          setLoading(false);
          return;
        }
        const p = await fetchProductById(productId);
        if (!p) {
          toastError('تعذر العثور على المنتج');
          router.pop();
          return;
        }
        setOriginal(p);
        setName(p.name);
        setPrice(String(p.price));
        setCurrency(p.currency);
        setCategory(p.category ?? '');
        setIsBestSeller(p.isBestSeller);
        setBranchId(p.branchId ?? '');
        setImageUrls(p.imageUrls ?? []);
        setDescription(p.description ?? '');
      } catch (e: any) {
        toastError(typeof e === 'string' ? e : 'تعذر تحميل البيانات');
      } finally {
        setLoading(false);
      }
    })();
  }, [storeId, productId, isEdit, router]);

  if (loading) return <CenteredSpinner label="جاري تحميل المنتج..." />;

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('اسم المنتج مطلوب');
      return;
    }
    const priceNum = Number(price.replace(/,/g, ''));
    if (price.trim() === '' || Number.isNaN(priceNum)) {
      setError('السعر غير صحيح');
      return;
    }
    setSaving(true);
    try {
      const input = {
        storeId,
        branchId: branchId || undefined,
        name: name.trim(),
        price: priceNum,
        currency,
        imageUrls,
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        isBestSeller,
      };
      if (isEdit && productId) {
        const removed = original?.imageUrls.filter((x) => !imageUrls.includes(x)) ?? [];
        await updateProduct(productId, input);
        try {
          await deleteImageObjects(removed.filter(isStoredPath));
        } catch {
          // تجاهل
        }
        toastSuccess('تم تحديث المنتج بنجاح');
        router.pop();
      } else {
        const created = await createProduct(input, profile.id);
        toastSuccess('تمت إضافة المنتج بنجاح');
        router.replace({ name: 'product-details', productId: created.id });
      }
    } catch (e: any) {
      toastError(typeof e === 'string' ? e : 'تعذر حفظ المنتج');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={isEdit ? 'تعديل المنتج' : 'إضافة منتج'} onBack={() => router.pop()} />

      <div className="space-y-5">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-[var(--primary)]" />
            <h3 className="text-[14px] font-bold text-[var(--text)]">بيانات المنتج</h3>
          </div>
          <TextField
            label="اسم المنتج"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: جبنة بلدية 1 كغ"
            error={error === 'اسم المنتج مطلوب' ? error : null}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="السعر"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ''))}
              placeholder="0.0"
              dir="ltr"
              inputMode="decimal"
              error={error === 'السعر غير صحيح' ? error : null}
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
              <p className="text-[11px] text-[var(--text-secondary)]">إبراز المنتج كمفضل لدى العملاء</p>
            </div>
            <Toggle checked={isBestSeller} onChange={setIsBestSeller} />
          </div>

          {branches.length > 0 && (
            <div>
              <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">المكان</label>
              <div className="flex items-center gap-2">
                <span className="grid place-items-center w-8 h-8 rounded-lg bg-[var(--primary-surface-light)] text-[var(--primary)] shrink-0">
                  <Split className="w-4 h-4" />
                </span>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="flex-1 bg-[var(--input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-[13px] text-[var(--text)]"
                >
                  <option value="">المتجر الرئيسي</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      فرع: {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <ImagePicker label="صور المنتج" value={imageUrls} onChange={setImageUrls} folder={folder} max={5} hint="حتى 5 صور" />
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <TextArea label="الوصف" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف المنتج ومكوناته" rows={4} />
        </section>

        <div className="flex items-center justify-end gap-2 pb-6">
          <Button variant="ghost" onClick={() => router.pop()} disabled={saving}>إلغاء</Button>
          <Button onClick={submit} loading={saving}>{isEdit ? 'حفظ التعديلات' : 'إضافة المنتج'}</Button>
        </div>
      </div>
    </div>
  );
}