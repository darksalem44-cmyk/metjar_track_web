'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import { useProfile } from '@/components/ProfileContext';
import { fetchAllProducts } from '@/lib/data/products';
import { fetchStores, fetchStoreById } from '@/lib/data/stores';
import { fetchBranchById } from '@/lib/data/branches';
import type { Product, Store } from '@/lib/types';
import { PAGE_SIZE } from '@/lib/data/base';
import { toastError } from '@/lib/toast';
import { formatPrice } from '@/lib/utils';
import { Plus, Package, ChevronLeft, Store as StoreIcon } from 'lucide-react';
import { Button, Chip, CenteredSpinner, EmptyState, PageHeader } from '@/components/ui/controls';
import { SearchField } from '@/components/ui/fields';
import { Modal } from '@/components/ui/modals';
import { ResolvedImage } from '@/components/ui/images';

interface Scope {
  type: 'all' | 'store' | 'branch';
  storeId?: string;
  branchId?: string;
}

export default function ProductsPage({ scope }: { scope: Scope }) {
  const router = useRouter();
  const profile = useProfile();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [title, setTitle] = useState('المنتجات');
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const queryRef = useRef('');

  const isMerchant = profile.role === 'merchant';
  const canAdd = profile.role === 'manager' || !!profile.canEdit;

  useEffect(() => {
    (async () => {
      if (scope.type === 'store' && scope.storeId) {
        const s = await fetchStoreById(scope.storeId);
        if (s) setTitle(`منتجات ${s.name}`);
      } else if (scope.type === 'branch' && scope.branchId) {
        const b = await fetchBranchById(scope.branchId);
        if (b) setTitle(`منتجات ${b.name}`);
      } else {
        setTitle(isMerchant ? 'منتجاتي' : 'المنتجات');
      }
    })();
  }, [scope, isMerchant]);

  const load = useCallback(
    async (pg: number, q: string, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        let storeFilter: string[] | undefined;
        if (scope.type === 'all' && isMerchant) {
          const res = await fetchStores({ page: 0, pageSize: 200, createdBy: profile.id });
          storeFilter = res.items.map((s) => s.id);
          if (storeFilter.length === 0) {
            setProducts([]);
            setHasMore(false);
            setPage(pg);
            setLoading(false);
            return;
          }
        }
        const res = await fetchAllProducts({
          page: pg,
          pageSize: PAGE_SIZE,
          search: q,
          storeIds: storeFilter,
          storeId: scope.type === 'store' ? scope.storeId : undefined,
          branchId: scope.type === 'branch' ? scope.branchId : undefined,
        });
        if (append) setProducts((prev) => [...prev, ...res.items]);
        else setProducts(res.items);
        setHasMore(res.hasMore);
        setPage(pg);
      } catch (e: any) {
        toastError(typeof e === 'string' ? e : 'تعذر تحميل المنتجات');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [scope.type, scope.storeId, scope.branchId, isMerchant, profile.id],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      const q = search.trim();
      if (q !== queryRef.current || page === 0) {
        queryRef.current = q;
        load(0, q, false);
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, load]);

  const loadMore = () => load(page + 1, queryRef.current, true);

  const openAdd = () => {
    if (scope.type === 'store' && scope.storeId) {
      router.push({ name: 'product-form', storeId: scope.storeId });
      return;
    }
    if (scope.type === 'branch' && scope.storeId) {
      router.push({ name: 'product-form', storeId: scope.storeId });
      return;
    }
    setStorePickerOpen(true);
  };

  const openPicker = async () => {
    setStorePickerOpen(true);
    const res = await fetchStores({ page: 0, pageSize: 200, createdBy: isMerchant ? profile.id : undefined });
    setStores(res.items);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={title}
        onBack={scope.type === 'all' ? undefined : () => router.pop()}
        trailing={
          canAdd && (
            <Button onClick={openAdd} icon={<Plus className="w-4 h-4" />}>
              إضافة منتج
            </Button>
          )
        }
      />

      <div className="mb-5">
        <SearchField value={search} onChange={setSearch} placeholder="بحث عن منتج بالاسم..." className="max-w-md" />
      </div>

      {loading && page === 0 ? (
        <CenteredSpinner label="جاري تحميل المنتجات..." />
      ) : products.length === 0 ? (
        <EmptyState
          icon={<Package className="w-6 h-6" />}
          title={search ? 'لا توجد نتائج مطابقة' : 'لا توجد منتجات'}
          subtitle={search ? 'جرّب كلمات بحث مختلفة' : 'أضف منتجاً جديداً'}
          action={!search && canAdd && <Button onClick={openAdd} icon={<Plus className="w-4 h-4" />}>إضافة منتج</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push({ name: 'product-details', productId: p.id })}
                className="text-start rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--primary-light)] hover:shadow-sm transition-all"
              >
                <div className="h-32 bg-[var(--surface-variant)] relative">
                  <ResolvedImage src={p.imageUrls[0]} alt={p.name} className="w-full h-full" />
                  {p.isBestSeller && (
                    <span className="absolute top-2 start-2">
                      <Chip tone="orange" label="الأنسب مبيعاً" />
                    </span>
                  )}
                </div>
                <div className="p-3.5">
                  <p className="text-[13px] font-bold text-[var(--text)] truncate">{p.name}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[13px] font-bold text-[var(--primary)]" dir="ltr">
                      {formatPrice(p.price, p.currency)}
                    </span>
                    <ChevronLeft className="w-3.5 h-3.5 text-[var(--text-muted)] rotate-180" />
                  </div>
                </div>
              </button>
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center py-4">
              <Button variant="surface" size="sm" onClick={loadMore} loading={loadingMore}>
                تحميل المزيد
              </Button>
            </div>
          )}
        </>
      )}

      <Modal open={storePickerOpen} onClose={() => setStorePickerOpen(false)} title="اختر المتجر">
        <p className="text-[12px] text-[var(--text-secondary)] mb-3">اختر المتجر الذي تريد إضافة المنتج إليه:</p>
        {stores.length === 0 ? (
          <p className="text-[12px] text-[var(--text-muted)]">لا توجد متاجر متاحة.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pe-1">
            {stores.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setStorePickerOpen(false);
                  router.push({ name: 'product-form', storeId: s.id });
                }}
                className="w-full flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-start hover:border-[var(--primary-light)]"
              >
                <span className="grid place-items-center w-9 h-9 rounded-lg bg-[var(--primary-surface)] text-[var(--primary)]">
                  <StoreIcon className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-[var(--text)] truncate">{s.name}</span>
                  <span className="block text-[11px] text-[var(--text-secondary)] truncate">{s.address || s.category || ''}</span>
                </span>
                <ChevronLeft className="w-4 h-4 text-[var(--text-muted)] rotate-180" />
              </button>
            ))}
          </div>
        )}
        <Button variant="ghost" size="sm" className="w-full mt-3" onClick={() => setStorePickerOpen(false)}>
          إلغاء
        </Button>
      </Modal>
    </div>
  );
}