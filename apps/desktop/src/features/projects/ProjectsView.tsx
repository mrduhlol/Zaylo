import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { useProjects } from './useProjects';

export const ProjectsView: React.FC = () => {
  const { projects, selectedProjectId, selectProject, createProject, updateProject, deleteProject } = useProjects();
  const { conversations, ragDocuments, fetchRagDocuments, addRagDocument, createNewChat, selectChat, setConversations } = useAppStore();
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { void fetchRagDocuments(); }, [fetchRagDocuments]);
  const project = projects.find(item => item.id === selectedProjectId);
  const q = query.trim().toLowerCase();
  const visible = projects.filter(item => `${item.name} ${item.instructions}`.toLowerCase().includes(q) || conversations.some(chat => chat.projectId === item.id && !chat.archivedAt && !chat.temporary && `${chat.title} ${JSON.stringify(chat.messages)}`.toLowerCase().includes(q)));
  return <section className="h-full overflow-auto p-6 md:p-10 bg-[var(--background)] text-[var(--foreground)]">
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Projects</h1>
      <form className="flex flex-wrap gap-3" onSubmit={event => { event.preventDefault(); if (name.trim()) { createProject(name); setName(''); setConfirmDelete(false); } }}>
        <input aria-label="New project name" placeholder="Project name" value={name} onChange={event => setName(event.target.value)} className="p-2 rounded-lg bg-[var(--card)] border border-current/20" />
        <button disabled={!name.trim()} className="px-4 py-2 rounded-lg zaylo-composer-glow disabled:opacity-50">Create project</button>
      </form>
      <input aria-label="Search projects and chats" placeholder="Search projects and chats" value={query} onChange={event => setQuery(event.target.value)} className="p-2 rounded-lg bg-[var(--card)] border border-current/20" />
      <div className="grid md:grid-cols-[220px_1fr] gap-8">
        <nav aria-label="Projects" className="space-y-2">{visible.map(item => <button key={item.id} aria-current={item.id === project?.id ? 'page' : undefined} className="block w-full text-left rounded-lg p-3 bg-[var(--card)] zaylo-glow-hover break-words" onClick={() => { selectProject(item.id); setConfirmDelete(false); }}>{item.name} <span className="text-[var(--muted-foreground)]">({conversations.filter(chat => chat.projectId === item.id && !chat.archivedAt && !chat.temporary).length})</span></button>)}{!visible.length && <p className="text-sm text-[var(--muted-foreground)]">{q ? 'No matching projects.' : 'Create a project to group chats, files and instructions.'}</p>}</nav>
        {project && <div key={project.id} className="space-y-6 min-w-0">
          <label className="block space-y-2"><span>Project name</span><input value={project.name} onChange={event => updateProject(project.id, { name: event.target.value })} className="block w-full p-2 rounded-lg bg-[var(--card)] border border-current/20" /></label>
          <label className="block space-y-2"><span>Instructions</span><textarea rows={5} value={project.instructions} placeholder="Context and guidance for every chat in this project" onChange={event => updateProject(project.id, { instructions: event.target.value })} className="block w-full p-3 rounded-lg bg-[var(--card)] border border-current/20" /><span className="block text-xs text-[var(--muted-foreground)]">Saved locally. Applied to future messages in project chats.</span></label>
          <div className="space-y-3"><h2 className="font-semibold">Project files</h2><p className="text-sm text-[var(--muted-foreground)]">Selected documents are available to local retrieval in project chats.</p>
            {ragDocuments.map(doc => <label key={doc.id} className="flex gap-3 items-center text-sm"><input type="checkbox" checked={project.documentIds.includes(doc.id)} onChange={event => updateProject(project.id, { documentIds: event.target.checked ? [...project.documentIds, doc.id] : project.documentIds.filter(id => id !== doc.id) })} />{doc.name}</label>)}
            <label className="block text-sm">{uploading ? 'Adding document…' : 'Add a text or Markdown file'}<input disabled={uploading} type="file" accept=".txt,.md,.markdown" className="block mt-2 max-w-full" onChange={async event => {
              const file = event.target.files?.[0]; if (!file) return;
              event.target.value = ''; setError('');
              if (file.size > 10 * 1024 * 1024) { setError('Choose a document smaller than 10 MB.'); return; }
              setUploading(true);
              try { const doc = await addRagDocument(file.name, await file.text(), file.name.endsWith('.txt') ? 'txt' : 'md'); const current = useProjects.getState().projects.find(item => item.id === project.id); if (current) updateProject(project.id, { documentIds: [...current.documentIds, doc.id] }); }
              catch (err) { setError(err instanceof Error ? err.message : 'Could not add document. Try again.'); }
              finally { setUploading(false); }
            }} /></label>
          </div>
          {error && <p role="alert">{error}</p>}
          <div className="space-y-3"><div className="flex justify-between gap-3 items-center"><h2 className="font-semibold">Chats</h2><button onClick={() => createNewChat({ projectId: project.id })} className="px-3 py-2 rounded-lg zaylo-glow-hover bg-[var(--card)]">New project chat</button></div>
            {conversations.filter(chat => chat.projectId === project.id && !chat.archivedAt && !chat.temporary).map(chat => <button key={chat.id} className="block w-full text-left p-3 rounded-lg bg-[var(--card)] zaylo-glow-hover" onClick={() => selectChat(chat.id)}>{chat.title}</button>)}
          </div>
          <div className="pt-4 border-t border-current/10"><button className="underline text-sm" onClick={() => {
            if (!confirmDelete) { setConfirmDelete(true); return; }
            setConversations(prev => prev.map(chat => chat.projectId === project.id ? { ...chat, projectId: undefined } : chat)); deleteProject(project.id); setConfirmDelete(false);
          }}>{confirmDelete ? 'Confirm remove project (keep chats and files)' : 'Remove project…'}</button>{confirmDelete && <button className="ml-4 underline text-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>}</div>
        </div>}
      </div>
    </div>
  </section>;
};
