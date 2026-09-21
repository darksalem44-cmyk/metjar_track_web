'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import { useProfile } from '@/components/ProfileContext';
import {
  createStore,
  updateStore,
  fetchStoreById,
  canEditStore,
} from '@/lib/data/stores';
import { deleteImageObjects, isStoredPath } from '@/lib/supabase';
import type { Store } from '@/lib/types';
import { nameValidator, addressValidator, phoneValidator, isFormValid } from '@/lib/utils';
import { toastError, toastSuccess } from '@/lib/toast';
import { Button, CenteredSpinner, PageHeader } from '@/components/ui/controls';
import {
  TextField,
  TextArea,
  CategoryAutocomplete,
} from '@/components/ui/fields';
import { ImagePicker, SingleImagePicker } from '@/components/ui/images';
import { WalletFields, CustomFieldsEditor } from '@/components/forms/SharedFormParts';
import dynamic from 'next/dynamic';
import { Clock, Store as StoreIcon } from 'lucide-react';

const LocationMap = dynamic(() => import('@/components/ui/LocationMap'), { ssr: false });

export default function StoreForm({ storeId }: { storeId?: string }) {
  const router = useRouter();
  const profile = useProfile();

  const [loading, setLoading] = useState(!!storeId);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [commercialRegister, setCommercialRegister] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openAt, setOpenAt] = useState('08:00');
  const [closeAt, setCloseAt] = useState('');
  const [notes, setNotes] = useState('');
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | undefined>();
  const [coverImageUrls, setCoverImageUrls] = useState<string[]>([]);
  const [signageImageUrl, setSignageImageUrl] = useState<string | undefined>();
  const [shamcashWalletId, setShamcashWalletId] = useState('');
  const [shamcashQr, setShamcashQr] = useState<string | undefined>();
  const [paymeraWalletId, setPaymeraWalletId] = useState('');
  const [paymeraQr, setPaymeraQr] = useState<string | undefined>();
  const [customFields, setCustomFields] = useState<{ label: string; value: string }[]>([]);

  const [original, setOriginal] = useState<Store | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!storeId) return;
    (async () => {
      const store = await fetchStoreById(storeId);
      if (!store) {
        toastError('تعذر العثور على المتجر');
        router.pop();
        return;
      }
      setOriginal(store);
      setName(store.name);
      setCategory(store.category ?? '');
      setCommercialRegister(store.commercialRegister ?? '');
      setPhone(store.phone ?? '');
      setAddress(store.address ?? '');
      setOpenAt(store.openAt || '08:00');
      setCloseAt(store.closeAt ?? '');
      setNotes(store.notes ?? '');
      if (store.latitude && store.longitude) {
        setPosition({ latitude: store.latitude, longitude: store.longitude });
      }
      setCoverImageUrls(store.coverImageUrls ?? []);
      setSignageImageUrl(store.signageImageUrl);
      setShamcashWalletId(store.shamcashWalletId ?? '');
      setShamcashQr(store.shamcashQrImageUrl);
      setPaymeraWalletId(store.paymeraWalletId ?? '');
      setPaymeraQr(store.paymeraQrImageUrl);
      setCustomFields(
        Object.entries(store.customFields ?? {}).map(([k, v]) => ({
          label: k,
          value: String(v),
        })),
      );
      setLoading(false);
    })();
  }, [storeId, router]);

  const validate = () => {
    const e: Record<string, string | null> = {
      name: nameValidator(name),
      address: address ? addressValidator(address) : null,
      phone: phone ? phoneValidator(phone) : null,
    };
    setErrors(e);
    return isFormValid(e);
  };

  const submit = async () => {
    if (!validate()) {
      toastError('يرجى مراجعة الحقول المحددة');
      return;
    }
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        category: category.trim() || undefined,
        commercialRegister: commercialRegister.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        latitude: position?.latitude,
        longitude: position?.longitude,
        openAt,
        closeAt: closeAt || undefined,
        notes: notes.trim() || undefined,
        coverImageUrls,
        signageImageUrl,
        shamcashWalletId: shamcashWalletId.trim() || undefined,
        shamcashQrImageUrl: shamcashQr,
        paymeraWalletId: paymeraWalletId.trim() || undefined,
        paymeraQrImageUrl: paymeraQr,
        customFields: Object.fromEntries(
          customFields.filter((f) => f.label.trim()).map((f) => [f.label.trim(), f.value.trim()]),
        ),
      };

      if (storeId && original) {
        const removedCover = original.coverImageUrls.filter((p) => !coverImageUrls.includes(p));
        const removedSignage =
          original.signageImageUrl && original.signageImageUrl !== signageImageUrl
            ? [original.signageImageUrl]
            : [];
        const removedShamcash =
          original.shamcashQrImageUrl && original.shamcashQrImageUrl !== shamcashQr
            ? [original.shamcashQrImageUrl]
            : [];
        const removedPaymera =
          original.paymeraQrImageUrl && original.paymeraQrImageUrl !== paymeraQr
            ? [original.paymeraQrImageUrl]
            : [];
        await updateStore(storeId, input);
        const toDelete = [...removedCover, ...removedSignage, ...removedShamcash, ...removedPaymera].filter(
          isStoredPath,
        );
        try {
          await deleteImageObjects(toDelete);
        } catch {
          // تجاهل فشل حذف الصور
        }
        toastSuccess('تم تحديث المتجر بنجاح');
        router.pop();
      } else {
        const created = await createStore(input, profile.id);
        toastSuccess('تم إضافة المتجر بنجاح');
        router.replace({ name: 'store-details', storeId: created.id });
      }
    } catch (err: any) {
      toastError(typeof err === 'string' ? err : 'تعذر حفظ المتجر');
    } finally {
      setSaving(false);
    }
  };

  const folder = useMemo(() => `stores/${profile.id}/`, [profile.id]);

  if (loading) return <CenteredSpinner label="جاري تحميل بيانات المتجر..." />;

  const editable = profile.role === 'manager' || canEditStore(profile);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={storeId ? 'تعديل المتجر' : 'إضافة متجر'}
        subtitle={storeId ? name : 'أدخل بيانات المتجر الجديد'}
        onBack={() => router.pop()}
      />

      {!editable && <p className="mb-4 text-[12px] text-[var(--error)]">ليس لديك صلاحية لتعديل المتاجر.</p>}

      <div className="space-y-5">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
          <div className="flex items-center gap-2">
            <StoreIcon className="w-4 h-4 text-[var(--primary)]" />
            <h3 className="text-[14px] font-bold text-[var(--text)]">البيانات الأساسية</h3>
          </div>
          <TextField
            label="اسم المتجر"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: سوبر ماركت النور"
            error={errors.name}
            disabled={!editable}
          />
          <CategoryAutocomplete
            label="التصنيف / النشاط التجاري"
            value={category}
            onChange={setCategory}
            placeholder="اختر أو اكتب الفئة"
            disabled={!editable}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              label="رقم الهاتف"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xxxxxxxx"
              dir="ltr"
              error={errors.phone}
              disabled={!editable}
            />
            <TextField
              label="السجل التجاري"
              value={commercialRegister}
              onChange={(e) => setCommercialRegister(e.target.value)}
              placeholder="رقم السجل التجاري"
              disabled={!editable}
            />
          </div>
          <TextField
            label="العنوان"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="وصف العنوان"
            error={errors.address}
            disabled={!editable}
          />
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--primary)]" />
            <h3 className="text-[14px] font-bold text-[var(--text)]">ساعات العمل</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="وقت الافتتاح"
              type="time"
              value={openAt}
              onChange={(e) => setOpenAt(e.target.value)}
              disabled={!editable}
            />
            <TextField
              label="وقت الإغلاق"
              type="time"
              value={closeAt}
              onChange={(e) => setCloseAt(e.target.value)}
              disabled={!editable}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          <h3 className="text-[14px] font-bold text-[var(--text)]">الموقع على الخريطة</h3>
          <LocationMap center={position} onSelect={editable ? setPosition : undefined} />
          {position && (
            <p className="text-[12px] text-[var(--text-secondary)] text-center">
              الإحداثيات: {position.latitude.toFixed(5)}، {position.longitude.toFixed(5)}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
          <h3 className="text-[14px] font-bold text-[var(--text)]">الصور</h3>
          <SingleImagePicker
            label="لافتة المتجر"
            value={signageImageUrl}
            onChange={setSignageImageUrl}
            folder={folder}
            hint="صورة اللافتة الأمامية"
          />
          <ImagePicker
            label="صور إضافية"
            value={coverImageUrls}
            onChange={setCoverImageUrls}
            folder={folder}
            max={5}
            hint="حتى 5 صور"
          />
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
          <h3 className="text-[14px] font-bold text-[var(--text)]">محافظ الدفع</h3>
          <WalletFields
            walletName="شام كاش"
            walletId={shamcashWalletId}
            qrImage={shamcashQr}
            onWalletId={setShamcashWalletId}
            onQrImage={setShamcashQr}
            imageFolder={folder}
          />
          <WalletFields
            walletName="بيميرا"
            walletId={paymeraWalletId}
            qrImage={paymeraQr}
            onWalletId={setPaymeraWalletId}
            onQrImage={setPaymeraQr}
            imageFolder={folder}
          />
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          <h3 className="text-[14px] font-bold text-[var(--text)]">حقول مخصصة</h3>
          <CustomFieldsEditor fields={customFields} onChange={editable ? setCustomFields : () => {}} />
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <TextArea
            label="ملاحظات"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="أي معلومات إضافية عن المتجر"
            rows={3}
            disabled={!editable}
          />
        </section>

        {editable && (
          <div className="flex items-center justify-end gap-2 pb-6">
            <Button variant="ghost" onClick={() => router.pop()} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={submit} loading={saving}>
              {storeId ? 'حفظ التعديلات' : 'إضافة المتجر'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}