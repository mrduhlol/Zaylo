import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mic, Square, X } from 'lucide-react';
import { api } from '../../api/client';
import { useWorkspacePreferences } from '../../stores/useWorkspacePreferences';

type Phase = 'idle' | 'requesting' | 'setup' | 'installing' | 'recording' | 'transcribing' | 'error';
interface Props {
  disabled?: boolean;
  container: HTMLElement | null;
  onTranscript: (text: string, review: boolean) => void;
  onActiveChange?: (active: boolean) => void;
}
function encodeBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the recording.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(blob);
  });
}

/** No cloud speech service. Audio stays in memory until local IPC transcription. */
export function VoiceInput({ disabled, container, onTranscript, onActiveChange }: Props) {
  const review = useWorkspacePreferences(s => s.reviewVoiceBeforeSending);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const recording = useRef<Blob | null>(null);
  const epoch = useRef(0);
  const mounted = useRef(true);
  const animation = useRef(0);
  const stopRequested = useRef(false);
  const onActive = useRef(onActiveChange); onActive.current = onActiveChange;
  const release = () => {
    cancelAnimationFrame(animation.current);
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (context.current) void context.current.close().catch(() => {}); context.current = null;
  };
  const cancel = () => {
    epoch.current++; stopRequested.current = true;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    release(); recorder.current = null; recording.current = null;
    void api.invoke('voice:cancel', undefined).catch(() => {});
    if (mounted.current) { setPhase('idle'); setError(''); }
  };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cancel(); onActive.current?.(false); }; }, []);
  useEffect(() => { onActive.current?.(phase !== 'idle'); }, [phase]);
  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => { if (seconds >= 180 && recorder.current?.state === 'recording') recorder.current.stop(); }, [seconds]);
  const transcribe = async () => {
    const blob = recording.current; if (!blob) return;
    const id = ++epoch.current; setPhase('transcribing'); setError('');
    try {
      const audioBase64 = await encodeBlob(blob);
      if (!mounted.current || id !== epoch.current) return;
      const result = await api.invoke('voice:transcribe', { audioBase64 });
      if (!mounted.current || id !== epoch.current) return;
      if (!result?.text.trim()) throw new Error('No speech was detected. Retry, or record again.');
      recording.current = null; setPhase('idle');
      onTranscript(result.text.trim(), review);
    } catch (e) {
      if (mounted.current && id === epoch.current) { setError(e instanceof Error ? e.message : 'Local transcription failed.'); setPhase('error'); }
    }
  };
  const start = async () => {
    if (disabled) return;
    setPhase('requesting');
    const id = ++epoch.current;
    try {
      const status = await api.invoke('voice:status', undefined);
      if (!mounted.current || id !== epoch.current) return;
      if (!status?.ready) { setPhase('setup'); return; }
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Microphone recording is unavailable in this environment.');
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || id !== epoch.current) { audio.getTracks().forEach(t => t.stop()); return; }
      stream.current = audio; stopRequested.current = false;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(v => MediaRecorder.isTypeSupported(v));
      const media = new MediaRecorder(audio, mimeType ? { mimeType } : undefined); recorder.current = media;
      const chunks: Blob[] = []; let size = 0;
      media.ondataavailable = e => { if (e.data.size) { chunks.push(e.data); size += e.data.size; if (size > 19 * 1024 * 1024 && media.state === 'recording') media.stop(); } };
      media.onerror = () => { release(); if (mounted.current) { setError('The microphone stopped unexpectedly. Please record again.'); setPhase('error'); } };
      media.onstop = () => {
        release(); recorder.current = null;
        if (!mounted.current || stopRequested.current || id !== epoch.current) return;
        recording.current = new Blob(chunks, { type: media.mimeType }); void transcribe();
      };
      const ac = new AudioContext(); context.current = ac;
      const analyzer = ac.createAnalyser(); analyzer.fftSize = 256; ac.createMediaStreamSource(audio).connect(analyzer);
      const bytes = new Uint8Array(analyzer.frequencyBinCount); let last = 0;
      const measure = (now: number) => { if (!mounted.current || !context.current) return; if (now - last > 75) { analyzer.getByteTimeDomainData(bytes); const rms = Math.sqrt(bytes.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / bytes.length); setLevel(Math.min(1, rms * 6)); last = now; } animation.current = requestAnimationFrame(measure); };
      animation.current = requestAnimationFrame(measure);
      setSeconds(0); setError(''); setPhase('recording'); media.start(250);
    } catch (e) {
      release(); if (mounted.current && id === epoch.current) { setError(e instanceof Error ? e.message : 'Could not access your microphone.'); setPhase('error'); }
    }
  };
  const setup = async () => {
    const id = ++epoch.current; setPhase('installing'); setError('');
    try { const status = await api.invoke('voice:setup', undefined); if (mounted.current && id === epoch.current) { if (!status?.ready) throw new Error('Local voice setup is not ready.'); setPhase('idle'); } }
    catch (e) { if (mounted.current && id === epoch.current) { setError(e instanceof Error ? e.message : 'Local voice setup failed.'); setPhase('error'); } }
  };
  const active = phase !== 'idle';
  return <>
    <button type="button" disabled={disabled || active} aria-label="Record a voice message" onClick={() => void start()} className="rounded-lg p-2 disabled:opacity-40" style={{ color: 'var(--text-secondary)' }}><Mic size={18} /></button>
    {active && container && createPortal(<div className="zaylo-recording-glow absolute inset-0 z-20 flex items-center justify-between gap-4 rounded-[inherit] px-5 py-4" style={{ background: 'var(--surface-elevated)', color: 'var(--foreground)' }} role="group" aria-label="Voice recording">
      <div className="min-w-0 flex-1"><p className="text-xs font-medium" aria-live="polite">{phase === 'recording' ? `Listening · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : phase === 'requesting' ? 'Waiting for microphone permission…' : phase === 'transcribing' ? 'Transcribing on your device…' : phase === 'installing' ? 'Setting up local voice…' : phase === 'setup' ? 'Set up local voice' : 'Voice needs attention'}</p>
        {(phase === 'setup' || phase === 'installing') && <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{phase === 'setup' ? 'Requires Python 3.9–3.13. Setup downloads the speech engine and Whisper tiny model (about 75 MB, plus dependencies). Afterward, transcription runs offline.' : 'Downloading dependencies and the model. This may take several minutes. No audio is uploaded.'}</p>}
        {phase === 'error' && <p role="alert" className="mt-2 max-h-20 overflow-auto break-words text-xs" style={{ color: 'var(--status-error)' }}>{error}</p>}
        {phase === 'recording' && <div className="mt-3 flex h-9 items-center justify-center gap-1" aria-hidden="true">{Array.from({ length: 25 }, (_, i) => <i key={i} className="w-0.5 rounded-full" style={{ background: 'var(--theme-accent)', height: `${4 + level * 28 * (0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + seconds)))}px`, transition: 'height 75ms linear' }} />)}</div>}
        <div className="mt-3 flex gap-4 text-xs">{phase === 'setup' && <button type="button" onClick={() => void setup()} style={{ color: 'var(--theme-accent)' }}>Download and set up</button>}{phase === 'error' && recording.current && <button type="button" onClick={() => void transcribe()} style={{ color: 'var(--theme-accent)' }}>Retry transcription</button>}{phase === 'error' && !recording.current && <button type="button" onClick={() => { setPhase('idle'); setError(''); }}>Try again</button>}<button type="button" onClick={cancel} style={{ color: 'var(--muted-foreground)' }}>Cancel</button></div>
      </div>
      {phase === 'recording' ? <button type="button" aria-label="Stop recording and transcribe" onClick={() => recorder.current?.stop()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--theme-accent)', color: 'var(--theme-accent-ink)' }}><Square size={14} fill="currentColor" /></button> : <button type="button" aria-label="Cancel voice input" onClick={cancel}><X size={18} /></button>}
    </div>, container)}
  </>;
}
