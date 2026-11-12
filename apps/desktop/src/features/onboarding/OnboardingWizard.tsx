import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CheckCircle2, Download, FolderOpen, X } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { api } from '../../api/client';
import { controlClass } from '../settings/SettingsControls';
import type { ModelInstallation } from '@local-ai/shared';

const completionKey = 'zaylo:onboarding:v4';
const size = (bytes: number) => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.ceil(bytes / 1024 ** 2)} MB`;

export function OnboardingWizard() {
  const app = useAppStore();
  const [step, setStep] = useState<'welcome' | 'model' | 'ready'>('welcome');
  const [selected, setSelected] = useState('');
  const [installation, setInstallation] = useState<ModelInstallation>();
  const [downloadId, setDownloadId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const operation = useRef(0);
  useEffect(() => {
    alive.current = true;
    let disposed = false;
    // Probe the installed catalog directly: an initial empty store is not proof
    // that this is a new installation. A failed probe must never erase user data.
    void api.invoke('models:list-installed', undefined).then(models => {
      if (disposed) return;
      if (!models.length && !localStorage.getItem(completionKey)) useAppStore.getState().setShowOnboarding(true);
    }).catch(() => {});
    return () => { disposed = true; alive.current = false; operation.current++; };
  }, []);
  const budget = app.capabilities?.memoryBudgetBytes || (app.hardware ? app.hardware.memory.availableBytes * .6 : 0);
  const candidates = useMemo(() => app.availableModels.flatMap(model =>
    model.variants.filter(variant => variant.format === 'gguf' && !!variant.downloadUrl && (!model.taskType || model.taskType === 'text-generation'))
      .map(variant => ({ model, variant })))
    .sort((a, b) => a.variant.sizeBytes - b.variant.sizeBytes), [app.availableModels]);
  const fitting = candidates.filter(candidate => !budget || candidate.variant.estimatedRAMBytes <= budget);
  const recommendation = fitting.find(candidate => candidate.variant.sizeBytes >= 300 * 1024 ** 2) || fitting[0] || candidates[0];
  const shown = [...new Map([recommendation, ...fitting.slice(0, 4), ...candidates.slice(0, 2)].filter(Boolean).map(candidate => [candidate.variant.id, candidate])).values()].slice(0, 5);
  const choice = candidates.find(candidate => `${candidate.model.id}:${candidate.variant.id}` === selected) || recommendation;
  const download = app.downloads[downloadId];
  useEffect(() => {
    if (!downloadId || !choice) return;
    const installed = app.installedModels.find(model => model.modelId === choice.model.id && model.variantId === choice.variant.id);
    if (installed) { setInstallation(installed); setStep('ready'); setDownloadId(''); }
  }, [app.installedModels, downloadId, choice]);
  const pending = !!downloadId && (!download || ['pending', 'downloading', 'paused', 'completed'].includes(download.status));
  const dismiss = () => {
    if (busy) return;
    localStorage.setItem(completionKey, 'dismissed'); app.setShowOnboarding(false);
  };
  const beginDownload = async () => {
    if (!choice || pending) return;
    setError(''); setBusy(true);
    setSelected(`${choice.model.id}:${choice.variant.id}`);
    const id = ++operation.current;
    try {
      const queued = await app.downloadModel(choice.model.id, choice.variant.id, choice.variant.downloadUrl, choice.model.name);
      if (alive.current && id === operation.current) setDownloadId(queued);
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'Could not start the download.'); }
    finally { if (alive.current) setBusy(false); }
  };
  const cancelDownload = async () => {
    setBusy(true); setError('');
    try {
      // Use the throwing IPC call; cancellation failures must remain visible.
      await api.invoke('models:cancel-download', { downloadId });
      app.removeDownload(downloadId); setDownloadId('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not cancel the download.'); }
    finally { setBusy(false); }
  };
  const importModel = async () => {
    setBusy(true); setError('');
    try { const model = await app.importLocalModel(); if (model) { setInstallation(model); setStep('ready'); } }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not import this model.'); }
    finally { setBusy(false); }
  };
  const launch = async () => {
    if (!installation) return;
    setBusy(true); setError('');
    try {
      // New installations stay local. Network sharing remains in Builder tools.
      await app.updateServerConfig({ lanEnabled: false });
      await app.startServer(installation.modelId, installation.variantId);
      if (useAppStore.getState().serverState !== 'RUNNING') throw new Error('The model is not ready yet. Retry, or open Models to inspect its runtime.');
      app.setSelectedModel(installation.name || installation.modelId);
      localStorage.setItem(completionKey, 'completed'); app.setShowOnboarding(false); app.setActiveTab('playground');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start the local model.'); }
    finally { setBusy(false); }
  };
  const progress = download?.totalBytes ? Math.min(100, Math.round(download.downloadedBytes / download.totalBytes * 100)) : undefined;
  return <Dialog.Root open={app.showOnboarding} onOpenChange={open => { if (!open) dismiss(); }}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
    <Dialog.Content style={{ width: 'min(640px, calc(100% - 32px))' }} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => event.preventDefault()} className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-[var(--foreground)] shadow-2xl">
      <header className="flex items-start justify-between gap-4"><div><Dialog.Title className="text-xl font-semibold">{step === 'welcome' ? 'Welcome to Zaylo' : step === 'model' ? 'Choose your first model' : 'Your model is installed'}</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">{step === 'welcome' ? 'A private place to think, write and build with AI running on your computer.' : step === 'model' ? 'Download a local model, or import a GGUF file you already have.' : 'Start the local runtime to begin chatting. Your conversations stay on this device.'}</Dialog.Description></div><button type="button" aria-label="Set up later" disabled={busy} onClick={dismiss} className="rounded p-1 disabled:opacity-40"><X size={18} /></button></header>
      {step === 'welcome' && <div className="mt-6 space-y-5"><div className="rounded-xl border border-[var(--border)] p-4 text-sm"><p>{app.hardware?.cpu.model || 'Hardware detection is still loading.'}</p><p className="mt-2 text-[var(--muted-foreground)]">{app.hardware ? `${size(app.hardware.memory.availableBytes)} memory available` : 'You can continue while hardware information loads.'}</p>{app.hardware?.primaryGPU && <p className="mt-2 text-[var(--muted-foreground)]">{app.hardware.primaryGPU.model}</p>}</div><p className="text-xs leading-relaxed text-[var(--muted-foreground)]">Downloading a model requires internet access and disk space. Once installed, supported models run locally. Voice has its own optional setup.</p><button type="button" className={controlClass} onClick={() => setStep('model')}>Choose a model</button></div>}
      {step === 'model' && <div className="mt-6 space-y-4"><button type="button" className={`${controlClass} inline-flex items-center gap-2`} disabled={busy || pending} onClick={() => void importModel()}><FolderOpen size={16} />Import a GGUF file</button>
        <fieldset disabled={busy || pending} className="space-y-2"><legend className="mb-3 text-sm font-medium">From the model catalog</legend>{shown.map(candidate => { const key = `${candidate.model.id}:${candidate.variant.id}`; const recommended = candidate === recommendation; return <label key={key} className="flex cursor-pointer gap-3 rounded-xl border border-[var(--border)] p-3 has-[:checked]:border-[var(--theme-accent)] has-[:checked]:bg-[var(--theme-accent-soft)]"><input type="radio" name="starter-model" className="mt-1 accent-[var(--theme-accent)]" checked={choice === candidate} onChange={() => setSelected(key)} /><span><span className="block text-sm font-medium">{candidate.model.name} · {candidate.variant.name}{recommended ? ' · Suggested' : ''}</span><span className="mt-1 block text-xs text-[var(--muted-foreground)]">{size(candidate.variant.sizeBytes)} download · About {size(candidate.variant.estimatedRAMBytes)} RAM</span></span></label>; })}</fieldset>
        {!candidates.length && <p className="text-sm text-[var(--muted-foreground)]">No downloadable text models are available yet. Import a GGUF file or open Models after setup.</p>}
        {choice && budget > 0 && choice.variant.estimatedRAMBytes > budget && <p role="status" className="text-xs text-[var(--muted-foreground)]">This model exceeds the estimated memory budget. A smaller model or additional free memory may be needed.</p>}
        {pending ? <div className="space-y-3" role="status"><progress className="h-2 w-full accent-[var(--theme-accent)]" max={100} value={progress} aria-label="Model download progress" /><p className="text-xs text-[var(--muted-foreground)]">{download?.status === 'completed' ? 'Finalizing installation…' : download ? `${size(download.downloadedBytes)}${download.totalBytes ? ` / ${size(download.totalBytes)}` : ''} downloaded${progress === undefined ? '' : ` · ${progress}%`}` : 'Preparing download…'}</p><button type="button" className={controlClass} disabled={busy} onClick={() => void cancelDownload()}>Cancel download</button><p className="text-xs text-[var(--muted-foreground)]">Closing setup lets the download continue in the background.</p></div> : <button type="button" className={`${controlClass} inline-flex items-center gap-2`} disabled={busy || !choice} onClick={() => void beginDownload()}><Download size={16} />{busy ? 'Preparing…' : 'Download selected model'}</button>}
        {download?.status === 'failed' && <p role="alert" className="text-sm text-[var(--status-error)]">{download.error || 'Download failed. Please try again.'}</p>}
      </div>}
      {step === 'ready' && <div className="mt-6 space-y-5"><div className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-4"><CheckCircle2 className="text-[var(--theme-accent)]" /><span className="text-sm">{installation?.name}</span></div><button type="button" className={controlClass} disabled={busy} onClick={() => void launch()}>{busy ? 'Starting your model…' : 'Start chatting'}</button></div>}
      {error && <p role="alert" className="mt-4 break-words text-sm text-[var(--status-error)]">{error}</p>}
      <footer className="mt-6 border-t border-[var(--border)] pt-4"><button type="button" disabled={busy} onClick={dismiss} className="text-xs text-[var(--muted-foreground)] underline underline-offset-4">Set up later</button></footer>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
