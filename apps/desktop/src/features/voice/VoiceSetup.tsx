import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';

export function VoiceSetup() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void api.invoke('voice:status', undefined).then(status => {
      if (!mounted.current) return;
      if (!status) { setError('Local voice is available in the desktop app.'); return; }
      setReady(status.ready); setBusy(status.installing);
    }).catch(() => { if (mounted.current) setError('Could not check local voice setup.'); });
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => {
      void api.invoke('voice:status', undefined).then(status => {
        if (mounted.current && status && !status.installing) { setReady(status.ready); setBusy(false); }
      }).catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [busy]);
  const setup = async () => {
    setBusy(true); setError('');
    try {
      const result = await api.invoke('voice:setup', undefined);
      if (!result?.ready) throw new Error('Local voice setup is not ready.');
      if (mounted.current) setReady(true);
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Setup failed.'); }
    finally { if (mounted.current) setBusy(false); }
  };
  return <div className="w-full space-y-3 text-xs">
    <p style={{ color: 'var(--muted-foreground)' }}>{ready ? 'Whisper tiny is ready. Transcription runs locally on the CPU, without a cloud service.' : 'Requires Python 3.9–3.13. Setup downloads an isolated speech engine and model (about 75 MB, plus dependencies). Your recordings are never uploaded.'}</p>
    {!ready && <div className="flex gap-3"><button type="button" disabled={busy} onClick={() => void setup()} className="rounded-lg border px-3 py-2 disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>{busy ? 'Setting up local voice…' : 'Download and set up local voice'}</button>{busy && <button type="button" onClick={() => void api.invoke('voice:cancel', undefined).catch(() => {})}>Cancel setup</button>}</div>}
    {error && <p role="alert" className="max-h-24 overflow-auto break-words" style={{ color: 'var(--status-error)' }}>{error}</p>}
    <p style={{ color: 'var(--muted-foreground)' }}>Microphone permission is requested only when you press the mic in a chat.</p>
  </div>;
}
