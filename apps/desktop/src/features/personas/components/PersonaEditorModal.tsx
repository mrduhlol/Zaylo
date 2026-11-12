import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Save,
  Copy,
  ShieldCheck,
  Eye,
  Sliders,
  AlertCircle,
  Lock,
  MessageSquare,
} from 'lucide-react';
import type { Persona, PersonaCommunicationStyle } from '@local-ai/shared';
import { PersonaPromptAdapter } from '@local-ai/inference';
import { useWorkspacePreferences } from '../../../stores/useWorkspacePreferences';
import { PERSONA_STARTER_TEMPLATES } from '../utils/personaExamples';

interface PersonaEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  persona: Persona | null;
  onSave: (data: {
    id?: string;
    name: string;
    description: string;
    avatar?: string;
    systemInstructions: string;
    personalityTraits?: string[];
    communicationStyle?: PersonaCommunicationStyle;
    responsePreferences?: Persona['responsePreferences'];
    behavioralRules?: string[];
    responseStructure?: string;
    greetingMessage?: string;
  }) => void;
  onDuplicate?: (id: string, newName?: string) => void;
  /** Opens the live preview chat for the persona currently being edited. */
  onPreview?: (persona: Persona) => void;
}

const POPULAR_AVATARS = ['🤖', '💻', '🔬', '✍️', '📊', '🛡️', '🧠', '⚡', '🎨', '🚀', '📚', '💡', '⚖️', '🧭'];

const COMMUNICATION_STYLES: PersonaCommunicationStyle[] = [
  'Professional',
  'Casual',
  'Technical',
  'Concise',
  'Detailed',
  'Friendly',
  'Academic',
  'Creative',
];

