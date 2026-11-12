import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAppStore } from '../../stores/useAppStore';
import { controlClass } from './SettingsControls';

type Usage = { models?: { count: number; bytes: number }; documents?: { count: number; bytes: number }; images?: { count: number; bytes: number } };
const format = (bytes: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(bytes / (bytes >= 1024 ** 3 ? 1024 ** 3 : 1024 ** 2)) + (bytes >= 1024 ** 3 ? ' GB' : ' MB');

/** Catalog sizes only: never imply a complete disk scan or delete files automatically. */
export function StorageUsage() {
  const [usage, setUsage] = useState<Usage>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  useEffect(() => {
    let disposed = false;
    setLoading(true); setError('');
    void Promise.allSettled([
      api.invoke('models:list-installed', undefined),
      api.invoke('rag:list-documents', undefined),
      api.invoke('image:list-history', undefined),
    ]).then(([models, documents, images]) => {
      if (disposed) return;
      const next: Usage = {};
      if (models.status === 'fulfilled') next.models = { count: models.value.length, bytes: models.value.reduce((sum, item) => sum + Math.max(0, item.sizeBytes || 0), 0) };
      if (documents.status === 'fulfilled') next.documents = { count: documents.value.length, bytes: documents.value.reduce((sum, item) => sum + Math.max(0, item.sizeBytes || 0), 0) };
      if (images.status === 'fulfilled') next.images = { count: images.value.length, bytes: images.value.reduce((sum, item) => sum + Math.max(0, item.fileSizeBytes || 0), 0) };
      setUsage(next); setLoading(false);
      if ([models, documents, images].some(result => result.status === 'rejected')) setError('Some storage information could not be loaded. Refresh to try again.');
    });
    return () => { disposed = true; };
  }, [revision]);
  return <div className="w-full space-y-4">
    <p className="text-xs text-[var(--muted-foreground)]">Recorded sizes for installed models, source documents and generated images. Runtime binaries, speech models, indexes, caches and external files are not included.</p>
    <dl className="space-y-3">{([
      ['models', 'Models', 'models'], ['documents', 'Documents', 'library'], ['images', 'Generated images', 'library'],
    ] as const).map(([key, label, tab]) => <div key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3">
      <div><dt className="text-sm font-medium">{label}</dt><dd aria-live="polite" className="mt-1 text-xs text-[var(--muted-foreground)]">{loading ? 'Loading…' : usage[key] ? `${format(usage[key]!.bytes)} · ${usage[key]!.count} files` : 'Unavailable'}</dd></div>
      <button type="button" className={controlClass} onClick={() => setActiveTab(tab)}>Manage {label.toLowerCase()}</button>
    </div>)}</dl>
    {error && <p role="alert" className="text-xs text-[var(--status-error)]">{error}</p>}
    <button type="button" className={controlClass} disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh storage</button>
  </div>;
}
