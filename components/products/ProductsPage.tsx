'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import { useProfile } from '@/components/ProfileContext';
import { fetchAllProducts, countAllProducts } from '@/lib/data/products';
import { fetchStores, fetchStoreById } from '@/lib/data/stores';
import { fetchBranchById } from '@/lib/data/branches';
import type { Product, Store } from '@/lib/types';
import { PAGE_SIZE } from '@/lib/data/base';
import { cacheKey, cachedLoad } from '@/lib/cache';
import { toastError } from '@/lib/toast';
import { cn, formatPrice } from '@/lib/utils';
import { Plus, Package, ChevronRight, ChevronDown, Check, Store as StoreIcon } from 'lucide-react';
import { Button, Chip, CenteredSpinner, EmptyState, PageHeader, PaginationFooter } from '@/components/ui/controls';
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
  /** عدد الصفحات الكلي المحسوب من count:'exact' — أساس المؤشر المرقّم */
  const [totalPages, setTotalPages] = useState<number | null>(null);
  /** الإجمالي الكلي للمنتجات حسب النطاق/الفلتر الحالي — يُعرض في الترويسة */
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [title, setTitle] = useState('المنتجات');
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [filterStores, setFilterStores] = useState<Store[]>([]);
  const [storeFilterId, setStoreFilterId] = useState('');
  const [storeFilterOpen, setStoreFilterOpen] = useState(false);
  const [storeFilterSearch, setStoreFilterSearch] = useState('');
  const queryRef = useRef('');
  const storesCacheRef = useRef<Store[] | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const isMerchant = profile.role === 'merchant';
  // إضافة المنتجات متاحة لكل الأدوار (كما في الموبايل): الموظف والمدير لأي متجر،
  // والتاجر لمتاجره فقط عبر منتقي المتاجر المقيّد بمتاجره.
  const canAdd = true;

  const ensureStores = useCallback(async (): Promise<Store[]> => {
    if (storesCacheRef.current) return storesCacheRef.current;
    const res = await fetchStores({ page: 0, pageSize: 200, createdBy: isMerchant ? profile.id : undefined });
    storesCacheRef.current = res.items;
    setFilterStores(res.items);
    return res.items;
  }, [isMerchant, profile.id]);

  useEffect(() => {
    (async () => {
      if (scope.type === 'store' && scope.storeId) {
        const s = await fetchStoreById(scope.storeId);
        if (s && aliveRef.current) setTitle(`منتجات ${s.name}`);
      } else if (scope.type === 'branch' && scope.branchId) {
        const b = await fetchBranchById(scope.branchId);
        if (b && aliveRef.current) setTitle(`منتجات ${b.name}`);
      } else if (aliveRef.current) {
        setTitle(isMerchant ? 'منتجاتي' : 'المنتجات');
      }
    })();
  }, [scope, isMerchant]);

  // قائمة الشركات (المتاجر) المتاحة للفلترة عند عرض كل المنتجات
  useEffect(() => {
    if (scope.type !== 'all') {
      setFilterStores([]);
      setStoreFilterId('');
      setStoreFilterOpen(false);
      setStoreFilterSearch('');
      return;
    }
    ensureStores()
      .then((list) => setFilterStores(list))
      .catch(() => setFilterStores([]));
  }, [scope.type, ensureStores]);

  const load = useCallback(
    async (pg: number, q: string, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      // ':live:1' يميّز مفاتيح ما بعد فلترة المتاجر المحذوفة ناعماً — فيُبطل
      // أي كاش قديم كان قد يحوي منتجات متاجر محذوفة.
      const pageKey = cacheKey(
        'products',
        `page${pg}:q:${q}:scope:${scope.type}:${scope.storeId ?? ''}:${scope.branchId ?? ''}:sf:${storeFilterId}:u:${isMerchant ? profile.id : 'all'}:live:1`,
      );
      try {
        await cachedLoad(
          pageKey,
          async () => {
            let storeFilter: string[] | undefined;
            if (scope.type === 'all' && isMerchant) {
              const ownStores = await ensureStores();
              storeFilter = ownStores.map((s) => s.id);
              if (storeFilter.length === 0) {
                return { items: [], hasMore: false } as { items: Product[]; hasMore: boolean };
              }
            }
            return fetchAllProducts({
              page: pg,
              pageSize: PAGE_SIZE,
              search: q,
              storeIds: storeFilter,
              storeId: storeFilterId || (scope.type === 'store' ? scope.storeId : undefined),
              branchId: scope.type === 'branch' ? scope.branchId : undefined,
            });
          },
          (res, source) => {
            if (!aliveRef.current) return;
            if (append && source === 'cache') return; // الكاش لا يُلحق بصفحة محمّلة
            if (append)
              setProducts((prev) => {
                const seen = new Set(prev.map((p) => p.id));
                return [...prev, ...res.items.filter((p) => !seen.has(p.id))];
              });
            else setProducts(res.items);
            setHasMore(res.hasMore);
            setPage(pg);
            // النسخة المخزنة تُعرض فوراً بلا سبينر
            setLoading(false);
            // عدد الصفحات الكلي للمؤشر المرقّم (فقط عند التحميل الكامل وليس الإلحاق)
            if (!append) {
              void Promise.resolve(
                scope.type === 'all' && isMerchant ? ensureStores() : Promise.resolve([] as Store[]),
              )
                .then((ownStores) => {
                  if (scope.type === 'all' && isMerchant) {
                    if (ownStores.length === 0) {
                      setTotalPages(1); // لا متاجر للتاجر — قائمة فارغة
                      return 0;
                    }
                    return countAllProducts({
                      search: q,
                      storeIds: ownStores.map((s) => s.id),
                      storeId: storeFilterId || undefined,
                      branchId: undefined,
                    });
                  }
                  return countAllProducts({
                    search: q,
                    storeId: storeFilterId || (scope.type === 'store' ? scope.storeId : undefined),
                    branchId: scope.type === 'branch' ? scope.branchId : undefined,
                  });
                })
                .then((count) => {
                  if (!aliveRef.current) return;
                  setTotalCount(count);
                  setTotalPages(count > 0 ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : null);
                })
                .catch(() => {
                  if (aliveRef.current) setTotalPages(null); // يبقى الشكل القديم عند فشل العد
                });
            }
          },
        );
      } catch (e) {
        if (!aliveRef.current) return;
        toastError(typeof e === 'string' ? e : 'تعذر تحميل المنتجات');
      } finally {
        if (aliveRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [scope.type, scope.storeId, scope.branchId, isMerchant, profile.id, storeFilterId, ensureStores],
  );

  useEffect(() => {
    // أول فتح: فوري ليعرض الكاش بلا ومضة؛ البحث/الفلتر: مهلة debounce
    if (search.trim() === '' && !storeFilterId && !queryRef.current) {
      queryRef.current = '';
      load(0, '', false);
      return;
    }
    const t = setTimeout(() => {
      const q = search.trim();
      queryRef.current = q;
      setTotalPages(null); // يُعاد حسابه مع نتيجة الاستعلام الجديد
      load(0, q, false);
    }, 400);
    return () => clearTimeout(t);
  }, [search, storeFilterId, load]);

  const loadMore = () => load(page + 1, queryRef.current, true);

  const openAdd = async () => {
    if (scope.type === 'store' && scope.storeId) {
      router.push({ name: 'product-form', storeId: scope.storeId });
      return;
    }
    if (scope.type === 'branch' && scope.storeId) {
      router.push({ name: 'product-form', storeId: scope.storeId });
      return;
    }
    try {
      await ensureStores();
    } catch {
      setFilterStores([]);
    }
    // التاجر بلا متاجر: لا معنى لفتح المنتقي — أنشئ متجرك أولاً (كما في الموبايل)
    if (isMerchant && filterStores.length === 0) {
      toastError('يجب إنشاء متجرك أولاً قبل إضافة منتجات');
      router.push({ name: 'stores-list' });
      return;
    }
    setStorePickerOpen(true);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={title}
        subtitle={
          totalCount !== null ? (
            <span className="flex items-center gap-2">
              <span>إدارة المنتجات المعروضة للبيع</span>
              <Chip tone="primary" label={`العدد الكلي: ${totalCount}`} />
            </span>
          ) : (
            'إدارة المنتجات المعروضة للبيع'
          )
        }
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

      {scope.type === 'all' && filterStores.length > 0 && (
        <div className="relative mb-4 max-w-xs">
          <button
            type="button"
            onClick={() => setStoreFilterOpen((o) => !o)}
            className="w-full field flex items-center justify-between gap-2 ps-3.5 pe-3 py-2.5 rounded-[12px] text-[13px] text-[var(--text)]"
          >
            <span className="flex items-center gap-2 min-w-0">
              <StoreIcon className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              <span className={cn('truncate', storeFilterId ? 'text-[var(--text)] font-semibold' : 'text-[var(--text-muted)]')}>
                {storeFilterId ? filterStores.find((s) => s.id === storeFilterId)?.name ?? 'كل الشركات' : 'كل الشركات'}
              </span>
            </span>
            <ChevronDown className={cn('w-4 h-4 text-[var(--text-muted)] transition-transform shrink-0', storeFilterOpen && 'rotate-180')} />
          </button>

          {storeFilterOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setStoreFilterOpen(false)} />
              <div className="absolute z-30 mt-1.5 w-full card rounded-[12px] shadow-lg overflow-hidden">
                <div className="p-2 border-b border-[var(--border)]">
                  <SearchField value={storeFilterSearch} onChange={setStoreFilterSearch} placeholder="بحث عن الشركة..." />
                </div>
                <div className="max-h-64 overflow-y-auto p-1.5">
                  {(() => {
                    const q = storeFilterSearch.trim().toLowerCase();
                    const filtered = q ? filterStores.filter((s) => s.name.toLowerCase().includes(q)) : filterStores;
                    if (filtered.length === 0) {
                      return <p className="text-[12px] text-[var(--text-muted)] px-3 py-2.5">لا توجد نتائج مطابقة</p>;
                    }
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setStoreFilterId('');
                            setStoreFilterSearch('');
                            setTotalPages(null); // يُعاد حسابه مع الفلتر الجديد
                            setStoreFilterOpen(false);
                          }}
                          className={cn(
                            'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-[13px] font-semibold text-start hover:bg-[var(--surface-variant)] transition-colors',
                            storeFilterId === '' ? 'bg-[var(--primary-surface-light)] text-[var(--primary)]' : 'text-[var(--text)]',
                          )}
                        >
                          كل الشركات
                          {storeFilterId === '' && <Check className="w-4 h-4" />}
                        </button>
                        {filtered.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                            setStoreFilterId(s.id);
                            setStoreFilterSearch('');
                            setTotalPages(null); // يُعاد حسابه مع الفلتر الجديد
                            setStoreFilterOpen(false);
                            }}
                            className={cn(
                              'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-[13px] font-semibold text-start hover:bg-[var(--surface-variant)] transition-colors',
                              storeFilterId === s.id ? 'bg-[var(--primary-surface-light)] text-[var(--primary)]' : 'text-[var(--text)]',
                            )}
                          >
                            <span className="truncate">{s.name}</span>
                            {storeFilterId === s.id && <Check className="w-4 h-4 shrink-0" />}
                          </button>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
      )}

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
                className="text-start card card-hover overflow-hidden"
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
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </div>
                </div>
              </button>
            ))}
          </div>
          <PaginationFooter
            page={page}
            hasMore={hasMore}
            total={totalPages ?? undefined}
            onPage={(target) => load(target, queryRef.current, false)}
            onPrev={() => load(page - 1, queryRef.current, false)}
            onNext={loadMore}
            loading={loading || loadingMore}
          />
        </>
      )}

      <Modal open={storePickerOpen} onClose={() => setStorePickerOpen(false)} title="اختر المتجر">
        <p className="text-[12px] text-[var(--text-secondary)] mb-3">اختر المتجر الذي تريد إضافة المنتج إليه:</p>
        {filterStores.length === 0 ? (
          <p className="text-[12px] text-[var(--text-muted)]">لا توجد متاجر متاحة.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pe-1">
            {filterStores.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setStorePickerOpen(false);
                  router.push({ name: 'product-form', storeId: s.id });
                }}
                className="w-full flex items-center gap-3 card card-hover rounded-[12px] p-3 text-start"
              >
                <span className="grid place-items-center w-9 h-9 rounded-lg bg-[var(--primary-surface)] text-[var(--primary)]">
                  <StoreIcon className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-[var(--text)] truncate">{s.name}</span>
                  <span className="block text-[11px] text-[var(--text-secondary)] truncate">{s.address || s.category || ''}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
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