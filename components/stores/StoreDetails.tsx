'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import { useProfile } from '@/components/ProfileContext';
import { fetchStoreById, getCreatorNames, canEditStore, canDeleteStore, deleteStore } from '@/lib/data/stores';
import { fetchBranchesByStore } from '@/lib/data/branches';
import { fetchProductsByStore, countProductsByStore } from '@/lib/data/products';
import type { Branch, Product } from '@/lib/types';
import { deleteImageObjects, filterStoredPaths } from '@/lib/supabase';
import { relativeTime, formatPrice } from '@/lib/utils';
import { toastError, toastSuccess } from '@/lib/toast';
import { PageHeader, Chip, Button, CenteredSpinner, EmptyState } from '@/components/ui/controls';
import { Modal, ConfirmDialog } from '@/components/ui/modals';
import { TextField } from '@/components/ui/fields';
import { ResolvedImage, ImageRow } from '@/components/ui/images';
import QuickAddProduct from '@/components/products/QuickAddProduct';
import {
  Phone,
  MapPin,
  Clock,
  FileText,
  QrCode,
  Pencil,
  Trash2,
  Wallet,
  Plus,
  ChevronLeft,
  Store as StoreIcon,
  Split,
  Package,
  Building2,
  Copy,
  Navigation,
} from 'lucide-react';

