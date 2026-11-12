import React, { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';

/** Standalone settings section; also usable by the Library. */
export const ArchivedChats: React.FC = () => {
  const { conversations, deletedChats, restoreChat, permanentlyDeleteChat } = useAppStore();
  const [query, setQuery] = useState('');
  const [confirmId, setConfirmId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const matches = (chat: typeof conversations[number]) => `${chat.title} ${JSON.stringify(chat.messages)}`.toLowerCase().includes(query.toLowerCase().trim());
  const archived = conversations.filter(chat => chat.archivedAt && !chat.temporary && matches(chat));
  const deleted = deletedChats.filter(chat => !chat.temporary && matches(chat));
  return <section className="space-y-4 text-[var(--foreground)]" aria-label="Archived and deleted chats">
    <h2 className="text-lg font-semibold">Archived chats</h2>
    <input aria-label="Search archived and deleted chats" placeholder="Search archived and deleted chats" value={query} onChange={event => setQuery(event.target.value)} className="w-full p-2 rounded-lg bg-[var(--card)] border border-current/20" />
    {archived.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">No archived chats match.</p>}
    <ul className="space-y-2">{archived.map(chat => <li key={chat.id} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[var(--card)]"><span className="min-w-0 break-words">{chat.title}</span><button className="underline shrink-0" onClick={() => restoreChat(chat.id)}>Restore</button></li>)}</ul>
    <h2 className="text-lg font-semibold pt-4">Recently deleted</h2>
    <p className="text-sm text-[var(--muted-foreground)]">Deleted chats remain recoverable on this device until you permanently delete them.</p>
    {error && <p role="alert">{error}</p>}
    <ul className="space-y-2">{deleted.map(chat => <li key={chat.id} className="p-3 rounded-lg bg-[var(--card)] space-y-3">
      <div className="flex flex-wrap justify-between gap-4"><span className="break-words">{chat.title}</span><div className="flex gap-4"><button disabled={busy} className="underline" onClick={() => restoreChat(chat.id)}>Restore</button><button disabled={busy} className="underline" onClick={() => setConfirmId(chat.id)}>Delete permanently…</button></div></div>
      {confirmId === chat.id && <div role="group" aria-label="Confirm permanent deletion" className="space-y-3"><p className="text-sm">Permanently delete “{chat.title}” from chat history and LoftyDB? This cannot be undone. Previously extracted memories are managed separately in LoftyDB.</p><div className="flex gap-4"><button disabled={busy} className="underline" onClick={async () => { setBusy(true); setError(''); try { await permanentlyDeleteChat(chat.id); setConfirmId(undefined); } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete the chat. Check LoftyDB and retry.'); } finally { setBusy(false); } }}>{busy ? 'Deleting…' : 'Confirm permanent deletion'}</button><button disabled={busy} className="underline" onClick={() => setConfirmId(undefined)}>Cancel</button></div></div>}
    </li>)}</ul>
    {!deleted.length && <p className="text-sm text-[var(--muted-foreground)]">No deleted chats match.</p>}
  </section>;
};
