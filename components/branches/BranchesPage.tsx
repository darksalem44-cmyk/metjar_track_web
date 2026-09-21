'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/components/RouterContext';
import { useProfile } from '@/components/ProfileContext';
import { fetchBranchesByStore, deleteBranch, mapBranch } from '@/lib/data/branches';
import { fetchStoreById, canEditStore, canDeleteStore } from '@/lib/data/stores';
import { deleteImageObjects, filterStoredPaths } from '@/lib/supabase';
import type { Branch } from '@/lib/types';
import { toastError, toastSuccess } from '@/lib/toast';
import { PageHeader, Chip, Button, CenteredSpinner, EmptyState } from '@/components/ui/controls';
import { ConfirmDialog } from '@/components/ui/modals';
import { TextField } from '@/components/ui/fields';
import { Split, Pencil, Trash2, Plus, ChevronLeft, Hash } from 'lucide-react';

export default function BranchesPage({ storeId }: { storeId: string }) {
  const router = useRouter();
  const profile = useProfile();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Branch | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [br, store] = await Promise.all([fetchBranchesByStore(storeId), fetchStoreById(storeId)]);
        setBranches(br);
        setStoreName(store?.name ?? '');
      } catch (e: any) {
        toastError(typeof e === 'string' ? e : 'تعذر تحميل الفروع');
      } finally {
        setLoading(false);
      }
    })();
  }, [storeId]);

  if (loading) return <CenteredSpinner label="جاري تحميل الفروع..." />;

  const editable = profile.role === 'manager' || canEditStore(profile);
  const deletable = profile.role === 'manager' || canDeleteStore(profile);

  const confirmDelete = async () => {
    if (!target) return;
    if (deleteName.trim() !== target.name) {
      toastError('اسم الفرع غير مطابق. تأكد من كتابته بشكل صحيح.');
      return;
    }
    setDeleting(true);
    try {
      await deleteBranch(target.id, deleteName.trim());
      const toDelete = filterStoredPaths([
        ...(target.coverImageUrls ?? []),
        target.signageImageUrl,
        target.shamcashQrImageUrl,
        target.paymeraQrImageUrl,
      ]);
      try {
        await deleteImageObjects(toDelete);
      } catch {
        // تجاهل
      }
      toastSuccess('تم حذف الفرع بنجاح');
      setBranches(branches.filter((b) => b.id !== target.id));
      setTarget(null);
      setDeleteName('');
    } catch (err: any) {
      toastError(typeof err === 'string' ? err : 'تعذر حذف الفرع');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="الفروع"
        subtitle={storeName}
        onBack={() => router.pop()}
        trailing={
          editable && (
            <Button onClick={() => router.push({ name: 'branch-form', storeId })} icon={<Plus className="w-4 h-4" />}>
              إضافة فرع
            </Button>
          )
        }
      />

      {branches.length === 0 ? (
        <EmptyState
          icon={<Split className="w-6 h-6" />}
          title="لا توجد فروع"
          subtitle="أضف فرعاً جديداً للمتجر"
          action={editable && <Button onClick={() => router.push({ name: 'branch-form', storeId })} icon={<Plus className="w-4 h-4" />}>إضافة فرع</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {branches.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => router.push({ name: 'branch-details', storeId, branchId: b.id })} className="flex items-start gap-3 text-start flex-1 min-w-0">
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-[var(--primary-surface)] text-[var(--primary)] shrink-0">
                    <Split className="w-5 h-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-bold text-[var(--text)]">{b.name}</span>
                      {b.branchCode && (
                        <Chip tone="purple" icon={<Hash className="w-3 h-3" />} label={`الرمز ${b.branchCode}`} />
                      )}
                      <Chip tone={b.isActive ? 'success' : 'warning'} label={b.isActive ? 'نشط' : 'معطّل'} />
                    </span>
                    <span className="block text-[12px] text-[var(--text-secondary)] mt-1.5">
                      {(b.phone ?? b.address) || 'بدون تفاصيل'}
                    </span>
                  </span>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  {editable && (
                    <button onClick={() => router.push({ name: 'branch-form', storeId, branchId: b.id })} className="action-btn">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {deletable && (
                    <button onClick={() => { setTarget(b); setDeleteName(''); }} className="action-btn text-[var(--error)]">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => router.push({ name: 'branch-details', storeId, branchId: b.id })} className="action-btn">
                    <ChevronLeft className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!target}
        title="حذف الفرع"
        confirmText="حذف نهائي"
        loading={deleting}
        onClose={() => setTarget(null)}
        onConfirm={confirmDelete}
      >
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
          سيتم تعطيل الفرع «{target?.name}». لن يتم حذف البيانات نهائياً. للمتابعة اكتب اسم الفرع.
        </p>
        <TextField
          label="اكتب اسم الفرع للتأكيد"
          value={deleteName}
          onChange={(e) => setDeleteName(e.target.value)}
          placeholder={target?.name}
          className="mt-3"
        />
      </ConfirmDialog>
    </div>
  );
}

export { mapBranch };