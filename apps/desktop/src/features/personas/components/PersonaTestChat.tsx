import { useEffect, useRef, useState } from 'react';
import { X, Square, Send } from 'lucide-react';
import type { ChatMessage, Persona } from '@local-ai/shared';
import { PersonaPromptAdapter } from '@local-ai/inference';
import { api } from '../../../api/client';
import { useAppStore } from '../../../stores/useAppStore';

/** Ephemeral model preview: never inserts conversations or enables memory/RAG. */
export function PersonaTestChat({ persona, onClose }: { persona: Persona; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef<{ id?: string; cancelled: boolean } | null>(null);
  const mounted = useRef(true);
  const instance = useAppStore(s => s.serverInstance);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const current = request.current;
      if (current) { current.cancelled = true; if (current.id) void api.invoke('inference:abort', { requestId: current.id }); }
    };
  }, []);
  const stop = () => {
    const current = request.current;
    if (!current) return;
    current.cancelled = true;
    if (current.id) void api.invoke('inference:abort', { requestId: current.id }).catch(() => {});
  };
  const send = async () => {
    if (busy || !prompt.trim()) return;
    if (!instance || instance.state !== 'RUNNING') { setError('Load a local chat model before testing a persona.'); return; }
    const next: ChatMessage[] = [...messages.slice(-12), { role: 'user', content: prompt.trim() }];
    setMessages(next); setPrompt(''); setAnswer(''); setError(''); setBusy(true);
    const current = { cancelled: false, id: crypto.randomUUID() };
    request.current = current;
    let content = '';
    const unsubscribe = api.on('inference:chunk', ({ requestId, chunk }) => {
      if (request.current !== current) return;
      if (current.id !== requestId) return;
      if (current.cancelled) { void api.invoke('inference:abort', { requestId }).catch(() => {}); return; }
      content += chunk.choices[0]?.delta?.content || '';
      if (mounted.current) setAnswer(content);
    });
    try {
      const result = await api.invoke('inference:chat', {
        clientRequestId: current.id,
        model: instance.modelName || 'default',
        messages: PersonaPromptAdapter.augmentMessages(next, persona),
        stream: true, memory: false, rag: false, max_tokens: 512,
      });
      if (!result) throw new Error('The desktop model bridge is not available.');
      if (!content) {
        const final = result.choices[0]?.message?.content;
        if (typeof final === 'string') content = final;
      }
      if (mounted.current && !current.cancelled && content) setMessages([...next, { role: 'assistant', content }]);
    } catch (e) {
      if (mounted.current && !current.cancelled) setError(e instanceof Error ? e.message : 'The local model could not respond.');
    } finally {
      unsubscribe(); request.current = null;
      if (mounted.current) { setBusy(false); setAnswer(''); }
    }
  };
  return <section aria-label={`Test ${persona.name}`} className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}>
    <div className="flex items-start justify-between gap-4"><div><h2 className="text-sm font-semibold">Try {persona.name}</h2><p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>Local model preview. Messages are not saved to history or memory.</p></div><button aria-label="Close persona preview" onClick={() => { stop(); onClose(); }}><X size={17} /></button></div>
    <div role="log" aria-live="polite" className="max-h-64 space-y-3 overflow-auto text-sm select-text">
      {!messages.length && <p style={{ color: 'var(--muted-foreground)' }}>Ask a short question to hear this persona’s style.</p>}
      {messages.map((m, i) => <div key={i}><span className="text-xs font-medium" style={{ color: 'var(--theme-accent)' }}>{m.role === 'user' ? 'You' : persona.name}</span><p className="mt-1 whitespace-pre-wrap">{typeof m.content === 'string' ? m.content : ''}</p></div>)}
      {answer && <p className="whitespace-pre-wrap">{answer}</p>}
    </div>
    {error && <p role="alert" className="text-xs text-red-600 dark:text-red-300">{error}</p>}
    <form onSubmit={e => { e.preventDefault(); void send(); }} className="flex gap-3">
      <input aria-label="Persona test prompt" value={prompt} onChange={e => setPrompt(e.target.value)} disabled={busy} placeholder="Try a question…" className="min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }} />
      {busy ? <button type="button" onClick={stop} aria-label="Stop preview generation" className="px-2"><Square size={16} /></button> : <button type="submit" disabled={!prompt.trim()} aria-label="Send test prompt" className="px-2 disabled:opacity-40"><Send size={17} /></button>}
    </form>
  </section>;
}
