export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l([...toasts]);
}

export function toast(message: string, type: ToastType = 'info', duration = 3000) {
  const item: ToastItem = {
    id: Math.random().toString(36).slice(2, 10),
    message,
    type,
  };
  toasts = [...toasts, item];
  emit();
  if (duration > 0) {
    window.setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== item.id);
      emit();
    }, duration);
  }
}

export const toastSuccess = (m: string) => toast(m, 'success');
export const toastError = (m: string, duration = 3200) => toast(m, 'error', duration);
export const toastInfo = (m: string) => toast(m, 'info');

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}