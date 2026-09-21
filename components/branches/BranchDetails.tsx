'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import { useProfile } from '@/components/ProfileContext';
import { fetchBranchById, deleteBranch } from '@/lib/data/branches';
import { fetchStoreById, getCreatorNames } from '@/lib/data/stores';
import { fetchProductsByBranch } from '@/lib/data/products';
import type { Branch, Product } from '@/lib/types';
import { deleteImageObjects, filterStoredPaths } from '@/lib/supabase';
import { relativeTime, formatPrice } from '@/lib/utils';
import { toastError, toastSuccess } from '@/lib/toast';
import { PageHeader, Chip, Button, CenteredSpinner, EmptyState } from '@/components/ui/controls';
import { Modal, ConfirmDialog } from '@/components/ui/modals';
import { TextField } from '@/components/ui/fields';
import { ResolvedImage, ImageRow } from '@/components/ui/images';
import QuickAddProduct from '@/components/products/QuickAddProduct';
import { Phone, MapPin, Clock, Pencil, Trash2, Split, Hash, Package, Plus, Wallet, Copy } from 'lucide-react';

export default function BranchDetails({ storeId, branchId }: { storeId: string; branchId: string }) {
  const router = useRouter();
  const profile = useProfile();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [storeName, setStoreName] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteName, setDeleteName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showWallets, setShowWallets] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const b = await fetchBranchById(branchId);
        if (!b) {
          toastError('تعذر العثور على الفرع');
          router.pop();
          return;
        }
        const [store, names, pr] = await Promise.all([
          fetchStoreById(storeId),
          getCreatorNames([b.createdBy]),
          fetchProductsByBranch(branchId, 100),
        ]);
        setBranch(b);
        setStoreName(store?.name ?? '');
        setCreatorName(names[b.createdBy] ?? '');
        setProducts(pr);
      } catch (e: any) {
        toastError(typeof e === 'string' ? e : 'تعذر تحميل الفرع');
      } finally {
        setLoading(false);
      }
    })();
  }, [branchId, storeId, router]);

  if (loading || !branch) return <CenteredSpinner label="جاري تحميل الفرع..." />;

  const editable = profile.role === 'manager' || !!profile.canEdit;
  const deletable = profile.role === 'manager' || !!profile.canDelete;

  const confirmDelete = async () => {
    if (deleteName.trim() !== branch.name) {
      toastError('اسم الفرع غير مطابق. تأكد من كتابته بشكل صحيح.');
      return;
    }
    setDeleting(true);
    try {
      await deleteBranch(branch.id, deleteName.trim());
      const toDelete = filterStoredPaths([...(branch.coverImageUrls ?? []), branch.signageImageUrl, branch.shamcashQrImageUrl, branch.paymeraQrImageUrl]);
      try { await deleteImageObjects(toDelete); } catch { /* تجاهل */ }
      toastSuccess('تم حذف الفرع بنجاح');
      router.pop();
    } catch (err: any) {
      toastError(typeof err === 'string' ? err : 'تعذر حذف الفرع');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={branch.name}
        subtitle={`${storeName} • أُنشئ بواسطة ${creatorName || 'مستخدم'} • آخر تحديث ${relativeTime(branch.updatedAt)}`}
        onBack={() => router.pop()}
        trailing={
          <div className="flex items-center gap-2">
            {editable && (
              <Button variant="secondary" size="sm" onClick={() => router.push({ name: 'branch-form', storeId, branchId: branch.id })} icon={<Pencil className="w-4 h-4" />}>
                تعديل
              </Button>
            )}
            {deletable && (
              <Button variant="surface" size="sm" onClick={() => setShowDelete(true)} icon={<Trash2 className="w-4 h-4 text-[var(--error)]" />}>حذف</Button>
            )}
          </div>
        }
      />

      <div className="rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface-variant)] mb-5 h-52">
        <ResolvedImage src={branch.signageImageUrl ?? branch.coverImageUrls[0]} alt={branch.name} className="w-full h-full" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {branch.branchCode && <Chip tone="purple" icon={<Hash className="w-3 h-3" />} label={`الرمز ${branch.branchCode}`} />}
        <Chip tone={branch.isActive ? 'success' : 'warning'} label={branch.isActive ? 'الفرع نشط' : 'الفرع معطّل'} />
        {branch.category && <Chip tone="primary" label={branch.category} />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {branch.phone && (
          <InfoTile icon={<Phone className="w-4 h-4" />} label="الهاتف" value={<span dir="ltr">{branch.phone}</span>} copy={branch.phone} />
        )}
        {branch.address && <InfoTile icon={<MapPin className="w-4 h-4" />} label="العنوان" value={branch.address} />}
        {(branch.openAt || branch.closeAt) && (
          <InfoTile icon={<Clock className="w-4 h-4" />} label="ساعات العمل" value={`${branch.openAt || '—'} - ${branch.closeAt || '—'}`} />
        )}
      </div>

      {branch.coverImageUrls.length > 0 && (
        <div className="mb-5">
          <h3 className="text-[13px] font-bold text-[var(--text)] mb-2">صور إضافية</h3>
          <ImageRow value={branch.coverImageUrls} onOpen={setViewerIndex} />
        </div>
      )}

      {(branch.shamcashWalletId || branch.paymeraWalletId) && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] mb-5 overflow-hidden">
          <button onClick={() => setShowWallets(!showWallets)} className="w-full flex items-center justify-between p-4">
            <span className="flex items-center gap-2 text-[14px] font-bold text-[var(--text)]">
              <Wallet className="w-4 h-4 text-[var(--accent)]" />
              محافظ الدفع
            </span>
            <span className="text-[var(--text-muted)]">{showWallets ? 'إغلاق' : 'عرض'}</span>
          </button>
          {showWallets && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-4 pb-4">
              {branch.shamcashWalletId && <WalletTile name="شام كاش" walletId={branch.shamcashWalletId} qr={branch.shamcashQrImageUrl} />}
              {branch.paymeraWalletId && <WalletTile name="بيميرا" walletId={branch.paymeraWalletId} qr={branch.paymeraQrImageUrl} />}
            </div>
          )}
        </div>
      )}

      {Object.keys(branch.customFields ?? {}).length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 mb-5">
          <h3 className="text-[13px] font-bold text-[var(--text)] mb-3">بيانات إضافية</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Object.entries(branch.customFields).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-[var(--input)] border border-[var(--border)] px-3 py-2">
                <p className="text-[11px] text-[var(--text-secondary)]">{k}</p>
                <p className="text-[13px] font-semibold text-[var(--text)] break-words">{String(v)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {branch.notes && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 mb-5">
          <h3 className="text-[13px] font-bold text-[var(--text)] mb-1.5">ملاحظات</h3>
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{branch.notes}</p>
        </div>
      )}

      {/* منتجات الفرع */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] mb-5 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <span className="flex items-center gap-2 text-[14px] font-bold text-[var(--text)]">
            <Package className="w-4 h-4 text-[var(--accent)]" />
            منتجات الفرع
            <Chip tone="neutral" label={products.length} />
          </span>
          <div className="flex items-center gap-2">
            {editable && (
              <Button variant="secondary" size="sm" onClick={() => setShowQuickAdd(true)} icon={<Plus className="w-4 h-4" />}>
                إضافة سريعة
              </Button>
            )}
            <Button variant="surface" size="sm" onClick={() => router.push({ name: 'products', scope: { type: 'branch', storeId, branchId } })}>
              عرض الكل
            </Button>
          </div>
        </div>
        {products.length === 0 ? (
          <EmptyState icon={<Package className="w-6 h-6" />} title="لا توجد منتجات" subtitle="أضف منتجات لهذا الفرع" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {products.slice(0, 5).map((p) => (
              <button key={p.id} onClick={() => router.push({ name: 'product-details', productId: p.id })} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 text-start hover:border-[var(--primary-light)]">
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

      <Modal open={viewerIndex !== null} onClose={() => setViewerIndex(null)} title="الصورة">
        {viewerIndex !== null && branch.coverImageUrls[viewerIndex] && (
          <ResolvedImage src={branch.coverImageUrls[viewerIndex]} alt="" className="w-full max-h-[65vh] object-contain rounded-xl" />
        )}
      </Modal>

      <ConfirmDialog
        open={showDelete}
        title="حذف الفرع"
        confirmText="حذف نهائي"
        loading={deleting}
        onClose={() => setShowDelete(false)}
        onConfirm={confirmDelete}
      >
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
          سيتم تعطيل الفرع «{branch.name}». لن يتم حذف البيانات نهائياً.
        </p>
        <TextField label="اكتب اسم الفرع للتأكيد" value={deleteName} onChange={(e) => setDeleteName(e.target.value)} placeholder={branch.name} className="mt-3" />
      </ConfirmDialog>

      <QuickAddProduct
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        storeId={storeId}
        branchId={branchId}
        onAdded={() => {
          setShowQuickAdd(false);
          fetchProductsByBranch(branchId, 100).then(setProducts);
        }}
      />
    </div>
  );
}

function InfoTile({ icon, label, value, copy }: { icon: React.ReactNode; label: string; value: React.ReactNode; copy?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
      <span className="grid place-items-center w-8 h-8 rounded-lg bg-[var(--primary-surface-light)] text-[var(--primary)] shrink-0">{icon}</span>
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