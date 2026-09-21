'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  BellOff,
  Layers,
  Package,
  PenLine,
  PlusCircle,
  Split,
  Store as StoreIcon,
  Trash2,
} from 'lucide-react';
import { useRouter, type View } from '@/components/RouterContext';
import { useAlerts } from '@/components/notifications/AlertsProvider';
import {
  muteDurations,
  muteUntil,
  roleLabels,
  severityLabels,
  severityTones,
  type AdminAlert,
} from '@/lib/notifications';
import { cn, relativeTime } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { Chip } from '@/components/ui/controls';
import { Modal } from '@/components/ui/modals';

/** وجهة فتح الكيان المرتبط بالتنبيه، أو null إذا كان محذوفاً أو بلا معرّف. */
export function alertTarget(alert: AdminAlert): View | null {
  if (!alert.entityId || alert.deleted) return null;
  switch (alert.entityType) {
    case 'store':
      return { name: 'store-details', storeId: alert.entityId };
    case 'branch':
      return alert.storeId
        ? { name: 'branch-details', storeId: alert.storeId, branchId: alert.entityId }
        : null;
    case 'product':
      return { name: 'product-details', productId: alert.entityId };
    default:
      return null;
  }
}

function EntityIcon({ alert }: { alert: AdminAlert }) {
  if (alert.entityType === 'branch') return <Split className="w-3.5 h-3.5" />;
  if (alert.entityType === 'product') return <Package className="w-3.5 h-3.5" />;
  return <StoreIcon className="w-3.5 h-3.5" />;
}

function ActionIcon({ alert }: { alert: AdminAlert }) {
  if (alert.action === 'deleted') return <Trash2 className="w-4 h-4" />;
  if (alert.action === 'created') return <PlusCircle className="w-4 h-4" />;
  if (alert.severity === 'critical') return <AlertTriangle className="w-4 h-4" />;
  return <PenLine className="w-4 h-4" />;
}

export default function AlertRow({ alert }: { alert: AdminAlert }) {
  const router = useRouter();
  const { muteEntity, muteActor } = useAlerts();
  const [muteOpen, setMuteOpen] = useState(false);

  const target = alertTarget(alert);
  const actorText = alert.actorNames?.length ? alert.actorNames.join('، ') : alert.actorName;
  const canMuteActor = !!alert.actorId && alert.actorName !== 'مستخدم غير معروف';

  const content = (
    <>
      <span
        className={cn(
          'w-9 h-9 rounded-xl grid place-items-center shrink-0',
          alert.severity === 'critical'
            ? 'bg-[var(--error)]/10 text-[var(--error)]'
            : alert.severity === 'warning'
              ? 'bg-[var(--warning-surface)] text-[var(--warning)]'
              : 'bg-[var(--primary-surface-light)] text-[var(--primary)]',
        )}
      >
        <ActionIcon alert={alert} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="text-[13px] font-bold text-[var(--text)] flex-1">{alert.title}</p>
          {alert.count && alert.count > 1 && (
            <Chip tone="neutral" icon={<Layers className="w-3 h-3" />} label={`×${alert.count}`} />
          )}
          <Chip tone={severityTones[alert.severity]} label={severityLabels[alert.severity]} />
        </div>

        {alert.detail && (
          <p className="text-[11.5px] text-[var(--text-secondary)] mt-1">{alert.detail}</p>
        )}

        {alert.extraDetails && alert.extraDetails.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {alert.extraDetails.map((detail) => (
              <li key={detail} className="text-[11px] text-[var(--text-muted)]">
                • {detail}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="flex items-center gap-1 text-[10.5px] text-[var(--text-muted)]">
            <EntityIcon alert={alert} />
            {alert.deleted ? 'محذوف' : 'موجود'}
          </span>
          <span className="text-[10.5px] text-[var(--text-muted)]">
            {actorText}
            {alert.actorRole && !alert.actorNames?.length
              ? ` (${roleLabels[alert.actorRole] ?? alert.actorRole})`
              : ''}
          </span>
          <span className="text-[10.5px] text-[var(--text-muted)]">{relativeTime(alert.eventAt)}</span>
        </div>
      </div>
    </>
  );

  return (
    <div className="w-full flex items-start gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 transition-colors">
      {target ? (
        <button
          type="button"
          onClick={() => router.push(target)}
          className="flex items-start gap-3 flex-1 min-w-0 text-start rounded-xl hover:opacity-95"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-start gap-3 flex-1 min-w-0">{content}</div>
      )}

      {(alert.entityId || canMuteActor) && (
        <button
          type="button"
          onClick={() => setMuteOpen(true)}
          title="كتم هذا التنبيه"
          className="grid place-items-center w-8 h-8 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] shrink-0"
        >
          <BellOff className="w-3.5 h-3.5" />
        </button>
      )}

      <Modal
        open={muteOpen}
        onClose={() => setMuteOpen(false)}
        title="كتم التنبيهات"
        maxWidth={460}
      >
        <div className="space-y-4">
          <p className="text-[11px] text-[var(--text-secondary)] rounded-xl border border-[var(--border)] bg-[var(--surface-variant)] p-2.5">
            الكتم يخفي التنبيهات عن العرض فقط، ويبقى الحدث في سجل قاعدة البيانات. يمكنك إلغاؤه في أي
            وقت من «قواعد التنبيهات».
          </p>

          {alert.entityId && (
            <MuteBlock
              label={`كتم ${alert.entityName || 'هذا الكيان'}`}
              onPick={(hours) => {
                muteEntity(
                  {
                    id: alert.entityId as string,
                    label: alert.entityName || 'كيان',
                    entityType: alert.entityType,
                  },
                  muteUntil(hours),
                );
                toast(`تم كتم تنبيهات «${alert.entityName || 'الكيان'}»`, 'success');
                setMuteOpen(false);
              }}
            />
          )}

          {canMuteActor && (
            <MuteBlock
              label={`كتم المستخدم ${alert.actorName}`}
              onPick={(hours) => {
                muteActor({ id: alert.actorId as string, name: alert.actorName }, muteUntil(hours));
                toast(`تم كتم تنبيهات ${alert.actorName}`, 'success');
                setMuteOpen(false);
              }}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}

function MuteBlock({ label, onPick }: { label: string; onPick: (hours: number | null) => void }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="text-[12px] font-semibold text-[var(--text)] mb-2 truncate">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {muteDurations.map((duration) => (
          <button
            key={duration.key}
            type="button"
            onClick={() => onPick(duration.hours)}
            className="px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--surface-variant)] text-[11px] font-semibold text-[var(--text-secondary)] hover:border-[var(--primary-light)] hover:text-[var(--text)] transition-colors"
          >
            {duration.label}
          </button>
        ))}
      </div>
    </div>
  );
}
