'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import { useProfile } from '@/components/ProfileContext';
import { createBranch, updateBranch, fetchBranchById, generateBranchCode } from '@/lib/data/branches';
import { deleteImageObjects, filterStoredPaths } from '@/lib/supabase';
import { toastError, toastSuccess } from '@/lib/toast';
import { PageHeader, Button, Toggle, CenteredSpinner } from '@/components/ui/controls';
import { TextField, TextArea, CategoryAutocomplete } from '@/components/ui/fields';
import { ImagePicker, SingleImagePicker } from '@/components/ui/images';
import { WalletFields, CustomFieldsEditor } from '@/components/forms/SharedFormParts';
import LocationMap from '@/components/ui/LocationMap';
import { Spline as SplineIcon, MapPin } from 'lucide-react';

interface StartedImages {
  covers: string[];
  signage?: string;
  shamcash?: string;
  paymera?: string;
}

export default function BranchForm({ storeId, branchId }: { storeId: string; branchId?: string }) {
  const router = useRouter();
  const profile = useProfile();
  const isEdit = !!branchId;
  const editable = profile.role === 'manager' || !!profile.canEdit;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openAt, setOpenAt] = useState('');
  const [closeAt, setCloseAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [coverImageUrls, setCoverImageUrls] = useState<string[]>([]);
  const [signageImageUrl, setSignageImageUrl] = useState('');
  const [shamcashWalletId, setShamcashWalletId] = useState('');
  const [shamcashQr, setShamcashQr] = useState('');
  const [paymeraWalletId, setPaymeraWalletId] = useState('');
  const [paymeraQr, setPaymeraQr] = useState('');
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState<{ label: string; value: string }[]>([]);
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [savedLocation, setSavedLocation] = useState('');
  const [startedImages, setStartedImages] = useState<StartedImages>({ covers: [] });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      if (!isEdit) {
        setLoading(false);
        return;
      }
      const b = await fetchBranchById(branchId!);
      if (!b) {
        toastError('تعذر العثور على الفرع');
        router.pop();
        return;
      }
      setName(b.name);
      setBranchCode(b.branchCode ?? '');
      setCategory(b.category ?? '');
      setPhone(b.phone ?? '');
      setAddress(b.address ?? '');
      setOpenAt(b.openAt ?? '');
      setCloseAt(b.closeAt ?? '');
      setIsActive(b.isActive);
      setCoverImageUrls(b.coverImageUrls ?? []);
      setSignageImageUrl(b.signageImageUrl ?? '');
      setShamcashWalletId(b.shamcashWalletId ?? '');
      setShamcashQr(b.shamcashQrImageUrl ?? '');
      setPaymeraWalletId(b.paymeraWalletId ?? '');
      setPaymeraQr(b.paymeraQrImageUrl ?? '');
      setNotes(b.notes ?? '');
      setCustomFields(Object.entries(b.customFields ?? {}).map(([k, v]) => ({ label: k, value: String(v) })));
      setLat(b.latitude);
      setLng(b.longitude);
      const locText = b.latitude && b.longitude ? `${b.latitude.toFixed(5)}, ${b.longitude.toFixed(5)}` : '';
      setSavedLocation(locText);
      setStartedImages({
        covers: b.coverImageUrls ?? [],
        signage: b.signageImageUrl,
        shamcash: b.shamcashQrImageUrl,
        paymera: b.paymeraQrImageUrl,
      });
      setLoading(false);
    })();
  }, [branchId, isEdit, router]);

  if (loading) return <CenteredSpinner label="جاري تحميل بيانات الفرع..." />;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'اسم الفرع مطلوب';
    if (!address.trim()) e.address = 'العنوان مطلوب';
    if (phone && !/^[+\d][\d ]{7,}$/.test(phone.trim())) e.phone = 'رقم الهاتف غير صحيح';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const pickMap = (p: { latitude: number; longitude: number }) => {
    setLat(p.latitude);
    setLng(p.longitude);
    setSavedLocation(`${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`);
  };

  const submit = async () => {
    if (!validate()) {
      toastError('يرجى مراجعة الحقول المحددة');
      return;
    }
    setSaving(true);
    try {
      const input = {
        storeId,
        name: name.trim(),
        branchCode: branchCode.trim() || undefined,
        category: category.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim(),
        notes: notes.trim() || undefined,
        coverImageUrls,
        signageImageUrl: signageImageUrl || undefined,
        openAt,
        closeAt: closeAt || undefined,
        isActive,
        shamcashWalletId: shamcashWalletId.trim() || undefined,
        shamcashQrImageUrl: shamcashQr || undefined,
        paymeraWalletId: paymeraWalletId.trim() || undefined,
        paymeraQrImageUrl: paymeraQr || undefined,
        customFields: Object.fromEntries(
          customFields.filter((f) => f.label.trim()).map((f) => [f.label.trim(), f.value.trim()]),
        ),
        latitude: lat,
        longitude: lng,
      };

      if (isEdit && branchId) {
        await updateBranch(branchId, input);
        const removed = filterStoredPaths([
          ...startedImages.covers.filter((p) => !coverImageUrls.includes(p)),
          startedImages.signage && startedImages.signage !== signageImageUrl ? startedImages.signage : undefined,
          startedImages.shamcash && startedImages.shamcash !== shamcashQr ? startedImages.shamcash : undefined,
          startedImages.paymera && startedImages.paymera !== paymeraQr ? startedImages.paymera : undefined,
        ]);
        try {
          await deleteImageObjects(removed);
        } catch {
          // تجاهل
        }
        toastSuccess('تم تحديث الفرع بنجاح');
        router.pop();
      } else {
        const created = await createBranch(
          { ...input, branchCode: input.branchCode || generateBranchCode() },
          profile.id,
        );
        toastSuccess('تم إضافة الفرع بنجاح');
        router.replace({ name: 'branch-details', storeId, branchId: created.id });
      }
    } catch (err: any) {
      toastError(typeof err === 'string' ? err : 'تعذر حفظ الفرع');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={isEdit ? 'تعديل الفرع' : 'إضافة فرع'} onBack={() => router.pop()} />

      {!editable && <p className="mb-4 text-[12px] text-[var(--error)]">ليس لديك صلاحية لتعديل الفروع.</p>}

      <div className="space-y-5">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <SplineIcon className="w-4 h-4 text-[var(--primary)]" />
            <h3 className="text-[14px] font-bold text-[var(--text)]">بيانات الفرع</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="اسم الفرع" required value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: فرع المزة" error={errors.name} disabled={!editable} />
            <div>
              <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">رمز الفرع</label>
              <div className="flex items-center gap-2">
                <input
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  placeholder="BR-XXXXX"
                  dir="ltr"
                  disabled={!editable}
                  className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] disabled:opacity-50"
                />
                {!branchCode && <span className="text-[11px] text-[var(--text-muted)] shrink-0">يُولّد تلقائياً عند الإضافة إذا تُرك فارغاً.</span>}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <CategoryAutocomplete label="التصنيف / النشاط التجاري" value={category} onChange={setCategory} placeholder="اختر أو اكتب الفئة" disabled={!editable} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <TextField label="رقم الهاتف" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxx" dir="ltr" error={errors.phone} disabled={!editable} />
            <TextField label="العنوان" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="وصف العنوان" error={errors.address} disabled={!editable} />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:max-w-sm mt-4">
            <TextField label="وقت الافتتاح" type="time" value={openAt} onChange={(e) => setOpenAt(e.target.value)} disabled={!editable} />
            <TextField label="وقت الإغلاق" type="time" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} disabled={!editable} />
          </div>

          {isEdit && (
            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 mt-4">
              <div>
                <p className="text-[13px] font-semibold text-[var(--text)]">الفرع نشط</p>
                <p className="text-[11px] text-[var(--text-secondary)]">تعطيل الفرع يخفيه عن العرض</p>
              </div>
              <Toggle checked={isActive} onChange={setIsActive} disabled={!editable} />
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-[var(--primary)]" />
            <h3 className="text-[14px] font-bold text-[var(--text)]">الموقع على الخريطة</h3>
          </div>
          <LocationMap
            center={lat != null && lng != null ? { latitude: lat, longitude: lng } : undefined}
            onSelect={editable ? pickMap : undefined}
          />
          {savedLocation && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-[12px] font-semibold text-[var(--text-secondary)]">الموقع: {savedLocation}</span>
              {editable && (
                <Button variant="outline" size="sm" onClick={() => { setLat(undefined); setLng(undefined); setSavedLocation(''); }}>
                  إلغاء تحديد الموقع
                </Button>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <ImagePicker label="صور الفرع" value={coverImageUrls} onChange={setCoverImageUrls} folder={`branches/${profile.id}/`} max={5} />
          <div className="mt-4">
            <SingleImagePicker label="لافتة الفرع" value={signageImageUrl} onChange={(v) => setSignageImageUrl(v || '')} folder={`branches/${profile.id}/signage`} />
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
          <h3 className="text-[14px] font-bold text-[var(--text)]">محافظ الدفع</h3>
          <WalletFields
            walletName="شام كاش"
            walletId={shamcashWalletId}
            qrImage={shamcashQr}
            onWalletId={setShamcashWalletId}
            onQrImage={(v) => setShamcashQr(v || '')}
            imageFolder={`branches/${profile.id}/wallets`}
          />
          <WalletFields
            walletName="بيميرا"
            walletId={paymeraWalletId}
            qrImage={paymeraQr}
            onWalletId={setPaymeraWalletId}
            onQrImage={(v) => setPaymeraQr(v || '')}
            imageFolder={`branches/${profile.id}/wallets`}
          />
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <TextArea label="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات إضافية حول الفرع" rows={3} disabled={!editable} />
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          <h3 className="text-[14px] font-bold text-[var(--text)]">حقول مخصصة</h3>
          <CustomFieldsEditor fields={customFields} onChange={editable ? setCustomFields : () => {}} />
        </section>

        <div className="flex items-center justify-end gap-2 pb-6">
          <Button variant="ghost" onClick={() => router.pop()} disabled={saving}>إلغاء</Button>
          <Button onClick={submit} loading={saving}>{isEdit ? 'حفظ التعديلات' : 'إضافة الفرع'}</Button>
        </div>
      </div>
    </div>
  );
}