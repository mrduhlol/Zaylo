import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { MemoryEntry } from '@local-ai/shared';
import { api } from '../../api/client';

export interface ChatMemoryInspectorProps {
  conversationId: string;
  title: string;
  temporary?: boolean;
  onClose: () => void;
}

/** Inspection remains available independently of future saving and recall settings. */
export function ChatMemoryInspector({ conversationId, title, temporary = false, onClose }: ChatMemoryInspectorProps) {
  const [result, setResult] = useState<{ id: string; entries: MemoryEntry[]; error?: string }>();
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(1);
  useEffect(() => {
    let live = true;
    setResult(undefined);
    setPage(1);
    if (!temporary) {
      api.invoke('memory:list', { conversationId }).then(entries => {
        if (!Array.isArray(entries)) throw new Error('Memory storage is unavailable.');
        if (live) setResult({ id: conversationId, entries: entries.filter(entry => entry.conversationId === conversationId) });
      }).catch(error => {
        if (live) setResult({ id: conversationId, entries: [], error: error instanceof Error ? error.message : 'Could not load saved memories.' });
      });
    }
    return () => { live = false; };
  }, [conversationId, temporary, attempt]);
  const current = result?.id === conversationId ? result : undefined;
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
    <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100%-32px)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]">
      <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
        <div className="min-w-0"><Dialog.Title className="text-lg font-semibold">Chat memories</Dialog.Title><Dialog.Description className="mt-2 break-words text-sm text-[var(--muted-foreground)]">Saved from “{title}”. These records remain inspectable when future memory saving or recall is disabled.</Dialog.Description></div>
        <Dialog.Close asChild><button aria-label="Close chat memories" className="rounded-lg p-2 focus-visible:outline focus-visible:outline-2"><X size={18} /></button></Dialog.Close>
      </header>
      <div className="overflow-auto p-5 space-y-4">
        {temporary ? <p className="text-sm text-[var(--muted-foreground)]">Temporary chats do not save memories. No memory storage was queried.</p> : !current ? <p role="status">Loading saved memories…</p> : current.error ? <div className="space-y-3"><p role="alert">{current.error}</p><button className="underline underline-offset-4" onClick={() => setAttempt(value => value + 1)}>Retry loading memories</button></div> : <>
          <p className="text-sm text-[var(--muted-foreground)]">{current.entries.length ? `${current.entries.length} saved memories` : 'No memories saved from this chat.'}</p>
          <ul className="divide-y divide-[var(--border)]">{current.entries.slice(0, page * 30).map(entry => <li key={entry.id} className="py-4 space-y-2">
            {entry.title && <h3 className="font-medium break-words">{entry.title}</h3>}
            <p className="text-sm whitespace-pre-wrap break-words">{entry.content}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{entry.category} · {entry.scope} · {entry.source}{entry.pinned ? ' · Pinned' : ''} · {new Date(entry.createdAt).toLocaleDateString()}</p>
          </li>)}</ul>
          {current.entries.length > page * 30 && <button className="underline underline-offset-4" onClick={() => setPage(value => value + 1)}>Show more memories</button>}
        </>}
      </div>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