export default function StoreDetails({ storeId }: { storeId: string }) {
  const router = useRouter();
  const profile = useProfile();
  const [store, setStore] = useState<ReturnType<typeof fetchStoreById> extends Promise<infer T> ? (T extends null ? null : NonNullable<T>) : null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [creatorName, setCreatorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteName, setDeleteName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showWallets, setShowWallets] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await fetchStoreById(storeId);
      if (!s) {
        toastError('تعذر العثور على المتجر');
        router.pop();
        return;
      }
      setStore(s);
      const [br, pr, count, names] = await Promise.all([
        fetchBranchesByStore(s.id),
        fetchProductsByStore(s.id, 100),
        countProductsByStore(s.id),
        getCreatorNames([s.createdBy]),
      ]);
      setBranches(br);
      setProducts(pr);
      setProductCount(count);
      setCreatorName(names[s.createdBy] ?? '');
      setLoading(false);
    })();
  }, [storeId, router]);

  if (loading || !store) return <CenteredSpinner label="جاري تحميل المتاجر..." />;

  const editable = profile.role === 'manager' || canEditStore(profile);
  const deletable = profile.role === 'manager' || canDeleteStore(profile);

  const confirmDelete = async () => {
    if (deleteName.trim() !== store.name) {
      toastError('اسم المتجر غير مطابق. تأكد من كتابته بشكل صحيح.');
      return;
    }
    setDeleting(true);
    try {
      await deleteStore(store.id, deleteName.trim());
      const toDelete = filterStoredPaths([
        ...(store.coverImageUrls ?? []),
        store.signageImageUrl,
        store.shamcashQrImageUrl,
        store.paymeraQrImageUrl,
      ]);
      try {
        await deleteImageObjects(toDelete);
      } catch {
        // تجاهل فشل حذف الصور
      }
      toastSuccess('تم حذف المتجر بنجاح');
      router.pop();
    } catch (err: any) {
      toastError(typeof err === 'string' ? err : 'تعذر حذف المتجر');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={store.name}
        subtitle={`أُنشئ بواسطة ${creatorName || 'مستخدم'} • آخر تحديث ${relativeTime(store.updatedAt)}`}
        onBack={() => router.pop()}
        trailing={
          <div className="flex items-center gap-2">
            <Button
              variant="surface"
              size="sm"
              onClick={() => router.push({ name: 'store-qr', storeId: store.id })}
              icon={<QrCode className="w-4 h-4" />}
            >
              رمز QR
            </Button>
            {editable && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push({ name: 'store-form', storeId: store.id })}
                icon={<Pencil className="w-4 h-4" />}
              >
                تعديل
              </Button>
            )}
            {deletable && (
              <Button variant="surface" size="sm" onClick={() => setShowDelete(true)} icon={<Trash2 className="w-4 h-4 text-[var(--error)]}" />}>
                حذف
              </Button>
            )}
          </div>
        }
      />

      {/* صورة المتجر */}
      <div className="rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface-variant)] mb-5 h-56">
        <ResolvedImage src={store.signageImageUrl ?? store.coverImageUrls[0]} alt={store.name} className="w-full h-full" />
      </div>

      {/* التصنيف */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Chip tone="neutral" icon={<StoreIcon className="w-3 h-3" />} label="نوع المتجر" />
        {store.category && <Chip tone="primary" label={store.category} />}
        {store.actualDistance && store.actualDistance > 0 && (
          <Chip tone="orange" icon={<Navigation className="w-3 h-3" />} label={store.actualDistance < 1000 ? `${store.actualDistance.toFixed(0)} م` : `${(store.actualDistance / 1000).toFixed(1)} كم`} />
        )}
      </div>

      {/* المعلومات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {store.phone && (
          <InfoTile icon={<Phone className="w-4 h-4" />} label="الهاتف" value={<span dir="ltr">{store.phone}</span>} copy={store.phone} />
        )}
        {store.address && <InfoTile icon={<MapPin className="w-4 h-4" />} label="العنوان" value={store.address} />}
        {store.commercialRegister && (
          <InfoTile icon={<FileText className="w-4 h-4" />} label="السجل التجاري" value={<span dir="ltr">{store.commercialRegister}</span>} copy={store.commercialRegister} />
        )}
        {(store.openAt || store.closeAt) && (
          <InfoTile
            icon={<Clock className="w-4 h-4" />}
            label="ساعات العمل"
            value={`${store.openAt || '—'} - ${store.closeAt || '—'}`}
          />
        )}
      </div>

      {store.coverImageUrls.length > 0 && (
        <div className="mb-5">
          <h3 className="text-[13px] font-bold text-[var(--text)] mb-2">صور إضافية</h3>
          <ImageRow value={store.coverImageUrls} onOpen={setViewerIndex} />
        </div>
      )}

      {/* المحافظ */}
      {(store.shamcashWalletId || store.shamcashQrImageUrl || store.paymeraWalletId || store.paymeraQrImageUrl) && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] mb-5 overflow-hidden">
          <button
            onClick={() => setShowWallets(!showWallets)}
            className="w-full flex items-center justify-between p-4"
          >
            <span className="flex items-center gap-2 text-[14px] font-bold text-[var(--text)]">
              <Wallet className="w-4 h-4 text-[var(--accent)]" />
              محافظ الدفع
            </span>
            <span className="text-[var(--text-muted)]">{showWallets ? 'إغلاق' : 'عرض'}</span>
          </button>
          {showWallets && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-4 pb-4">
              {store.shamcashWalletId && (
                <WalletTile name="شام كاش" walletId={store.shamcashWalletId} qr={store.shamcashQrImageUrl} />
              )}
              {store.paymeraWalletId && (
                <WalletTile name="بيميرا" walletId={store.paymeraWalletId} qr={store.paymeraQrImageUrl} />
              )}
            </div>
          )}
        </div>
      )}

      {/* الحقول المخصصة */}
      {Object.keys(store.customFields ?? {}).length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 mb-5">
          <h3 className="text-[13px] font-bold text-[var(--text)] mb-3">بيانات إضافية</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Object.entries(store.customFields).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-[var(--input)] border border-[var(--border)] px-3 py-2">
                <p className="text-[11px] text-[var(--text-secondary)]">{k}</p>
                <p className="text-[13px] font-semibold text-[var(--text)] break-words">{String(v)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {store.notes && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 mb-5">
          <h3 className="text-[13px] font-bold text-[var(--text)] mb-1.5">ملاحظات</h3>
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{store.notes}</p>
        </div>
      )}

      {/* الفروع */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] mb-5 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <span className="flex items-center gap-2 text-[14px] font-bold text-[var(--text)]">
            <Split className="w-4 h-4 text-[var(--primary)]" />
            الفروع
            <Chip tone="neutral" label={branches.length} />
          </span>
          <div className="flex items-center gap-2">
            <Button variant="surface" size="sm" onClick={() => router.push({ name: 'branches', storeId: store.id })}>
              عرض الكل
            </Button>
          </div>
        </div>
        {branches.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-6 h-6" />}
            title="لا توجد فروع"
            subtitle="أضف فروعاً لهذا المتجر"
            action={editable && <Button size="sm" onClick={() => router.push({ name: 'branch-form', storeId: store.id })} icon={<Plus className="w-4 h-4" />}>إضافة فرع</Button>}
          />
        ) : (
          <div className="p-3 space-y-2">
            {branches.slice(0, 3).map((b) => (
              <button
                key={b.id}
                onClick={() => router.push({ name: 'branch-details', storeId: store.id, branchId: b.id })}
                className="w-full flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-start hover:border-[var(--primary-light)]"
              >
                <span className="grid place-items-center w-9 h-9 rounded-lg bg-[var(--primary-surface)] text-[var(--primary)] shrink-0">
                  <Split className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-[var(--text)] truncate">{b.name}</span>
                  <span className="block text-[11px] text-[var(--text-secondary)] truncate">
                    {b.branchCode ? `الرمز ${b.branchCode} • ` : ''}{b.phone || b.address || 'بدون تفاصيل'}
                  </span>
                </span>
                <Chip tone={b.isActive ? 'success' : 'warning'} label={b.isActive ? 'نشط' : 'معطّل'} />
                <ChevronLeft className="w-4 h-4 text-[var(--text-muted)] rotate-180" />
              </button>
            ))}
            {editable && branches.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => router.push({ name: 'branch-form', storeId: store.id })} icon={<Plus className="w-4 h-4" />}>
                إضافة فرع
              </Button>
            )}
          </div>
        )}
      </div>

      {/* المنتجات */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] mb-5 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <span className="flex items-center gap-2 text-[14px] font-bold text-[var(--text)]">
            <Package className="w-4 h-4 text-[var(--accent)]" />
            المنتجات
            <Chip tone="neutral" label={productCount} />
          </span>
          <div className="flex items-center gap-2">
            {editable && (
              <Button variant="secondary" size="sm" onClick={() => setShowQuickAdd(true)} icon={<Plus className="w-4 h-4" />}>
                إضافة سريعة
              </Button>
            )}
            <Button variant="surface" size="sm" onClick={() => router.push({ name: 'products', scope: { type: 'store', storeId: store.id } })}>
              عرض الكل
            </Button>
          </div>
        </div>
        {products.length === 0 ? (
          <EmptyState
            icon={<Package className="w-6 h-6" />}
            title="لا توجد منتجات"
            subtitle="أضف منتجاتك لتظهر هنا"
            action={editable && <Button size="sm" onClick={() => setShowQuickAdd(true)} icon={<Plus className="w-4 h-4" />}>إضافة منتج</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {products.slice(0, 5).map((p) => (
              <button
                key={p.id}
                onClick={() => router.push({ name: 'product-details', productId: p.id })}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 text-start hover:border-[var(--primary-light)]"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--surface-variant)] shrink-0">
                  <ResolvedImage src={p.imageUrls[0]} alt={p.name} className="w-full h-full" />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-bold text-[var(--text)] truncate">{p.name}</span>
                  {p.isBestSeller && <Chip tone="orange" label="الأنسب مبيعاً" className="mt-0.5" />}
                </span>
                <span className="text-[12px] font-bold text-[var(--primary)]">{formatPrice(p.price, p.currency)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* معاينة الصور */}
      <ImageGallery images={store.coverImageUrls} index={viewerIndex} onClose={(i) => setViewerIndex(i)} />

      {/* حذف */}
      <ConfirmDialog
        open={showDelete}
        title="حذف المتجر"
        confirmText="حذف نهائي"
        loading={deleting}
        onClose={() => setShowDelete(false)}
        onConfirm={confirmDelete}
      >
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
          سيتم تعطيل المتجر «{store.name}». لن يتم حذف البيانات نهائياً.
        </p>
        <TextField
          label="اكتب اسم المتجر للتأكيد"
          value={deleteName}
          onChange={(e) => setDeleteName(e.target.value)}
          placeholder={store.name}
          className="mt-3"
        />
      </ConfirmDialog>

      <QuickAddProduct open={showQuickAdd} onClose={() => setShowQuickAdd(false)} storeId={store.id} onAdded={() => {
        setShowQuickAdd(false);
        fetchProductsByStore(store.id, 100).then(setProducts).then(() => countProductsByStore(store.id).then(setProductCount));
      }} />
    </div>
  );
}

function ImageGallery({ images, index, onClose }: { images: string[]; index: number | null; onClose: (i: number | null) => void }) {
  const step = (d: number) => {
    if (index === null) return;
    onClose(((index + d + images.length) % images.length));
  };
  return (
    <Modal open={index !== null} onClose={() => onClose(null)} title="عرض الصورة">
      {index !== null && images[index] && (
        <div className="flex items-center gap-2">
          {images.length > 1 && (
            <button onClick={() => step(-1)} className="btn-nav">‹</button>
          )}
          <ResolvedImage src={images[index]} alt="" className="w-full max-h-[65vh] object-contain rounded-xl" />
          {images.length > 1 && (
            <button onClick={() => step(1)} className="btn-nav">›</button>
          )}
        </div>
      )}
    </Modal>
  );
}

function InfoTile({ icon, label, value, copy }: { icon: React.ReactNode; label: string; value: React.ReactNode; copy?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
      <span className="grid place-items-center w-8 h-8 rounded-lg bg-[var(--primary-surface-light)] text-[var(--primary)] shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-[var(--text-secondary)]">{label}</p>
        <p className="text-[13px] font-semibold text-[var(--text)] break-words flex items-center gap-1.5">
          {value}
          {copy && <Copy className="w-3 h-3 text-[var(--text-muted)] cursor-pointer" onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(copy); }} />}
        </p>
      </div>
    </div>
  );
}

function WalletTile({ name, walletId, qr }: { name: string; walletId: string; qr?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--input)] p-3">
      <p className="text-[13px] font-bold text-[var(--text)]">{name}</p>
      <p className="text-[12px] text-[var(--text-secondary)] mt-0.5" dir="ltr">{walletId}</p>
      {qr && (
        <div className="mt-2 w-20 h-20 rounded-lg bg-white p-0.5 overflow-hidden">
          <ResolvedImage src={qr} alt={`${name} QR`} className="w-full h-full" />
        </div>
      )}
    </div>
  );
}
