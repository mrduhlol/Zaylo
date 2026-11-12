import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Save, X } from 'lucide-react';
import type { Persona, PersonaCommunicationStyle } from '@local-ai/shared';
import { PersonaPromptAdapter } from '@local-ai/inference';
import { useWorkspacePreferences } from '../../../stores/useWorkspacePreferences';
import { SettingsSelect } from '../../settings/SettingsControls';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  persona: Persona | null;
  onSave: (data: { id?: string; name: string; description: string; avatar?: string; systemInstructions: string;
    personalityTraits?: string[]; communicationStyle?: PersonaCommunicationStyle;
    responsePreferences?: Persona['responsePreferences']; behavioralRules?: string[];
    responseStructure?: string; greetingMessage?: string }) => void;
  onDuplicate?: (id: string, newName?: string) => void;
}
const styles: PersonaCommunicationStyle[] = ['Professional', 'Casual', 'Technical', 'Concise', 'Detailed', 'Friendly', 'Academic', 'Creative'];
function draftFrom(p: Persona | null) {
  return {
    name: p ? `${p.isBuiltIn ? 'Custom ' : ''}${p.name}` : '', description: p?.description || '',
    avatar: p?.avatar || '', systemInstructions: p?.systemInstructions || '',
    communicationStyle: p?.communicationStyle || 'Friendly' as PersonaCommunicationStyle,
    traits: p?.personalityTraits.join(', ') || 'Helpful, Clear', rules: p?.behavioralRules.join('\n') || '',
    responseStructure: p?.responseStructure || '', greetingMessage: p?.greetingMessage || '',
    reasoningStyle: p?.responsePreferences?.reasoningStyle || '', codeFormatting: p?.responsePreferences?.codeFormatting || '',
    formatPreference: p?.responsePreferences?.formatPreference || '',
  };
}
const inputStyle = { borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--background)' };
const inputClass = 'mt-2 w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

