import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Users,
  Plus,
  Search,
  Sparkles,
  ShieldCheck,
  Filter,
  Star,
  MessageSquare,
  FileJson,
  AlertCircle,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useWorkspacePreferences } from '../../stores/useWorkspacePreferences';
import type { Persona } from '@local-ai/shared';
import { PersonaCard } from './components/PersonaCard';
import { PersonaEditorModal } from './components/PersonaEditorModal';
import { PersonaImportExportDialog } from './components/PersonaImportExportDialog';
import { PersonaPreviewChat } from './components/PersonaPreviewChat';
import { serializePersonaForExport } from './utils/personaIO';

const STYLE_FILTERS = ['All', 'Professional', 'Technical', 'Academic', 'Creative', 'Concise'];

const borderToken = 'var(--border, rgba(128,128,128,0.2))';

export const PersonasView: React.FC = () => {
  const {
    personas,
    activePersonaId,
    defaultPersonaId,
    setActivePersonaId,
    setDefaultPersonaId,
    savePersona,
    duplicatePersona,
    deletePersona,
    setActiveTab,
  } = useAppStore();
  const workspaceDefaultPersonaId = useWorkspacePreferences((s) => s.defaultPersonaId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStyleFilter, setSelectedStyleFilter] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [previewPersona, setPreviewPersona] = useState<Persona | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);

  // One-way sync from the Settings-side workspace preference default, so
  // there is never a second conflicting default: the store stays the single
  // source of truth for persona data.
  const syncedPrefRef = useRef<string | null>(null);
  useEffect(() => {
    if (!workspaceDefaultPersonaId) return;
    if (syncedPrefRef.current === workspaceDefaultPersonaId) return;
    syncedPrefRef.current = workspaceDefaultPersonaId;
    const target = personas.find((p) => p.id === workspaceDefaultPersonaId);
    if (target && target.id !== defaultPersonaId) {
      setDefaultPersonaId(target.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceDefaultPersonaId, personas]);

  // Active persona resolution
  const activePersona = useMemo(() => {
    return personas.find((p) => p.id === activePersonaId) || personas.find((p) => p.isDefault) || personas[0];
  }, [personas, activePersonaId]);

  // Default persona resolution
  const defaultPersona = useMemo(() => {
    return personas.find((p) => p.id === defaultPersonaId) || personas.find((p) => p.id === 'persona_general') || personas[0];
  }, [personas, defaultPersonaId]);

  // Filter personas
  const filteredPersonas = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return personas.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.communicationStyle.toLowerCase().includes(q) ||
        p.personalityTraits.some((t) => t.toLowerCase().includes(q));

      const matchesStyle =
        selectedStyleFilter === 'All' ||
        p.communicationStyle.toLowerCase() === selectedStyleFilter.toLowerCase();

      return matchesSearch && matchesStyle;
    });
  }, [personas, searchQuery, selectedStyleFilter]);

  const builtInPersonas = useMemo(() => {
    return filteredPersonas.filter((p) => p.isBuiltIn);
  }, [filteredPersonas]);

  const customPersonas = useMemo(() => {
    return filteredPersonas.filter((p) => !p.isBuiltIn);
  }, [filteredPersonas]);

  const handleOpenCreateModal = () => {
    setEditingPersona(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (persona: Persona) => {
    setEditingPersona(persona);
    setIsModalOpen(true);
  };

  const handleDuplicate = (id: string, newName?: string) => {
    try {
      const dup = duplicatePersona(id, newName);
      setEditingPersona(dup);
      setIsModalOpen(true);
    } catch (err: any) {
      setViewError(`Failed to duplicate persona: ${err?.message || 'unknown error'}`);
    }
  };

  const handleDelete = (id: string) => {
    const target = personas.find((p) => p.id === id);
    if (!target) return;
    if (confirm(`Are you sure you want to delete custom persona "${target.name}"?`)) {
      try {
        deletePersona(id);
      } catch (err: any) {
        setViewError(err?.message || 'Failed to delete persona.');
      }
    }
  };

  const downloadPersonaJson = (persona: Persona) => {
    const json = serializePersonaForExport(persona);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `zaylo-${persona.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'persona'}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const openPreview = (persona: Persona) => {
    setPreviewPersona(persona);
  };

  return (
    <div className="p-8 space-y-7 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-4rem)] select-none">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5" style={{ borderColor: borderToken }}>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              <Users className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
              Personas
            </h1>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-mono border"
              style={{ backgroundColor: 'var(--background)', borderColor: borderToken, color: 'var(--muted-foreground)' }}
            >
              One AI Engine · Multiple Personalities
            </span>
          </div>
          <p className="text-xs mt-1 max-w-2xl leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            Configure specialized behavioral and instruction profiles that adapt how your local models respond, reason, and communicate without requiring separate model weights.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsImportExportOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ borderColor: borderToken, color: 'var(--foreground)' }}
            title="Import or export personas as offline JSON files"
          >
            <FileJson className="w-4 h-4" aria-hidden="true" />
            <span>Import / Export</span>
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--theme-accent)', color: 'var(--theme-accent-ink, #fff)' }}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Create Persona</span>
          </button>
        </div>
      </div>

      {/* Error banner (replaces blocking alert() popups) */}
      {viewError && (
        <div role="alert" className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-300 text-xs flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{viewError}</span>
          </span>
          <button
            onClick={() => setViewError(null)}
            className="shrink-0 underline underline-offset-2 font-medium hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Persona Banner */}
      {activePersona && (
        <div
          className="p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs"
          style={{ backgroundColor: 'var(--card)', borderColor: borderToken }}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-10 h-10 rounded-xl border flex items-center justify-center text-xl shrink-0"
              style={{ backgroundColor: 'var(--background)', borderColor: borderToken }}
              aria-hidden="true"
            >
              {activePersona.avatar || '🤖'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>Current Global Active Persona:</span>
                <span className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>{activePersona.name}</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                  <span>ACTIVE</span>
                </span>
                {activePersona.id === defaultPersona?.id && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <Star className="w-2.5 h-2.5 fill-current" aria-hidden="true" />
                    <span>DEFAULT</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] truncate mt-0.5 max-w-xl" style={{ color: 'var(--muted-foreground)' }}>
                {activePersona.description || 'Instruction profile applied to new conversations.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => openPreview(activePersona)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--theme-accent)', color: 'var(--theme-accent-ink, #fff)' }}
              title="Test this persona in a live local preview chat"
            >
              <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Preview Chat</span>
            </button>
            <button
              onClick={() => setActiveTab('playground')}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor: borderToken, color: 'var(--foreground)' }}
              title="Open Playground with this active persona"
            >
              <span>Chat in Playground</span>
            </button>
            <button
              onClick={() => handleOpenEditModal(activePersona)}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor: borderToken, color: 'var(--muted-foreground)' }}
            >
              {activePersona.isBuiltIn ? 'View Directives' : 'Edit Profile'}
            </button>
          </div>
        </div>
      )}

      {/* Search & Style Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} aria-hidden="true" />
          <label htmlFor="persona-search" className="sr-only">Search personas</label>
          <input
            id="persona-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search personas by name, purpose, or traits..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-accent)]"
            style={{ backgroundColor: 'var(--card)', borderColor: borderToken, color: 'var(--foreground)' }}
          />
        </div>

        {/* Style Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs" role="group" aria-label="Filter by communication style">
          <span className="text-[11px] font-mono flex items-center gap-1 mr-1" style={{ color: 'var(--muted-foreground)' }}>
            <Filter className="w-3 h-3" aria-hidden="true" />
            <span>Style:</span>
          </span>
          {STYLE_FILTERS.map((style) => (
            <button
              key={style}
              onClick={() => setSelectedStyleFilter(style)}
              aria-pressed={selectedStyleFilter === style}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
              style={
                selectedStyleFilter === style
                  ? { backgroundColor: 'var(--theme-accent)', color: 'var(--theme-accent-ink, #fff)' }
                  : { backgroundColor: 'var(--card)', border: `1px solid ${borderToken}`, color: 'var(--muted-foreground)' }
              }
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Built-in Presets Section */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" style={{ color: 'var(--foreground)' }} aria-hidden="true" />
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
              Built-in Protected Presets ({builtInPersonas.length})
            </h2>
          </div>
          <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
            Guaranteed default profiles · Duplicate to customize
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {builtInPersonas.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              isActive={persona.id === activePersonaId}
              isDefault={persona.id === defaultPersonaId}
              onActivate={() => setActivePersonaId(persona.id)}
              onSetDefault={() => setDefaultPersonaId(persona.id)}
              onEdit={() => handleOpenEditModal(persona)}
              onDuplicate={() => handleDuplicate(persona.id)}
              onPreview={() => openPreview(persona)}
            />
          ))}
        </div>
      </div>

      {/* Custom Personas Section */}
      <div className="space-y-3.5 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: 'var(--foreground)' }} aria-hidden="true" />
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
              Custom Personas ({customPersonas.length})
            </h2>
          </div>
          <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
            Tailored personalities created by you
          </span>
        </div>

        {customPersonas.length === 0 ? (
          <div
            className="p-8 rounded-xl border border-dashed text-center space-y-3"
            style={{ backgroundColor: 'var(--card)', borderColor: borderToken }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mx-auto text-lg"
              style={{ backgroundColor: 'var(--background)', color: 'var(--muted-foreground)' }}
              aria-hidden="true"
            >
              ✨
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>No custom personas yet</h3>
              <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: 'var(--muted-foreground)' }}>
                Create tailored AI profiles for specialized workflows, unique domain expertise, or distinct reasoning styles. You can also import personas shared as JSON.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--theme-accent)', color: 'var(--theme-accent-ink, #fff)' }}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Create Custom Persona</span>
              </button>
              <button
                onClick={() => setIsImportExportOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ borderColor: borderToken, color: 'var(--foreground)' }}
              >
                <FileJson className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Import JSON</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customPersonas.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                isActive={persona.id === activePersonaId}
                isDefault={persona.id === defaultPersonaId}
                onActivate={() => setActivePersonaId(persona.id)}
                onSetDefault={() => setDefaultPersonaId(persona.id)}
                onEdit={() => handleOpenEditModal(persona)}
                onDuplicate={() => handleDuplicate(persona.id)}
                onDelete={() => handleDelete(persona.id)}
                onPreview={() => openPreview(persona)}
                onExport={() => downloadPersonaJson(persona)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Persona Creation / Editing Modal */}
      <PersonaEditorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        persona={editingPersona}
        onSave={savePersona}
        onDuplicate={handleDuplicate}
        onPreview={(persona) => {
          setIsModalOpen(false);
          openPreview(persona);
        }}
      />

      {/* Offline Import / Export */}
      <PersonaImportExportDialog
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        personas={personas}
        onImport={(imported) => {
          for (const persona of imported) {
            savePersona({
              id: undefined,
              name: persona.name,
              description: persona.description,
              avatar: persona.avatar,
              systemInstructions: persona.systemInstructions,
              personalityTraits: persona.personalityTraits,
              communicationStyle: persona.communicationStyle,
              responsePreferences: persona.responsePreferences,
              behavioralRules: persona.behavioralRules,
              responseStructure: persona.responseStructure,
              greetingMessage: persona.greetingMessage,
            });
          }
        }}
      />

      {/* Live Local Preview Chat (ephemeral, never saved) */}
      <PersonaPreviewChat
        persona={previewPersona || activePersona}
        isOpen={previewPersona !== null}
        onClose={() => setPreviewPersona(null)}
        onOpenModels={() => {
          setPreviewPersona(null);
          setActiveTab('models');
        }}
      />
    </div>
  );
};
