import { useEffect, useState, type ReactNode } from 'react';
import { Atom, Search } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useWorkspacePreferences, type ThemeFamily } from '../../stores/useWorkspacePreferences';
import { api } from '../../api/client';
import { controlClass, SettingsRow, SettingsSelect, SettingsToggle, ThemeArtwork } from './SettingsControls';
import { shortcutConflict, shortcutFromEvent, shortcutLabels } from './useWorkspaceShortcuts';

const categories = ['General', 'Appearance', 'Chat', 'Voice', 'Models', 'Privacy & data', 'Keybindings', 'Archived chats'];
const builderCategories = ['Compute & memory', 'Server & concurrency', 'Storage'];
const families: { value: ThemeFamily; label: string }[] = [
  { value: 't3-chat', label: 'T3 Chat' }, { value: 'grove', label: 'Grove' },
  { value: 'ocean', label: 'Ocean' }, { value: 'ember', label: 'Ember' }, { value: 'iris', label: 'Iris' },
];
const numericFields = [
  { key: 'gpuLayers', label: 'GPU offload layers', min: 0, max: 999, description: '99 requests offloading all layers to the GPU.' },
  { key: 'threads', label: 'CPU threads', min: 1, max: 64, description: 'CPU threads allocated to inference.' },
  { key: 'contextLimit', label: 'Default context limit', min: 512, max: 131072, description: 'Maximum tokens in the context window.' },
  { key: 'port', label: 'Server port', min: 1024, max: 65535, description: 'Default: 8080. Inference API: /v1.' },
  { key: 'maxConcurrentRequests', label: 'Max concurrent requests', min: 1, max: 32, description: 'Limit simultaneous requests to control memory usage.' },
] as const;

