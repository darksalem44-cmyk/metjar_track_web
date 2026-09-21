'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import { useProfile } from '@/components/ProfileContext';
import { fetchStores, canEditStore } from '@/lib/data/stores';
import type { Store } from '@/lib/types';
import { PAGE_SIZE } from '@/lib/data/base';
import { toastError } from '@/lib/toast';
import { Plus, Store as StoreIcon, MapPin, Phone, ChevronLeft } from 'lucide-react';
import { Button, CenteredSpinner, EmptyState, PaginationFooter } from '@/components/ui/controls';
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
  const fetchedQuery = useRef('');

  const isMerchant = profile.role === 'merchant';

  const load = useCallback(
    async (query: string, pg: number) => {
      setLoading(true);
      try {
        const res = await fetchStores({
          page: pg,
          pageSize: PAGE_SIZE,
          search: query,
          createdBy: isMerchant ? profile.id : undefined,
        });
        setStores(res.items);
        setHasMore(res.hasMore);
      } catch (e: any) {
        toastError(typeof e === 'string' ? e : 'تعذر تحميل المتاجر');
        if (typeof e === 'string' && e.includes('المدير قام بتعطيل حسابك')) return;
      } finally {
        setLoading(false);
      }
    },
    [isMerchant, profile.id],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      const q = search.trim();
      if (q !== fetchedQuery.current || page === 0) {
        fetchedQuery.current = q;
        setPage(0);
        load(q, 0);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [search, load, page]);

  const goToPage = (pg: number) => {
    setPage(pg);
    load(fetchedQuery.current, pg);
  };

  const canAdd = profile.role === 'manager' || canEditStore(profile);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text)]">{isMerchant ? 'متاجري' : 'المتاجر'}</h1>
          <p className="text-[12px] text-[var(--text-secondary)]">
            {isMerchant ? 'إدارة المتاجر الخاصة بك' : 'استعراض وإدارة جميع المتاجر'}
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
                        {s.actualDistance < 1000
                          ? `${s.actualDistance.toFixed(0)} م`
                          : `${(s.actualDistance / 1000).toFixed(1)} كم`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[var(--border)]">
                    <span className="text-[11px] font-semibold text-[var(--primary)]">استعراض التفاصيل</span>
                    <ChevronLeft className="w-3.5 h-3.5 text-[var(--primary)] rotate-180" />
                  </div>
                </div>
              </button>
            ))}
          </div>
          <PaginationFooter page={page} hasMore={hasMore} onPrev={() => goToPage(page - 1)} onNext={() => goToPage(page + 1)} />
        </>
      )}
    </div>
  );
}