import { useEffect, useRef, useState } from 'react';
import { Activity, Settings2, X } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useWorkspacePreferences, type StatusMetric } from '../../stores/useWorkspacePreferences';

const metrics: { key: StatusMetric; label: string }[] = [
  { key: 'cpu', label: 'CPU usage' }, { key: 'ram', label: 'Memory' },
  { key: 'gpu', label: 'GPU usage' }, { key: 'vram', label: 'GPU memory' },
  { key: 'model', label: 'AI status' }, { key: 'speed', label: 'Generation speed' },
];
const defaults: StatusMetric[] = ['cpu', 'ram', 'model', 'speed'];
const percent = (value?: number) => value !== undefined && Number.isFinite(value) ? `${Math.max(0, Math.min(100, value)).toFixed(0)}%` : 'Unavailable';
const memory = (used?: number, total?: number) => used !== undefined && total && Number.isFinite(used) && Number.isFinite(total)
  ? `${(used / 1073741824).toFixed(1)} / ${(total / 1073741824).toFixed(1)} GB` : 'Unavailable';

export function SystemStatusPopover() {
  const sample = useAppStore(s => s.currentMetric);
  const instance = useAppStore(s => s.serverInstance);
  const serverState = useAppStore(s => s.serverState);
  const downloads = useAppStore(s => s.downloads);
  const { visibleMetrics, setVisibleMetrics, builderMode } = useWorkspacePreferences();
  const [open, setOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const interval = window.setInterval(() => setNow(Date.now()), 2000);
    const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', key);
    content.current?.querySelector<HTMLElement>('button, input')?.focus();
    return () => { clearInterval(interval); document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); };
  }, [open]);
  const fresh = Boolean(sample && now - sample.timestamp < 15000);
  const current = fresh ? sample : undefined;
  const downloadCount = Object.keys(downloads).length;
  const status = downloadCount ? `${downloadCount} model download${downloadCount === 1 ? '' : 's'}` : current?.activeRequests
    ? 'Generating' : instance?.state === 'RUNNING' ? 'Ready' : serverState === 'STARTING' ? 'Loading model' : serverState === 'ERROR' ? 'Needs attention' : 'No model running';
  const values: Record<StatusMetric, string> = {
    cpu: percent(current?.cpuPercent), ram: memory(current?.memoryUsedBytes, current?.memoryTotalBytes),
    gpu: percent(current?.gpuPercent), vram: memory(current?.vramUsedBytes, current?.vramTotalBytes), model: status,
    speed: current?.activeRequests && Number.isFinite(current.tokensPerSecond) ? `${current.tokensPerSecond.toFixed(1)} tokens/s` : 'Not generating',
  };
  return <div ref={root} className="relative">
    <button ref={trigger} aria-label="System status" aria-expanded={open} aria-haspopup="dialog" onClick={() => { setNow(Date.now()); setOpen(v => !v); setCustomizing(false); }} className="rounded-lg p-2 transition-colors hover:opacity-70" style={{ color: 'var(--text-secondary)' }}><Activity size={17} /></button>
    {open && <div ref={content} role="dialog" aria-label="System status" onContextMenu={e => { e.preventDefault(); setCustomizing(true); }} className="zaylo-glass absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border p-4 shadow-xl" style={{ background: 'var(--popover)', borderColor: 'var(--border)', color: 'var(--popover-foreground)' }}>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-semibold">{customizing ? 'Show in system status' : 'System status'}</h2><button aria-label="Close system status" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={14} /></button></div>
      {customizing ? <div className="space-y-1">{metrics.map(metric => <label key={metric.key} className="flex cursor-pointer items-center gap-3 rounded px-1 py-2 text-xs"><input type="checkbox" checked={visibleMetrics.includes(metric.key)} style={{ accentColor: 'var(--theme-accent)' }} onChange={e => setVisibleMetrics(e.target.checked ? [...visibleMetrics, metric.key] : visibleMetrics.filter(m => m !== metric.key))} />{metric.label}</label>)}<div className="mt-3 flex justify-between border-t pt-3 text-xs" style={{ borderColor: 'var(--border)' }}><button onClick={() => setVisibleMetrics(defaults)}>Reset to default</button><button onClick={() => setCustomizing(false)}>Done</button></div></div>
        : <><dl className="space-y-3">{metrics.filter(m => visibleMetrics.includes(m.key)).map(metric => <div key={metric.key} className="flex items-start justify-between gap-3 text-xs"><dt style={{ color: 'var(--muted-foreground)' }}>{metric.label}</dt><dd className="max-w-36 text-right tabular-nums">{values[metric.key]}</dd></div>)}</dl>
          {!visibleMetrics.length && <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Choose metrics in Customize.</p>}
          {!fresh && <p className="mt-3 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Waiting for a current hardware sample.</p>}
          {builderMode && instance && <p className="mt-3 break-words text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{instance.modelName} · {instance.state}</p>}
          <button onClick={() => setCustomizing(true)} className="mt-4 flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}><Settings2 size={13} />Customize</button></>}
    </div>}
  </div>;
}
