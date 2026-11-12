import { useMemo, useRef, useState } from 'react';
import { Users, Plus, Search, Download, Upload, Copy, Star, MessageSquare, Pencil, Trash2, FlaskConical } from 'lucide-react';
import type { Persona } from '@local-ai/shared';
import { useAppStore } from '../../stores/useAppStore';
import { useWorkspacePreferences } from '../../stores/useWorkspacePreferences';
import { PersonaEditorModal } from './components/PersonaEditorModal';
import { PersonaTestChat } from './components/PersonaTestChat';
import { downloadPersona, MAX_PERSONA_FILE_BYTES, parsePersonaFile } from './personaFiles';

const examples: Record<string, string> = {
  persona_general: 'Help me think through a decision.',
  persona_developer: 'Explain this error and suggest a fix.',
};
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

export function PersonasView() {
  const { personas, activePersonaId, defaultPersonaId, setActivePersonaId, setDefaultPersonaId, savePersona, duplicatePersona, deletePersona, createNewChat } = useAppStore();
  const builderMode = useWorkspacePreferences(s => s.builderMode);
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<{ persona: Persona | null } | null>(null);
  const [preview, setPreview] = useState<Persona | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return personas.filter(p => !q || `${p.name} ${p.description} ${p.communicationStyle} ${p.personalityTraits.join(' ')}`.toLowerCase().includes(q));
  }, [personas, query]);
  const importFile = async (file?: File) => {
    if (!file) return;
    setError(''); setNotice('');
    try {
      if (file.size > MAX_PERSONA_FILE_BYTES) throw new Error('Choose a persona JSON file smaller than 256 KB.');
      const data = parsePersonaFile(await file.text());
      const imported = savePersona(data);
      setNotice(`Imported ${imported.name} as a new custom persona. Review its instructions before using it.`);
      setEditor({ persona: imported });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not import that persona.'); }
    finally { if (importInput.current) importInput.current.value = ''; }
  };
  const usePersona = (persona: Persona) => {
    setActivePersonaId(persona.id);
    createNewChat();
  };
  return <div className="h-full overflow-auto px-6 py-8 sm:px-10" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div><h1 className="flex items-center gap-3 text-2xl font-semibold"><Users size={23} />Personas</h1><p className="mt-2 max-w-xl text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>Choose a style for your local assistant, or create your own. Personas guide how a model responds; they do not give it new abilities.</p></div>
        <div className="flex gap-2"><button className={button} style={{ borderColor: 'var(--border)' }} onClick={() => importInput.current?.click()}><Upload size={14} />Import</button><button className={button} style={{ borderColor: 'var(--theme-accent)', background: 'var(--theme-accent)', color: 'var(--theme-accent-ink)' }} onClick={() => setEditor({ persona: null })}><Plus size={15} />Create persona</button></div>
        <input ref={importInput} type="file" accept=".json,application/json" aria-label="Import persona JSON" className="hidden" onChange={e => void importFile(e.target.files?.[0])} />
      </header>
      <label className="relative block max-w-md"><Search size={16} className="pointer-events-none absolute left-3 top-3" style={{ color: 'var(--muted-foreground)' }} /><span className="sr-only">Search personas</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, purpose, or style" className="w-full rounded-lg border bg-transparent py-2.5 pl-10 pr-3 text-sm" style={{ borderColor: 'var(--border)' }} /></label>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{notice}</p>}
      {preview && <PersonaTestChat key={preview.id} persona={preview} onClose={() => setPreview(null)} />}
      {!filtered.length && <p className="py-12 text-sm" style={{ color: 'var(--muted-foreground)' }}>No personas match that search.</p>}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map(p => <article key={p.id} className="flex flex-col rounded-xl border p-5" style={{ background: 'var(--card)', borderColor: activePersonaId === p.id ? 'var(--theme-accent)' : 'var(--border)' }}>
          <div className="flex items-start justify-between gap-3"><h2 className="text-base font-semibold">{p.name}</h2><span className="shrink-0 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{p.isBuiltIn ? 'Built-in' : 'Custom'}</span></div>
          <p className="mt-2 min-h-12 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{p.description}</p>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>Try: “{examples[p.id] || (p.communicationStyle === 'Creative' ? 'Help me explore a fresh idea.' : p.communicationStyle === 'Academic' ? 'Explain a difficult concept step by step.' : 'Help me make this clearer.')}”</p>
          <div className="mt-4 flex flex-wrap gap-2"><button className={button} style={{ borderColor: 'var(--border)' }} onClick={() => usePersona(p)}><MessageSquare size={13} />Start chat</button><button className={button} style={{ borderColor: 'var(--border)' }} onClick={() => setPreview(p)}><FlaskConical size={13} />Try it</button></div>
          <div className="mt-4 flex flex-wrap items-center gap-1 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <button className="rounded p-2 hover:opacity-70" aria-label={`Make ${p.name} the default`} title="Use by default in new chats" aria-pressed={defaultPersonaId === p.id} onClick={() => { setDefaultPersonaId(p.id); setNotice(`${p.name} is now the default for new chats.`); }}><Star size={15} fill={defaultPersonaId === p.id ? 'currentColor' : 'none'} /></button>
            <button className="rounded p-2 hover:opacity-70" aria-label={`Edit ${p.name}`} title={p.isBuiltIn ? 'Customize a copy' : 'Edit persona'} onClick={() => setEditor({ persona: p })}><Pencil size={14} /></button>
            <button className="rounded p-2 hover:opacity-70" aria-label={`Duplicate ${p.name}`} title="Duplicate persona" onClick={() => { const copy = duplicatePersona(p.id); setEditor({ persona: copy }); }}><Copy size={14} /></button>
            <button className="rounded p-2 hover:opacity-70" aria-label={`Export ${p.name}`} title="Export persona JSON" onClick={() => { try { downloadPersona(p); } catch { setError('Could not export this persona.'); } }}><Download size={15} /></button>
            {!p.isBuiltIn && <button className="rounded p-2 hover:opacity-70" aria-label={`Delete ${p.name}`} title="Delete custom persona" onClick={() => setDeleteId(p.id)}><Trash2 size={14} /></button>}
            <span className="ml-auto text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{builderMode ? p.communicationStyle : defaultPersonaId === p.id ? 'Default' : ''}</span>
          </div>
          {deleteId === p.id && <div className="mt-3 space-y-2 rounded-lg border p-3 text-xs" style={{ borderColor: 'var(--border)' }}><p>Delete “{p.name}”? Existing chat messages will remain.</p><div className="flex gap-3"><button className="text-red-600 dark:text-red-300" onClick={() => { deletePersona(p.id); if (preview?.id === p.id) setPreview(null); setDeleteId(null); }}>Delete persona</button><button onClick={() => setDeleteId(null)}>Cancel</button></div></div>}
        </article>)}
      </div>
      <PersonaEditorModal isOpen={Boolean(editor)} persona={editor?.persona || null} onClose={() => setEditor(null)} onSave={savePersona} />
    </div>
  </div>;
}
