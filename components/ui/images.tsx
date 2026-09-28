'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { resolveImageUrl, uploadImageObject, buildImagePath, isStoredPath } from '@/lib/supabase';
import { Image as ImageIcon, Plus, X, Loader2 } from 'lucide-react';
import { Modal } from './modals';

function getExt(name: string): string {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1] : 'jpg';
}

/** صورة مسقطة من مسار تخزين أو رابط مباشر. */
export function ResolvedImage({
  src,
  alt,
  className,
  onLoad,
}: {
  src?: string;
  alt?: string;
  className?: string;
  onLoad?: () => void;
}) {
  const resolved = useImageResolver(src);
  const [failed, setFailed] = useState(false);

  if (!src || !resolved || failed) {
    return (
      <div className={cn('grid place-items-center bg-[var(--surface-variant)]', className)}>
        {src && resolved === undefined && !failed ? (
          <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
        ) : (
          <ImageIcon className="w-6 h-6 text-[var(--text-muted)]" />
        )}
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt ?? ''}
      loading="lazy"
      onLoad={onLoad}
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}

/** يحوّل أي مسار إلى رابط صورة قابل للعرض. */
export function useImageResolver(src?: string): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    resolveImageUrl(src).then((url) => {
      if (alive) setResolved(url || src);
    });
    return () => {
      alive = false;
    };
  }, [src]);
  return resolved;
}

function Thumb({
  src,
  alt,
  onRemove,
  onOpen,
  uploading,
}: {
  src: string;
  alt?: string;
  onRemove?: () => void;
  onOpen?: () => void;
  uploading?: boolean;
}) {
  return (
    <div className="group relative w-24 h-24 rounded-[14px] overflow-hidden border border-[var(--border)] bg-[var(--surface-variant)] shadow-[var(--shadow-xs)] transition-[box-shadow,border-color,transform] duration-[var(--dur-2)] ease-[var(--ease-out)] hover:border-[var(--border-light)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5">
      <button type="button" onClick={onOpen} className={cn('block w-full h-full', onOpen && 'cursor-zoom-in')}>
        <ResolvedImage src={src} alt={alt} className="w-full h-full transition-transform duration-[var(--dur-3)] ease-[var(--ease-out)] group-hover:scale-[1.04]" />
      </button>
      {uploading && (
        <div className="absolute inset-0 grid place-items-center bg-black/40">
          <Loader2 className="w-5 h-5 animate-spin text-white" />
        </div>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="إزالة الصورة"
          className="absolute top-1.5 end-1.5 grid place-items-center w-6 h-6 rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-[var(--error)] active:scale-90"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function ImagePicker({
  value,
  onChange,
  folder,
  label,
  max = 5,
  className,
  hint,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  folder: string;
  label?: string;
  max?: number;
  className?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      try {
        const entries = Array.from(files);
        const next = [...value];
        const slots = max - next.length;
        for (let i = 0; i < entries.length && i < slots; i++) {
          const file = entries[i];
          const path = buildImagePath(folder, getExt(file.name));
          const done = await uploadImageObject(path, file);
          next.push(done);
        }
        onChange(next);
      } catch (e) {
        console.error(e);
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [value, onChange, folder, max],
  );

  const canAdd = value.length < max;

  return (
    <div className={cn('space-y-2', className)}>
      {label && <p className="text-[12px] font-semibold text-[var(--text-secondary)]">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {value.map((p) => (
          <Thumb
            key={p}
            src={p}
            onOpen={() => setViewer(p)}
            onRemove={() => onChange(value.filter((x) => x !== p))}
          />
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-24 h-24 rounded-[14px] border-2 border-dashed border-[var(--border-light)] bg-[var(--input)] grid place-items-center text-[var(--text-muted)] transition-[border-color,background-color,color,transform,box-shadow] duration-[var(--dur-2)] ease-[var(--ease-out)] hover:border-[var(--primary)] hover:bg-[var(--primary-surface)] hover:text-[var(--primary-dark)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)] active:scale-[0.97] disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
          </button>
        )}
      </div>
      {hint && <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Modal open={!!viewer} onClose={() => setViewer(null)} title="الصورة">
        {viewer && (
          <div className="rounded-xl overflow-hidden">
            <ResolvedImage src={viewer} alt="" className="w-full max-h-[70vh] object-contain bg-[var(--surface-variant)]" />
          </div>
        )}
      </Modal>
    </div>
  );
}

export function SingleImagePicker({
  value,
  onChange,
  folder,
  label,
  hint,
}: {
  value?: string;
  onChange: (next?: string) => void;
  folder: string;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState(false);

  const handleFile = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const path = buildImagePath(folder, getExt(file.name));
        const done = await uploadImageObject(path, file);
        onChange(done);
      } catch (e) {
        console.error(e);
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [folder, onChange],
  );

  return (
    <div className="space-y-2">
      {label && <p className="text-[12px] font-semibold text-[var(--text-secondary)]">{label}</p>}
      {value ? (
        <div className="group relative w-32 h-32 rounded-[14px] overflow-hidden border border-[var(--border)] shadow-[var(--shadow-sm)]">
          <button
            type="button"
            onClick={() => setViewer(true)}
            aria-label="تكبير الصورة"
            className="block w-full h-full cursor-zoom-in"
          >
            <ResolvedImage src={value} alt="" className="w-full h-full transition-transform duration-[var(--dur-3)] ease-[var(--ease-out)] group-hover:scale-[1.04]" />
          </button>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label="إزالة الصورة"
            className="absolute top-1.5 end-1.5 grid place-items-center w-6 h-6 rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-[var(--error)] active:scale-90"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-32 h-32 rounded-[14px] border-2 border-dashed border-[var(--border-light)] bg-[var(--input)] grid place-items-center text-[var(--text-muted)] transition-[border-color,background-color,color,transform,box-shadow] duration-[var(--dur-2)] ease-[var(--ease-out)] hover:border-[var(--primary)] hover:bg-[var(--primary-surface)] hover:text-[var(--primary-dark)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)] active:scale-[0.97] disabled:opacity-50 flex-col gap-1"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
          {!uploading && <span className="text-[11px]">إضافة صورة</span>}
        </button>
      )}
      {hint && <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files)}
      />
      <Modal open={viewer} onClose={() => setViewer(false)} title="الصورة">
        {value && (
          <div className="flex items-center justify-center">
            <ResolvedImage src={value} alt="" className="max-h-[70vh] object-contain rounded-xl" />
          </div>
        )}
      </Modal>
    </div>
  );
}

export function ImageRow({
  value,
  onOpen,
}: {
  value: string[];
  onOpen: (index: number) => void;
}) {
  if (value.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto py-1">
      {value.map((p, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onOpen(i)}
          className="group w-20 h-20 shrink-0 rounded-[14px] overflow-hidden border border-[var(--border)] shadow-[var(--shadow-xs)] transition-[box-shadow,border-color,transform] duration-[var(--dur-2)] ease-[var(--ease-out)] hover:border-[var(--border-light)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5"
        >
          <ResolvedImage src={p} alt="" className="w-full h-full transition-transform duration-[var(--dur-3)] ease-[var(--ease-out)] group-hover:scale-[1.05]" />
        </button>
      ))}
    </div>
  );
}

export { isStoredPath, ImageIcon };