export const PersonaEditorModal: React.FC<PersonaEditorModalProps> = ({
  isOpen,
  onClose,
  persona,
  onSave,
  onDuplicate,
  onPreview,
}) => {
  const isEditing = !!persona;
  const isBuiltIn = persona?.isBuiltIn ?? false;
  const builderMode = useWorkspacePreferences((s) => s.builderMode);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('🤖');
  const [communicationStyle, setCommunicationStyle] = useState<PersonaCommunicationStyle>('Professional');
  const [personalityTraitsText, setPersonalityTraitsText] = useState('');
  const [behavioralRulesText, setBehavioralRulesText] = useState('');
  const [responseStructure, setResponseStructure] = useState('');
  const [greetingMessage, setGreetingMessage] = useState('');
  const [reasoningStyle, setReasoningStyle] = useState('');
  const [codeFormatting, setCodeFormatting] = useState('');
  const [formatPreference, setFormatPreference] = useState('');
  const [systemInstructions, setSystemInstructions] = useState('');
  const [starterTemplateId, setStarterTemplateId] = useState<string>(PERSONA_STARTER_TEMPLATES[0].id);

  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Dirty tracking powers the unsaved-changes guard on close.
  const initialSnapshotRef = useRef<string>('');
  const snapshot = useMemo(
    () =>
      JSON.stringify([
        name, description, avatar, communicationStyle, personalityTraitsText,
        behavioralRulesText, responseStructure, greetingMessage, reasoningStyle,
        codeFormatting, formatPreference, systemInstructions, starterTemplateId,
      ]),
    [name, description, avatar, communicationStyle, personalityTraitsText,
      behavioralRulesText, responseStructure, greetingMessage, reasoningStyle,
      codeFormatting, formatPreference, systemInstructions, starterTemplateId]
  );
  const isDirty =
    initialSnapshotRef.current !== '' && snapshot !== initialSnapshotRef.current;

  useEffect(() => {
    if (persona) {
      setName(isBuiltIn ? `Custom ${persona.name}` : persona.name);
      setDescription(persona.description || '');
      setAvatar(persona.avatar || '🤖');
      setCommunicationStyle(persona.communicationStyle || 'Professional');
      setPersonalityTraitsText(persona.personalityTraits ? persona.personalityTraits.join(', ') : '');
      setBehavioralRulesText(persona.behavioralRules ? persona.behavioralRules.join('\n') : '');
      setResponseStructure(persona.responseStructure || '');
      setGreetingMessage(persona.greetingMessage || '');
      setReasoningStyle(persona.responsePreferences?.reasoningStyle || '');
      setCodeFormatting(persona.responsePreferences?.codeFormatting || '');
      setFormatPreference(persona.responsePreferences?.formatPreference || '');
      setSystemInstructions(persona.systemInstructions || '');
    } else {
      const template = PERSONA_STARTER_TEMPLATES[0];
      applyTemplate(template.id);
    }
    setErrorMessage(null);
    setActiveTab('editor');
    setConfirmDiscard(false);
    // Freeze the dirty-check baseline once the fields are populated.
    requestAnimationFrame(() => {
      initialSnapshotRef.current = snapshot;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, isOpen, isBuiltIn]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isDirty]);

  if (!isOpen) return null;

  function applyTemplate(templateId: string) {
    const template =
      PERSONA_STARTER_TEMPLATES.find((t) => t.id === templateId) || PERSONA_STARTER_TEMPLATES[0];
    setStarterTemplateId(template.id);
    setName('');
    setDescription(template.description);
    setAvatar(template.emoji);
    setCommunicationStyle(template.communicationStyle);
    setPersonalityTraitsText(template.personalityTraits.join(', '));
    setBehavioralRulesText(template.behavioralRules.join('\n'));
    setResponseStructure('Direct answer followed by detailed explanation.');
    setGreetingMessage('');
    setReasoningStyle('Direct and structured');
    setCodeFormatting('Clean Markdown');
    setFormatPreference('Standard Markdown');
    setSystemInstructions(template.systemInstructions);
  }

  /** Honors the unsaved-changes guard instead of silently losing edits. */
  const requestClose = () => {
    if (isDirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    setConfirmDiscard(false);
    onClose();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please enter a name for the persona.');
      return;
    }

    if (!systemInstructions.trim()) {
      setErrorMessage('Please provide core system instructions.');
      return;
    }

    const traits = personalityTraitsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const rules = behavioralRulesText
      .split('\n')
      .map((r) => r.trim().replace(/^[-*•]\s*/, ''))
      .filter(Boolean);

    onSave({
      id: isBuiltIn ? undefined : persona?.id,
      name: name.trim(),
      description: description.trim(),
      avatar: avatar.trim() || '🤖',
      communicationStyle,
      personalityTraits: traits.length > 0 ? traits : ['Adaptive'],
      behavioralRules: rules,
      responseStructure: responseStructure.trim() || 'Clear and structured response.',
      greetingMessage: greetingMessage.trim() || undefined,
      responsePreferences: {
        reasoningStyle: reasoningStyle.trim() || undefined,
        codeFormatting: codeFormatting.trim() || undefined,
        formatPreference: formatPreference.trim() || undefined,
      },
      systemInstructions: systemInstructions.trim(),
    });

    initialSnapshotRef.current = '';
    onClose();
  };

  const draftPersonaForPreview: Persona = {
    id: persona?.id || 'preview',
    name: name || 'Untitled Persona',
    description,
    avatar,
    communicationStyle,
    personalityTraits: personalityTraitsText.split(',').map((t) => t.trim()).filter(Boolean),
    behavioralRules: behavioralRulesText
      .split('\n')
      .map((r) => r.trim().replace(/^[-*•]\s*/, ''))
      .filter(Boolean),
    responseStructure,
    greetingMessage,
    responsePreferences: {
      reasoningStyle,
      codeFormatting,
      formatPreference,
    },
    systemInstructions,
    isBuiltIn: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const previewComposedPrompt = PersonaPromptAdapter.composeSystemPrompt(
    'You are a private local AI assistant running on this server.',
    draftPersonaForPreview
  );

  const inputClass =
    'w-full px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-accent)]';
  const inputStyle = {
    backgroundColor: 'var(--background)',
    borderColor: 'var(--border, rgba(128,128,128,0.2))',
    color: 'var(--foreground)',
  } as const;
  const labelStyle = { color: 'var(--muted-foreground)' } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="persona-editor-title"
        className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border, rgba(128,128,128,0.2))', color: 'var(--foreground)' }}
      >
        {/* Modal Header */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))', backgroundColor: 'var(--background)' }}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl" aria-hidden="true">{avatar}</span>
            <div>
              <h2 id="persona-editor-title" className="text-sm font-bold flex items-center gap-2">
                <span>{isEditing ? (isBuiltIn ? `Inspect Preset: ${persona.name}` : `Edit Persona: ${persona.name}`) : 'Create New Persona'}</span>
                {isBuiltIn && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <ShieldCheck className="w-2.5 h-2.5" aria-hidden="true" />
                    <span>BUILT-IN PRESET</span>
                  </span>
                )}
              </h2>
              <p className="text-[11px] mt-0.5" style={labelStyle}>
                {isBuiltIn
                  ? 'Built-in presets are protected. Modifications will be saved as a new custom persona.'
                  : 'Customize how your local AI reasons, communicates, and structures responses.'}
              </p>
            </div>
          </div>

          <button
            onClick={requestClose}
            aria-label="Close persona editor"
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            style={labelStyle}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Tab Controls: Editor vs Prompt Preview */}
        <div
          className="px-6 pt-3 border-b flex items-center gap-2"
          style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))', backgroundColor: 'var(--background)' }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            aria-pressed={activeTab === 'editor'}
            className={`flex items-center gap-1.5 px-3 py-1.5 border-b-2 text-xs font-medium transition-colors ${
              activeTab === 'editor' ? 'font-semibold' : ''
            }`}
            style={{
              borderBottomColor: activeTab === 'editor' ? 'var(--theme-accent)' : 'transparent',
              color: activeTab === 'editor' ? 'var(--foreground)' : labelStyle.color,
            }}
          >
            <Sliders className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Profile Configuration</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            aria-pressed={activeTab === 'preview'}
            className={`flex items-center gap-1.5 px-3 py-1.5 border-b-2 text-xs font-medium transition-colors ${
              activeTab === 'preview' ? 'font-semibold' : ''
            }`}
            style={{
              borderBottomColor: activeTab === 'preview' ? 'var(--theme-accent)' : 'transparent',
              color: activeTab === 'preview' ? 'var(--foreground)' : labelStyle.color,
            }}
          >
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Composed Prompt Preview</span>
          </button>
          {onPreview && (
            <button
              type="button"
              onClick={() => {
                const previewPersona: Persona = {
                  ...draftPersonaForPreview,
                  id: persona?.id || 'preview',
                  isBuiltIn: false,
                };
                onPreview(previewPersona);
              }}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors mb-1"
              style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))' }}
              title="Test this persona in a live local chat"
            >
              <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Live Preview</span>
            </button>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ backgroundColor: 'var(--card)' }}>
          {errorMessage && (
            <div role="alert" className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {confirmDiscard && isDirty && (
            <div role="alertdialog" aria-label="Unsaved changes" className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs flex items-center justify-between gap-3">
              <span className="text-amber-700 dark:text-amber-300">
                You have unsaved changes. Discard them?
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                  className="px-2.5 py-1 rounded-md border text-[11px] font-medium hover:bg-black/5 dark:hover:bg-white/10"
                  style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))' }}
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDiscard(false);
                    initialSnapshotRef.current = '';
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/40 text-rose-600 dark:text-rose-300 text-[11px] font-medium hover:bg-rose-500/25"
                >
                  Discard changes
                </button>
              </span>
            </div>
          )}

          {activeTab === 'preview' ? (
            <div className="space-y-3">
              <div className="text-xs" style={labelStyle}>
                This preview illustrates how this persona's directives will be layered onto the model's runtime prompt alongside base system instructions:
              </div>
              <pre
                className="p-4 rounded-xl border text-[11px] font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed max-h-96"
                style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border, rgba(128,128,128,0.2))', color: 'var(--foreground)' }}
              >
                {previewComposedPrompt}
              </pre>
            </div>
          ) : (
            <form id="persona-form" onSubmit={handleFormSubmit} className="space-y-4">
              {/* Starter template picker (new personas in normal mode) */}
              {!isEditing && !builderMode && (
                <fieldset className="space-y-1.5">
                  <legend className="text-xs font-semibold" style={labelStyle}>
                    Start from a useful template
                  </legend>
                  <div className="grid grid-cols-3 gap-2">
                    {PERSONA_STARTER_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyTemplate(template.id)}
                        aria-pressed={starterTemplateId === template.id}
                        className="p-2.5 rounded-lg border text-left text-[11px] transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        style={{
                          borderColor:
                            starterTemplateId === template.id
                              ? 'var(--theme-accent)'
                              : 'var(--border, rgba(128,128,128,0.2))',
                          boxShadow: starterTemplateId === template.id ? '0 0 0 1px var(--theme-accent)' : undefined,
                        }}
                      >
                        <span className="block text-base" aria-hidden="true">{template.emoji}</span>
                        <span className="block font-semibold mt-0.5">{template.label}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {/* Name & Avatar */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-3 space-y-1">
                  <label htmlFor="persona-name" className="text-xs font-semibold block" style={labelStyle}>
                    Persona Name <span className="text-rose-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="persona-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Senior Backend Architect"
                    required
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="persona-avatar" className="text-xs font-semibold block" style={labelStyle}>
                    Avatar
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="persona-avatar"
                      type="text"
                      value={avatar}
                      onChange={(e) => setAvatar(e.target.value)}
                      maxLength={4}
                      className="w-14 px-2 py-2 text-center rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-accent)]"
                      style={inputStyle}
                    />
                    <div className="flex gap-1 overflow-x-auto py-1" role="group" aria-label="Popular avatars">
                      {POPULAR_AVATARS.slice(0, 4).map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setAvatar(em)}
                          aria-label={`Use avatar ${em}`}
                          className="px-1.5 py-1 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs transition-colors"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label htmlFor="persona-description" className="text-xs font-semibold block" style={labelStyle}>
                  Short Description
                </label>
                <input
                  id="persona-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Specialized in system design, distributed consensus, and concurrency."
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              {/* Communication Style & Response Structure */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="persona-style" className="text-xs font-semibold block" style={labelStyle}>
                    Communication Style (tone)
                  </label>
                  <select
                    id="persona-style"
                    value={communicationStyle}
                    onChange={(e) => setCommunicationStyle(e.target.value as PersonaCommunicationStyle)}
                    className={inputClass}
                    style={inputStyle}
                  >
                    {COMMUNICATION_STYLES.map((style) => (
                      <option key={style} value={style}>
                        {style}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="persona-structure" className="text-xs font-semibold block" style={labelStyle}>
                    Preferred Response Structure
                  </label>
                  <input
                    id="persona-structure"
                    type="text"
                    value={responseStructure}
                    onChange={(e) => setResponseStructure(e.target.value)}
                    placeholder="e.g. Direct solution first, then rationale and edge cases."
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Personality Traits */}
              <div className="space-y-1">
                <label htmlFor="persona-traits" className="text-xs font-semibold block" style={labelStyle}>
                  Personality Traits (comma-separated)
                </label>
                <input
                  id="persona-traits"
                  type="text"
                  value={personalityTraitsText}
                  onChange={(e) => setPersonalityTraitsText(e.target.value)}
                  placeholder="e.g. Technical, Rigorous, Solution-Oriented"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              {/* Behavioral Directives */}
              <div className="space-y-1">
                <label htmlFor="persona-rules" className="text-xs font-semibold block" style={labelStyle}>
                  Behavioral Directives & Rules (one per line)
                </label>
                <textarea
                  id="persona-rules"
                  value={behavioralRulesText}
                  onChange={(e) => setBehavioralRulesText(e.target.value)}
                  rows={3}
                  placeholder={`- Always provide production-ready code with error checks\n- Cite assumptions explicitly\n- Avoid unnecessary conversational filler`}
                  className={`${inputClass} font-mono`}
                  style={inputStyle}
                />
              </div>

              {/* Response Preferences */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label htmlFor="persona-reasoning" className="text-[11px] font-semibold block" style={labelStyle}>
                    Reasoning Style
                  </label>
                  <input
                    id="persona-reasoning"
                    type="text"
                    value={reasoningStyle}
                    onChange={(e) => setReasoningStyle(e.target.value)}
                    placeholder="e.g. First-principles"
                    className={`${inputClass} px-2.5 py-1.5`}
                    style={inputStyle}
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="persona-codeformat" className="text-[11px] font-semibold block" style={labelStyle}>
                    Code Formatting
                  </label>
                  <input
                    id="persona-codeformat"
                    type="text"
                    value={codeFormatting}
                    onChange={(e) => setCodeFormatting(e.target.value)}
                    placeholder="e.g. Typed snippets"
                    className={`${inputClass} px-2.5 py-1.5`}
                    style={inputStyle}
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="persona-format" className="text-[11px] font-semibold block" style={labelStyle}>
                    Output Format
                  </label>
                  <input
                    id="persona-format"
                    type="text"
                    value={formatPreference}
                    onChange={(e) => setFormatPreference(e.target.value)}
                    placeholder="e.g. Markdown tables"
                    className={`${inputClass} px-2.5 py-1.5`}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Optional Greeting Message */}
              <div className="space-y-1">
                <label htmlFor="persona-greeting" className="text-xs font-semibold block" style={labelStyle}>
                  Optional Greeting Message
                </label>
                <input
                  id="persona-greeting"
                  type="text"
                  value={greetingMessage}
                  onChange={(e) => setGreetingMessage(e.target.value)}
                  placeholder="e.g. Ready to architect your distributed system. Where shall we start?"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              {/* Core System Instructions — readable everywhere, raw edit in Builder mode */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="persona-instructions" className="text-xs font-semibold" style={labelStyle}>
                    Core System Instructions <span className="text-rose-500" aria-hidden="true">*</span>
                  </label>
                  <span className="text-[10px] font-mono flex items-center gap-1" style={labelStyle}>
                    {builderMode ? (
                      <>
                        <Sliders className="w-3 h-3" aria-hidden="true" />
                        <span>Builder: raw editing enabled</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3" aria-hidden="true" />
                        <span>Raw editing available in Builder mode</span>
                      </>
                    )}
                  </span>
                </div>
                {builderMode ? (
                  <textarea
                    id="persona-instructions"
                    value={systemInstructions}
                    onChange={(e) => setSystemInstructions(e.target.value)}
                    rows={5}
                    required
                    placeholder="Define the primary personality, depth, analytical rigor, and core behavior of this persona..."
                    className={`${inputClass} font-mono leading-relaxed`}
                    style={inputStyle}
                  />
                ) : (
                  <>
                    <textarea
                      id="persona-instructions"
                      value={systemInstructions}
                      readOnly
                      rows={3}
                      aria-describedby="persona-instructions-note"
                      className={`${inputClass} font-mono leading-relaxed opacity-80 resize-none`}
                      style={inputStyle}
                    />
                    <p id="persona-instructions-note" className="text-[10px]" style={labelStyle}>
                      Shown as written so you always know what the persona says. Switch to Builder mode in
                      Settings to edit these raw instructions.
                    </p>
                  </>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div
          className="px-6 py-4 border-t flex items-center justify-between"
          style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))', backgroundColor: 'var(--background)' }}
        >
          <div>
            {persona && onDuplicate && (
              <button
                type="button"
                onClick={() => {
                  onDuplicate(persona.id, `Copy of ${persona.name}`);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))' }}
              >
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Duplicate as Custom</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={requestClose}
              className="px-4 py-1.5 rounded-lg border text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))', color: 'var(--muted-foreground)' }}
            >
              Cancel
            </button>

            <button
              type="submit"
              form="persona-form"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--theme-accent)', color: 'var(--theme-accent-ink, #111)' }}
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isBuiltIn ? 'Save as Custom Persona' : isEditing ? 'Save Changes' : 'Create Persona'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
