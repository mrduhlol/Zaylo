import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { getSavedOutputsPage } from './savedOutputs';
import { ArchivedChats } from './ArchivedChats';
import { useAppStore } from '../../stores/useAppStore';

export const LibraryView: React.FC = () => {
  const { ragDocuments, imageHistory, saveImageAs, openImageFolder, conversations, deletedChats, selectChat, restoreChat } = useAppStore();
  const [section, setSection] = useState<'documents' | 'images' | 'outputs' | 'archive'>('documents');
  const [page, setPage] = useState(0);
  const [visibleFiles, setVisibleFiles] = useState(24);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    Promise.all([api.invoke('rag:list-documents', undefined), api.invoke('image:list-history', undefined)])
      .then(([documents, images]) => {
        if (!Array.isArray(documents) || !Array.isArray(images)) throw new Error('Local library is unavailable. Reopen Library in the desktop app to retry.');
        if (live) useAppStore.setState({ ragDocuments: documents, imageHistory: images });
      })
      .catch(err => { if (live) setError(err instanceof Error ? err.message : 'Could not load local library. Reopen Library to retry.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  const outputPage = useMemo(() => section === 'outputs' ? getSavedOutputsPage(conversations, new Set(deletedChats.map(chat => chat.id)), query, page) : { items: [], hasMore: false }, [section, conversations, deletedChats, query, page]);
  const changeSection = (next: typeof section) => { setSection(next); setPage(0); setVisibleFiles(24); };
  const run = async (action: () => Promise<unknown>) => {
    try { setError(''); await action(); } catch (err) { setError(err instanceof Error ? err.message : 'Could not open the file. Try again.'); }
  };
  const q = query.trim().toLowerCase();
  const documents = ragDocuments.filter(doc => doc.name.toLowerCase().includes(q));
  const images = imageHistory.filter(image => `${image.prompt} ${image.modelName}`.toLowerCase().includes(q));
  return <section className="h-full overflow-auto p-6 md:p-10 bg-[var(--background)] text-[var(--foreground)]">
    <div className="max-w-5xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-semibold">Library</h1><p className="mt-2 text-sm text-[var(--muted-foreground)]">Documents, images, and saved charts and presentations from your chats on this device.</p></div>
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Library category">
          <button aria-pressed={section === 'documents'} onClick={() => changeSection('documents')} className="rounded-lg px-3 py-2 bg-[var(--card)] zaylo-glow-hover">Documents ({ragDocuments.length})</button>
          <button aria-pressed={section === 'images'} onClick={() => changeSection('images')} className="rounded-lg px-3 py-2 bg-[var(--card)] zaylo-glow-hover">Images ({imageHistory.length})</button>
          <button aria-pressed={section === 'outputs'} onClick={() => changeSection('outputs')} className="rounded-lg px-3 py-2 bg-[var(--card)] zaylo-glow-hover">Saved outputs</button>
          <button aria-pressed={section === 'archive'} onClick={() => changeSection('archive')} className="rounded-lg px-3 py-2 bg-[var(--card)] zaylo-glow-hover">Archived chats</button>
        </div>
        <input aria-label="Search library" placeholder="Search library" value={query} onChange={event => { setQuery(event.target.value); setPage(0); setVisibleFiles(24); }} className="rounded-lg p-2 border border-current/20 bg-[var(--card)]" />
      </div>
      {section === 'archive' && <ArchivedChats />}
      {section === 'outputs' && <div className="space-y-4">
        <h2 className="text-lg font-semibold">Saved outputs</h2>
        <p className="text-sm text-[var(--muted-foreground)]">Charts and presentations saved in assistant messages. Open the original chat to view or export an output.</p>
        {!outputPage.items.length && <p className="text-sm text-[var(--muted-foreground)]">{q ? 'No saved outputs match this search.' : 'No saved charts or presentations yet. Create one in a saved chat to find it here.'}</p>}
        <ul className="divide-y divide-current/10">{outputPage.items.map(output => <li key={output.id} className="py-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1"><h3 className="font-medium break-words">{output.title}</h3><p className="text-sm text-[var(--muted-foreground)] break-words">{output.kind} · {output.conversationTitle}{output.archived ? ' · Archived' : ''}</p></div>
          <button className="text-sm underline underline-offset-4" aria-label={`${output.archived ? 'Restore and open' : 'Open'} original chat for ${output.title}`} onClick={() => { if (output.archived) restoreChat(output.conversationId); selectChat(output.conversationId); }}>{output.archived ? 'Restore and open original chat' : 'Open original chat'}</button>
        </li>)}</ul>
        {(page > 0 || outputPage.hasMore) && <nav aria-label="Saved output pages" className="flex items-center gap-4 text-sm"><button disabled={page === 0} className="underline underline-offset-4 disabled:opacity-40" onClick={() => setPage(value => value - 1)}>Previous</button><span role="status">Page {page + 1}</span><button disabled={!outputPage.hasMore} className="underline underline-offset-4 disabled:opacity-40" onClick={() => setPage(value => value + 1)}>Next</button></nav>}
      </div>}
      {error && <p role="alert">{error}</p>}
      {loading && (section === 'documents' || section === 'images') && <p role="status">Loading local library…</p>}
      {!loading && section === 'documents' && <div>
        {documents.length === 0 && <p className="text-[var(--muted-foreground)]">{q ? 'No matching documents.' : 'No uploaded documents yet. Attach a document in chat to add local knowledge.'}</p>}
        <ul className="divide-y divide-current/10">{documents.slice(0, visibleFiles).map(doc => <li key={doc.id} className="py-4 flex justify-between gap-4"><span className="break-all">{doc.name}</span><span className="shrink-0 text-sm text-[var(--muted-foreground)]">{doc.type} · {Math.ceil(doc.sizeBytes / 1024)} KB · {doc.chunkCount} passages</span></li>)}</ul>
        {documents.length > visibleFiles && <button className="mt-4 underline underline-offset-4" onClick={() => setVisibleFiles(value => value + 24)}>Show more documents</button>}
      </div>}
      {!loading && section === 'images' && <div>
        {images.length === 0 && <p className="text-[var(--muted-foreground)]">{q ? 'No matching images.' : 'No generated images on this device yet.'}</p>}
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{images.slice(0, visibleFiles).map(image => <li key={image.id} className="min-w-0 space-y-3">
          {!image.base64Data && <p className="text-xs text-[var(--muted-foreground)]">Preview is unavailable. Use Show in folder to open the original.</p>}
          {image.base64Data && <img src={image.base64Data.startsWith('data:') ? image.base64Data : `data:image/png;base64,${image.base64Data}`} alt={image.prompt} loading="lazy" className="w-full aspect-square object-contain rounded-xl bg-[var(--card)]" />}
          <p className="text-sm break-words">{image.prompt}</p><p className="text-xs text-[var(--muted-foreground)]">{image.modelName} · {image.width} × {image.height}</p>
          <div className="flex gap-4 text-sm"><button className="underline" onClick={() => void run(() => saveImageAs(image.localPath))}>Save image as…</button><button className="underline" onClick={() => void run(() => openImageFolder(image.localPath))}>Show in folder</button></div>
        </li>)}</ul>
        {images.length > visibleFiles && <button className="mt-4 underline underline-offset-4" onClick={() => setVisibleFiles(value => value + 24)}>Show more images</button>}
      </div>}
    </div>
  </section>;
};
