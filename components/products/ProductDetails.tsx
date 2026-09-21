'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import { useProfile } from '@/components/ProfileContext';
import { fetchProductById, deleteProduct } from '@/lib/data/products';
import { fetchStoreById } from '@/lib/data/stores';
import { getCreatorNames } from '@/lib/data/stores';
import { deleteImageObjects, isStoredPath } from '@/lib/supabase';
import { formatPrice, relativeTime, cn } from '@/lib/utils';
import { toastError, toastSuccess } from '@/lib/toast';
import { PageHeader, Chip, Button, CenteredSpinner } from '@/components/ui/controls';
import { Modal, ConfirmDialog } from '@/components/ui/modals';
import { ResolvedImage } from '@/components/ui/images';
import { Package, Pencil, Trash2, Store as StoreIcon } from 'lucide-react';

export default function ProductDetails({ productId }: { productId: string }) {
  const router = useRouter();
  const profile = useProfile();
  const [product, setProduct] = useState<import('@/lib/types').Product | null>(null);
  const [storeName, setStoreName] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await fetchProductById(productId);
      if (!p) {
        toastError('تعذر العثور على المنتج');
        router.pop();
        return;
      }
      setProduct(p);
      const [store, names] = await Promise.all([fetchStoreById(p.storeId), getCreatorNames([p.createdBy])]);
      setStoreName(store?.name ?? '');
      setCreatorName(names[p.createdBy] ?? '');
      setLoading(false);
    })();
  }, [productId, router]);

  if (loading || !product) return <CenteredSpinner label="جاري تحميل المنتج..." />;

  const editable = profile.role === 'manager' || !!profile.canEdit;
  const deletable = profile.role === 'manager' || !!profile.canDelete;

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteProduct(product.id);
      try {
        await deleteImageObjects(product.imageUrls.filter(isStoredPath));
      } catch {
        // تجاهل
      }
      toastSuccess('تم حذف المنتج بنجاح');
      router.pop();
    } catch (e: any) {
      toastError(typeof e === 'string' ? e : 'تعذر حذف المنتج');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={product.name}
        subtitle={`${storeName || ''} • أُنشئ بواسطة ${creatorName || 'مستخدم'} • آخر تحديث ${relativeTime(product.updatedAt)}`}
        onBack={() => router.pop()}
        trailing={
          <div className="flex items-center gap-2">
            {editable && (
              <Button variant="secondary" size="sm" onClick={() => router.push({ name: 'product-form', storeId: product.storeId, productId: product.id })} icon={<Pencil className="w-4 h-4" />}>
                تعديل
              </Button>
            )}
            {deletable && (
              <Button variant="surface" size="sm" onClick={() => setShowDelete(true)} icon={<Trash2 className="w-4 h-4 text-[var(--error)]" />}>
                حذف
              </Button>
            )}
          </div>
        }
      />

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden mb-5">
        <div className="h-64 bg-[var(--surface-variant)] relative">
          <button
            type="button"
            onClick={() => product.imageUrls.length > 0 && setViewerIndex(0)}
            className={cn('block w-full h-full', product.imageUrls.length > 0 && 'cursor-zoom-in')}
          >
            <ResolvedImage src={product.imageUrls[0]} alt={product.name} className="w-full h-full" />
          </button>
          {product.isBestSeller && (
            <span className="absolute top-3 start-3">
              <Chip tone="orange" label="الأنسب مبيعاً" />
            </span>
          )}
        </div>
        <div className="p-4">
          <p className="text-[20px] font-bold text-[var(--primary)]" dir="ltr">
            {formatPrice(product.price, product.currency)}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {product.category && <Chip tone="primary" label={product.category} />}
            <Chip tone="neutral" icon={<StoreIcon className="w-3 h-3" />} label={storeName || 'متجر'} />
          </div>
        </div>
      </div>

      {product.imageUrls.length > 1 && (
        <div className="mb-5">
          <h3 className="text-[13px] font-bold text-[var(--text)] mb-2">معرض الصور</h3>
          <div className="flex gap-2 overflow-x-auto py-1">
            {product.imageUrls.map((u, i) => (
              <button key={i} type="button" onClick={() => setViewerIndex(i)} className="w-16 h-16 shrink-0 rounded-xl overflow-hidden border border-[var(--border)]">
                <ResolvedImage src={u} alt="" className="w-full h-full" />
              </button>
            ))}
          </div>
        </div>
      )}

      {product.description && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 mb-5">
          <h3 className="text-[13px] font-bold text-[var(--text)] mb-1.5">الوصف</h3>
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">{product.description}</p>
        </div>
      )}

      <ImageGallery images={product.imageUrls} index={viewerIndex} onClose={(i) => setViewerIndex(i)} />

      <ConfirmDialog
        open={showDelete}
        title="حذف المنتج"
        confirmText="حذف"
        loading={deleting}
        onClose={() => setShowDelete(false)}
        onConfirm={confirmDelete}
      >
        <p className="text-[13px] text-[var(--text-secondary)]">
          هل أنت متأكد من حذف المنتج «{product.name}»؟ لا يمكن التراجع عن هذا الإجراء.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function ImageGallery({ images, index, onClose }: { images: string[]; index: number | null; onClose: (i: number | null) => void }) {
  const step = (d: number) => {
    if (index === null) return;
    onClose((index + d + images.length) % images.length);
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