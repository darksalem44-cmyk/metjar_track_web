'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import { useProfile } from '@/components/ProfileContext';
import { fetchStores, canEditStore, countAllStores } from '@/lib/data/stores';
import type { Store } from '@/lib/types';
import { PAGE_SIZE } from '@/lib/data/base';
import { cacheKey, cachedLoad } from '@/lib/cache';
import { toastError } from '@/lib/toast';
import { Plus, Store as StoreIcon, MapPin, Phone, ChevronRight } from 'lucide-react';
import { formatDistanceText } from '@/lib/utils';
import { Button, CenteredSpinner, Chip, EmptyState, PaginationFooter } from '@/components/ui/controls';
import { SearchField } from '@/components/ui/fields';
import { ResolvedImage } from '@/components/ui/images';

export default function StoresList() {
  const router = useRouter();
  const profile = useProfile();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  /** عدد الصفحات الكلي المحسوب من count:'exact' — أساس المؤشر المرقّم */
  const [totalPages, setTotalPages] = useState<number | null>(null);
  /** الإجمالي الكلي للمتاجر (بدون البحث) — يُعرض في الترويسة */
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const isMerchant = profile.role === 'merchant';

  const load = useCallback(
    async (query: string, pg: number) => {
      setLoading(true);
      const pageKey = cacheKey('stores', `page${pg}:q:${query}:u:${isMerchant ? profile.id : 'all'}`);
      try {
        await cachedLoad(
          pageKey,
          () =>
            fetchStores({
              page: pg,
              pageSize: PAGE_SIZE,
              search: query,
              createdBy: isMerchant ? profile.id : undefined,
            }),
          (res) => {
            if (!aliveRef.current) return;
            setStores(res.items);
            setHasMore(res.hasMore);
            // الكاش يعرض فوراً بلا سبينر، والشبكة تحدّث القائمة بهدوء عند وصولها
            setLoading(false);
          },
        );
      } catch (e) {
        if (!aliveRef.current) return;
        toastError(typeof e === 'string' ? e : 'تعذر تحميل المتاجر');
        if (typeof e === 'string' && e.includes('المدير قام بتعطيل حسابك')) return;
      } finally {
        if (aliveRef.current) setLoading(false);
      }
    },
    [isMerchant, profile.id],
  );

  // الإجماليات الكلية: عدد الصفحات الكلي للمؤشر المرقّم + عدد المتاجر الكلي للترويسة
  // (cacheBump('stores') في أي إضافة/تعديل/حذف يبطل المفتاح تلقائياً — لا إجراء إضافي هنا)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const count = await countAllStores({ createdBy: isMerchant ? profile.id : undefined });
        if (cancelled) return;
        setTotalCount(count);
        setTotalPages(Math.max(1, Math.ceil(count / PAGE_SIZE)));
      } catch {
        if (!cancelled) setTotalPages(null); // يبقى الشكل القديم عند فشل العد
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isMerchant, profile.id]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(search.trim());
      setPage(0);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    load(debouncedQuery, page);
  }, [debouncedQuery, page, load]);

  const goToPage = (pg: number) => setPage(pg);

  const canAdd = canEditStore(profile);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text)]">{isMerchant ? 'متاجري' : 'المتاجر'}</h1>
          <p className="text-[12px] text-[var(--text-secondary)] flex items-center gap-2">
            {isMerchant ? 'إدارة المتاجر الخاصة بك' : 'استعراض وإدارة جميع المتاجر'}
            {totalCount !== null && <Chip tone="primary" label={`العدد الكلي: ${totalCount}`} />}
          </p>
        </div>
        {canAdd && (
          <Button onClick={() => router.push({ name: 'store-form' })} icon={<Plus className="w-4 h-4" />}>
            إضافة متجر
          </Button>
        )}
      </div>

      <div className="mb-5">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="بحث عن متجر بالاسم..."
          className="max-w-md"
        />
      </div>

      {loading && page === 0 ? (
        <CenteredSpinner label="جاري تحميل المتاجر..." />
      ) : stores.length === 0 ? (
        <EmptyState
          icon={<StoreIcon className="w-6 h-6" />}
          title={search ? 'لا توجد نتائج مطابقة' : 'لا توجد متاجر بعد'}
          subtitle={search ? 'جرّب كلمات بحث مختلفة' : canAdd ? 'ابدأ بإضافة متجرك الأول' : 'لا توجد متاجر متاحة'}
          action={canAdd && !search ? <Button onClick={() => router.push({ name: 'store-form' })} icon={<Plus className="w-4 h-4" />}>إضافة متجر</Button> : undefined}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push({ name: 'store-details', storeId: s.id })}
                className="text-start rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--primary-light)] hover:shadow-sm transition-all"
              >
                <div className="h-32 bg-[var(--surface-variant)]">
                  <ResolvedImage src={s.coverImageUrls[0] ?? s.signageImageUrl} alt={s.name} className="w-full h-full" />
                </div>
                <div className="p-3.5">
                  <p className="text-[14px] font-bold text-[var(--text)] truncate">{s.name}</p>
                  <div className="mt-1.5 space-y-1">
                    {s.address && (
                      <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] truncate">
                        <MapPin className="w-3 h-3 shrink-0 text-[var(--text-muted)]" />
                        {s.address}
                      </p>
                    )}
                    {s.phone && (
                      <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                        <Phone className="w-3 h-3 shrink-0 text-[var(--text-muted)]" />
                        <span dir="ltr">{s.phone}</span>
                      </p>
                    )}
                    {s.actualDistance && s.actualDistance > 0 && (
                      <p className="text-[11px] text-[var(--primary)] font-semibold">
                        {formatDistanceText(s.actualDistance)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[var(--border)]">
                    <span className="text-[11px] font-semibold text-[var(--primary)]">استعراض التفاصيل</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--primary)]" />
                  </div>
                </div>
              </button>
            ))}
          </div>
          <PaginationFooter
            page={page}
            hasMore={hasMore}
            total={totalPages ?? undefined}
            onPage={goToPage}
            onPrev={() => goToPage(page - 1)}
            onNext={() => goToPage(page + 1)}
          />
        </>
      )}
    </div>
  );
}