export function SettingsView() {
  const app = useAppStore();
  const prefs = useWorkspacePreferences();
  const [category, setCategory] = useState('General');
  const [query, setQuery] = useState('');
  const [capture, setCapture] = useState<string | null>(null);
  const [shortcutError, setShortcutError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const defaults = { port: 8080, maxConcurrentRequests: 4, contextLimit: 4096, gpuLayers: 99, threads: 6, lowMemoryMode: false, flashAttention: true, modelsDirectory: '', runtimeDirectory: '' };
  const [config, setConfig] = useState({ ...defaults, ...app.serverConfig });
  useEffect(() => {
    if (!dirty && app.serverConfig) setConfig(current => ({ ...current, ...app.serverConfig }));
  }, [app.serverConfig, dirty]);
  useEffect(() => { if (!prefs.builderMode && builderCategories.includes(category)) setCategory('General'); }, [prefs.builderMode, category]);
  const changeConfig = (patch: Partial<typeof config>) => { setDirty(true); setMessage(''); setConfig(current => ({ ...current, ...patch })); };
  const save = async () => {
    setError(''); setMessage('');
    for (const field of numericFields) {
      const value = config[field.key];
      if (!Number.isInteger(value) || value < field.min || value > field.max) { setError(`${field.label} must be a whole number between ${field.min} and ${field.max}.`); return; }
    }
    setSaving(true);
    try {
      await app.updateServerConfig({ port: config.port, maxConcurrentRequests: config.maxConcurrentRequests, contextLimit: config.contextLimit, gpuLayers: config.gpuLayers, threads: config.threads, lowMemoryMode: config.lowMemoryMode, flashAttention: config.flashAttention, modelsDirectory: config.modelsDirectory, runtimeDirectory: config.runtimeDirectory });
      setDirty(false); setMessage('Server and runtime settings saved.');
    } catch (failure) { setError(`Settings could not be saved: ${failure instanceof Error ? failure.message : String(failure)}`); }
    finally { setSaving(false); }
  };
  const browse = async (key: 'modelsDirectory' | 'runtimeDirectory') => {
    try { const directory = await api.invoke('app:select-directory', { defaultPath: config[key] }); if (directory) changeConfig({ [key]: directory }); }
    catch (failure) { setError(`Directory picker failed: ${failure instanceof Error ? failure.message : String(failure)}. You can enter the path manually.`); }
  };
  const toggle = (label: string, checked: boolean, onChange: (value: boolean) => void) => <SettingsToggle label={label} checked={checked} onChange={onChange} />;
  const range = (label: string, value: number, min: number, max: number, step: number, onChange: (value: number) => void, suffix = '') => <label className="flex items-center gap-3 text-sm"><span className="sr-only">{label}</span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} className="w-32 accent-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 dark:accent-violet-400" /><output className="w-12 text-right tabular-nums">{Math.round(value * (max === 1 ? 100 : 1))}{suffix}</output></label>;
  type Option = { category: string; title: string; description?: string; control?: ReactNode };
  const options: Option[] = [
    { category: 'General', title: 'On startup', description: 'Start a fresh conversation or continue where you left off.', control: <SettingsSelect label="On startup" value={prefs.startupBehavior} options={[{ value: 'new-chat', label: 'New chat' }, { value: 'continue', label: 'Continue where I left off' }]} onChange={value => prefs.setStartupBehavior(value as 'new-chat' | 'continue')} /> },
    { category: 'General', title: 'Builder mode', description: 'Show the original technical tools above New chat and advanced settings below.', control: toggle('Builder mode', prefs.builderMode, prefs.setBuilderMode) },
    { category: 'Appearance', title: 'Appearance', description: `Currently using ${app.theme} appearance. System follows your device.`, control: <SettingsSelect label="Appearance" value={app.themePreference} options={['light', 'dark', 'system'].map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))} onChange={value => app.setThemePreference(value as 'light' | 'dark' | 'system')} /> },
    { category: 'Appearance', title: 'Theme family', description: 'Five original palettes. Locally authored artwork previews; no external assets or network requests.', control: <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{families.map(family => <button key={family.value} type="button" aria-pressed={prefs.themeFamily === family.value} onClick={() => prefs.setThemeFamily(family.value)} className={`rounded-xl border p-2 text-left text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 ${prefs.themeFamily === family.value ? 'border-violet-600 bg-violet-50 dark:border-violet-400 dark:bg-violet-950' : 'border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800'}`}><ThemeArtwork family={family.value} /><span className="mt-2 block font-medium">{family.label}{prefs.themeFamily === family.value ? ' · Selected' : ''}</span></button>)}</div> },
    { category: 'Appearance', title: 'Text size', description: 'Preferred interface and conversation text size.', control: range('Text size', prefs.textSize, 12, 24, 1, prefs.setTextSize, 'px') },
    { category: 'Appearance', title: 'Animations', description: 'Allow ambient new-chat animation. Your system reduced-motion preference takes priority.', control: toggle('Animations', prefs.animationsEnabled, prefs.setAnimationsEnabled) },
    { category: 'Appearance', title: 'Animation intensity', control: range('Animation intensity', prefs.animationIntensity, 0, 1, 0.05, prefs.setAnimationIntensity, '%') },
    { category: 'Appearance', title: 'Translucent surfaces', description: 'Blend supported in-app surfaces. Native desktop transparency and blur are not enabled by this setting; opaque fallback may apply.', control: toggle('Translucent surfaces', prefs.translucent, prefs.setTranslucent) },
    { category: 'Appearance', title: 'Surface opacity', description: 'Higher opacity keeps text easier to read. Applies when translucent surfaces are supported and enabled.', control: range('Surface opacity', prefs.opacity, 0.65, 1, 0.01, prefs.setOpacity, '%') },
    { category: 'Chat', title: 'Writing messages', description: 'Enter sends a message. Shift+Enter inserts a new line. These text-editing keys are fixed.' },
    { category: 'Voice', title: 'Review before sending', description: 'Preference for the voice flow when connected. This setting does not install a speech model or grant microphone permission.', control: toggle('Review before sending', prefs.reviewVoiceBeforeSending, prefs.setReviewVoiceBeforeSending) },
    { category: 'Voice', title: 'Local speech setup', description: 'Speech-model setup, microphone permission and transcription require voice integration. No voice backend is configured from this panel.' },
    { category: 'Models', title: 'Manage local models', description: 'Browse, download or import models using the existing model manager.', control: <button type="button" className={controlClass} onClick={() => app.setActiveTab('models')}>Open Models</button> },
    { category: 'Privacy & data', title: 'Device-local preferences', description: 'Presentation preferences and keyboard shortcuts are saved in this device’s local storage. This panel does not export, import or delete conversations.' },
    { category: 'Archived chats', title: 'Archive is not connected', description: 'The current conversation store exposes no archive records or restore action. Archived-chat search and restore need that data contract before they can be offered here.' },
    ...numericFields.map(field => ({ category: ['port', 'maxConcurrentRequests'].includes(field.key) ? 'Server & concurrency' : 'Compute & memory', title: field.label, description: field.description, control: <input aria-label={field.label} className={`${controlClass} w-28`} type="number" min={field.min} max={field.max} step={1} value={Number.isNaN(config[field.key]) ? '' : config[field.key]} onChange={event => changeConfig({ [field.key]: event.target.value === '' ? NaN : Number(event.target.value) })} /> })),
    { category: 'Compute & memory', title: 'Low-memory layer streaming mode', description: 'Enable quantized KV caching (-ctk q8_0 -ctv q8_0) and Flash Attention. Actual RAM savings and speed depend on the model and hardware.', control: toggle('Low-memory layer streaming mode', config.lowMemoryMode, value => changeConfig({ lowMemoryMode: value })) },
    { category: 'Compute & memory', title: 'Flash Attention kernel', description: 'Use the runtime’s optimized attention kernel where supported.', control: toggle('Flash Attention kernel', config.flashAttention, value => changeConfig({ flashAttention: value })) },
    ...(['modelsDirectory', 'runtimeDirectory'] as const).map(key => ({ category: 'Storage', title: key === 'modelsDirectory' ? 'Models storage directory' : 'Runtime binaries directory', control: <div className="flex w-full flex-wrap gap-2"><input aria-label={key === 'modelsDirectory' ? 'Models storage directory' : 'Runtime binaries directory'} value={config[key]} onChange={event => changeConfig({ [key]: event.target.value })} className={`${controlClass} min-w-0 flex-1`} /><button type="button" onClick={() => void browse(key)} className={controlClass}>Browse</button></div> })),
    ...Object.entries(shortcutLabels).map(([action, title]) => ({ category: 'Keybindings', title, description: capture === action ? 'Press a shortcut with Ctrl/Command or Alt. Escape cancels; Tab leaves capture.' : undefined, control: <button type="button" data-shortcut-capture aria-label={`Change shortcut for ${title}`} aria-pressed={capture === action} className={`${controlClass} min-w-32 font-mono`} onClick={() => { setCapture(action); setShortcutError(''); }} onBlur={() => setCapture(null)} onKeyDown={event => {
      if (capture !== action) return;
      event.stopPropagation();
      if (event.key === 'Tab') { setCapture(null); return; }
      event.preventDefault();
      if (event.key === 'Escape') { setCapture(null); setShortcutError(''); return; }
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
      const shortcut = shortcutFromEvent(event.nativeEvent);
      if (!shortcut) return;
      if (!event.ctrlKey && !event.metaKey && !event.altKey) { setShortcutError('Include Ctrl/Command or Alt to preserve text editing.'); return; }
      const conflict = shortcutConflict(prefs.keybindings, action, shortcut);
      if (conflict) { setShortcutError(`Already assigned to ${shortcutLabels[conflict] || conflict}. Choose another shortcut.`); return; }
      prefs.setKeybinding(action, shortcut); setCapture(null); setShortcutError('');
    }}>{capture === action ? 'Press keys…' : (prefs.keybindings[action] || 'Unassigned').replace('Mod', /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd' : 'Ctrl')}</button> })),
  ];
  const enabledCategories = [...categories, ...(prefs.builderMode ? builderCategories : [])];
  const search = query.trim().toLowerCase();
  const visible = options.filter(option => enabledCategories.includes(option.category) && (search ? `${option.category} ${option.title} ${option.description || ''}`.toLowerCase().includes(search) : option.category === category));

  return <div className="h-full overflow-auto bg-zinc-50 text-zinc-900 selection:bg-violet-200 dark:bg-zinc-950 dark:text-zinc-100 dark:selection:bg-violet-800">
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-10">
      <header className="mb-8"><h1 className="flex items-center gap-3 text-2xl font-semibold"><Atom size={24} aria-hidden="true" />Settings</h1><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Make Zaylo feel like your workspace.</p></header>
      <div className="grid gap-8 md:grid-cols-[190px_minmax(0,1fr)]">
        <aside><label className="relative block"><Search size={16} aria-hidden="true" className="absolute left-3 top-3 text-zinc-500" /><span className="sr-only">Search settings</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search settings" className={`${controlClass} w-full pl-9`} /></label><nav aria-label="Settings categories" className="mt-5 flex flex-wrap gap-1 md:flex-col">{enabledCategories.map(item => <button type="button" key={item} aria-current={!search && item === category ? 'page' : undefined} onClick={() => { setCategory(item); setQuery(''); setCapture(null); }} className={`rounded-lg px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 ${!search && category === item ? 'bg-violet-100 font-medium text-violet-900 dark:bg-violet-950 dark:text-violet-200' : 'text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}>{builderCategories.includes(item) ? `Builder · ${item}` : item}</button>)}</nav></aside>
        <main className="min-w-0" aria-label="Settings options"><h2 className="text-lg font-semibold">{search ? 'Search results' : category}</h2><p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Preferences save automatically. Builder server and runtime changes use Save changes.</p>
          {visible.length === 0 && <p className="py-10 text-sm text-zinc-600 dark:text-zinc-400">No settings match “{query}”. Try a different name or enable Builder mode for advanced controls.</p>}
          {visible.map(option => <div key={`${option.category}-${option.title}`}>{search && <p className="mt-5 text-xs text-zinc-600 dark:text-zinc-400">{option.category}</p>}<SettingsRow title={option.title} description={option.description}>{option.control}</SettingsRow></div>)}
          {(category === 'Keybindings' || search) && <div className="mt-5"><p className="mb-3 text-xs text-zinc-600 dark:text-zinc-400">Shortcuts use Command on macOS and Control elsewhere. Some combinations may be reserved by your operating system.</p><button type="button" className={controlClass} onClick={() => { prefs.resetKeybindings(); setCapture(null); setShortcutError(''); }}>Reset keybindings</button></div>}
          {shortcutError && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{shortcutError}</p>}
          {prefs.builderMode && (builderCategories.includes(category) || dirty || search) && <div className="mt-6 flex flex-wrap items-center gap-3"><button type="button" disabled={saving || !dirty} className={`${controlClass} font-medium`} onClick={() => void save()}>{saving ? 'Saving…' : 'Save changes'}</button>{dirty && <span className="text-xs text-zinc-600 dark:text-zinc-400">Unsaved server/runtime changes</span>}</div>}
          {error && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p>}<p role="status" className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
        </main>
      </div>
    </div>
  </div>;
}