export function PersonaEditorModal({ isOpen, onClose, persona, onSave }: Props) {
  const builder = useWorkspacePreferences(s => s.builderMode);
  const [draft, setDraft] = useState(() => draftFrom(persona));
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const initial = useRef(JSON.stringify(draft));
  useEffect(() => {
    const next = draftFrom(persona); setDraft(next); initial.current = JSON.stringify(next); setError(''); setDiscard(false);
  }, [isOpen, persona]);
  const change = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => setDraft(d => ({ ...d, [key]: value }));
  const close = () => { if (JSON.stringify(draft) !== initial.current) setDiscard(true); else onClose(); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!draft.name.trim() || !draft.systemInstructions.trim()) { setError('Add a name and instructions before saving.'); return; }
    if (draft.name.length > 100 || draft.systemInstructions.length > 32000) { setError('Use a shorter name or instructions.'); return; }
    try {
      onSave({
        id: persona?.isBuiltIn ? undefined : persona?.id,
        name: draft.name.trim(), description: draft.description.trim(), avatar: draft.avatar || undefined,
        systemInstructions: draft.systemInstructions.trim(), communicationStyle: draft.communicationStyle,
        personalityTraits: draft.traits.split(',').map(v => v.trim()).filter(Boolean),
        behavioralRules: draft.rules.split('\n').map(v => v.trim()).filter(Boolean),
        responseStructure: draft.responseStructure, greetingMessage: draft.greetingMessage || undefined,
        responsePreferences: { reasoningStyle: draft.reasoningStyle || undefined, codeFormatting: draft.codeFormatting || undefined, formatPreference: draft.formatPreference || undefined },
      });
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this persona.'); }
  };
  const preview = PersonaPromptAdapter.composeSystemPrompt('', {
    id: 'editor-preview', name: draft.name, description: draft.description, avatar: draft.avatar,
    systemInstructions: draft.systemInstructions, communicationStyle: draft.communicationStyle,
    personalityTraits: draft.traits.split(',').map(v => v.trim()).filter(Boolean),
    behavioralRules: draft.rules.split('\n').filter(Boolean), responseStructure: draft.responseStructure,
    responsePreferences: { reasoningStyle: draft.reasoningStyle, codeFormatting: draft.codeFormatting, formatPreference: draft.formatPreference },
    isBuiltIn: false, createdAt: 0, updatedAt: 0,
  });
  return <Dialog.Root open={isOpen} onOpenChange={open => { if (!open) close(); }}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
    <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border shadow-2xl" style={{ width: 'min(640px, calc(100% - 32px))', background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}>
      <header className="flex items-start justify-between gap-4 border-b p-5" style={{ borderColor: 'var(--border)' }}><div><Dialog.Title className="text-lg font-semibold">{persona ? persona.isBuiltIn ? 'Customize a copy' : 'Edit persona' : 'Create persona'}</Dialog.Title><Dialog.Description className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{persona?.isBuiltIn ? 'The built-in preset stays unchanged. Save your changes as a custom persona.' : 'Tell your assistant how you want it to help.'}</Dialog.Description></div><button aria-label="Close editor" onClick={close}><X size={18} /></button></header>
      <form id="persona-form" onSubmit={submit} className="space-y-5 overflow-auto p-5">
        <label className="block text-xs font-medium">Name<input required maxLength={100} value={draft.name} onChange={e => change('name', e.target.value)} className={inputClass} style={inputStyle} placeholder="e.g. Patient study tutor" /></label>
        <label className="block text-xs font-medium">Description<input maxLength={2000} value={draft.description} onChange={e => change('description', e.target.value)} className={inputClass} style={inputStyle} placeholder="What is this persona useful for?" /></label>
        <div className="space-y-2"><span id="persona-tone-label" className="text-xs font-medium">Tone</span><SettingsSelect label="Persona tone" value={draft.communicationStyle} options={styles.map(value => ({ value, label: value }))} onChange={value => change('communicationStyle', value as PersonaCommunicationStyle)} /></div>
        <label className="block text-xs font-medium">{builder ? 'System instructions' : 'How should your assistant help?'}<textarea required maxLength={32000} rows={5} value={draft.systemInstructions} onChange={e => change('systemInstructions', e.target.value)} className={inputClass} style={inputStyle} placeholder="Explain concepts patiently. Ask one question at a time and help me work out the answer." /></label>
        <label className="block text-xs font-medium">Opening message <span style={{ color: 'var(--muted-foreground)' }}>(optional)</span><input value={draft.greetingMessage} onChange={e => change('greetingMessage', e.target.value)} className={inputClass} style={inputStyle} /></label>
        {builder && <details className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}><summary className="cursor-pointer text-xs font-semibold">Advanced persona controls</summary><div className="mt-4 space-y-4">{([
          ['avatar', 'Avatar'], ['traits', 'Traits (comma separated)'], ['responseStructure', 'Response structure'], ['reasoningStyle', 'Reasoning style'], ['codeFormatting', 'Code formatting'], ['formatPreference', 'Format preference'],
        ] as const).map(([key, label]) => <label key={key} className="block text-xs">{label}<input value={draft[key]} onChange={e => change(key, e.target.value)} className={inputClass} style={inputStyle} /></label>)}<label className="block text-xs">Behavioral rules (one per line)<textarea rows={3} value={draft.rules} onChange={e => change('rules', e.target.value)} className={inputClass} style={inputStyle} /></label><details><summary className="cursor-pointer text-xs">Inspect composed system prompt</summary><pre className="mt-3 whitespace-pre-wrap rounded-lg p-3 text-xs" style={{ background: 'var(--background)' }}>{preview}</pre></details></div></details>}
        {error && <p role="alert" className="text-xs text-red-600 dark:text-red-300">{error}</p>}
        {discard && <div role="alert" className="space-y-3 rounded-lg border p-3 text-xs" style={{ borderColor: 'var(--border)' }}><p>Discard your unsaved changes?</p><div className="flex gap-4"><button type="button" onClick={onClose} className="text-red-600 dark:text-red-300">Discard changes</button><button type="button" onClick={() => setDiscard(false)}>Keep editing</button></div></div>}
      </form>
      <footer className="flex justify-end gap-3 border-t p-4" style={{ borderColor: 'var(--border)' }}><button type="button" onClick={close} className="rounded-lg px-3 py-2 text-xs">Cancel</button><button type="submit" form="persona-form" className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium" style={{ background: 'var(--theme-accent)', color: 'var(--theme-accent-ink)' }}><Save size={14} />{persona?.isBuiltIn ? 'Save custom copy' : 'Save persona'}</button></footer>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
