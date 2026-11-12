import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, Download, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Persona } from '@local-ai/shared';
import {
  MAX_IMPORT_JSON_BYTES,
  parsePersonaImport,
  serializePersonaCollectionForExport,
  serializePersonaForExport,
} from '../utils/personaIO';

interface PersonaImportExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** All personas in the store, used for export selection and id collision checks. */
  personas: Persona[];
  /** Receives validated imported personas to persist via the store. */
  onImport: (personas: Persona[]) => void;
}

const MAX_CUSTOM_EXPORT = 50;

export const PersonaImportExportDialog: React.FC<PersonaImportExportDialogProps> = ({
  isOpen,
  onClose,
  personas,
  onImport,
}) => {
  const [mode, setMode] = useState<'import' | 'export'>('import');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const customPersonas = personas.filter((p) => !p.isBuiltIn);

  useEffect(() => {
    if (isOpen) {
      setMode('import');
      setError(null);
      setSuccess(null);
      setPastedJson('');
      // Move focus into the dialog for keyboard and screen-reader users.
      requestAnimationFrame(() => closeBtnRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleImportText = (jsonText: string, sourceLabel: string) => {
    setError(null);
    setSuccess(null);
    if (!jsonText.trim()) {
      setError('Nothing to import yet. Choose a JSON file or paste an export.');
      return;
    }
    if (new TextEncoder().encode(jsonText).length > MAX_IMPORT_JSON_BYTES) {
      setError(`Import file is too large (limit ${Math.round(MAX_IMPORT_JSON_BYTES / 1024)} KB).`);
      return;
    }
    const existingIds = new Set(personas.map((p) => p.id));
    const result = parsePersonaImport(jsonText, existingIds);
    if (!result.ok) {
      setError(result.errors.map((e) => e.message).join(' '));
      return;
    }
    setBusy(true);
    try {
      onImport(result.personas);
      setSuccess(
        `Imported ${result.personas.length} ${result.personas.length === 1 ? 'persona' : 'personas'} from ${sourceLabel}.`
      );
      setPastedJson('');
    } catch (err: any) {
      setError(`Import failed: ${err?.message || 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleFileChosen = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_JSON_BYTES) {
      setError(`"${file.name}" is too large (limit ${Math.round(MAX_IMPORT_JSON_BYTES / 1024)} KB).`);
      return;
    }
    try {
      const text = await file.text();
      handleImportText(text, `"${file.name}"`);
    } catch {
      setError(`Could not read "${file.name}".`);
    }
  };

  const downloadJson = (filename: string, json: string) => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const slug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'persona';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="persona-io-title"
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border flex flex-col max-h-[85vh]"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border, rgba(128,128,128,0.2))', color: 'var(--foreground)' }}
      >
        {/* Header */}
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))', backgroundColor: 'var(--background)' }}
        >
          <h2 id="persona-io-title" className="text-sm font-bold flex items-center gap-2">
            <FileJson className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />
            <span>Offline Import / Export</span>
          </h2>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close import and export dialog"
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode tabs */}
        <div
          className="px-5 pt-3 border-b flex gap-2"
          style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))', backgroundColor: 'var(--background)' }}
        >
          {(['import', 'export'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
                setSuccess(null);
              }}
              aria-pressed={mode === m}
              className={`px-3 py-1.5 rounded-t-md border-b-2 text-xs font-medium transition-colors ${
                mode === m ? 'font-semibold' : ''
              }`}
              style={{
                borderBottomColor: mode === m ? 'var(--theme-accent)' : 'transparent',
                color: mode === m ? 'var(--foreground)' : 'var(--muted-foreground)',
              }}
            >
              {m === 'import' ? 'Import' : 'Export'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ backgroundColor: 'var(--card)' }}>
          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg border text-xs flex items-start gap-2 bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div
              role="status"
              className="p-3 rounded-lg border text-xs flex items-start gap-2 bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-300"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {mode === 'import' ? (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Personas travel as plain JSON — fully offline, no account needed. Imports are validated
                strictly and always arrive as custom personas; protected presets cannot be overwritten.
              </p>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    void handleFileChosen(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
                  style={{ borderColor: 'var(--theme-accent)', color: 'var(--foreground)' }}
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose a .json persona file</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                <span className="flex-1 border-t" style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))' }} />
                or paste JSON
                <span className="flex-1 border-t" style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))' }} />
              </div>

              <textarea
                value={pastedJson}
                onChange={(e) => setPastedJson(e.target.value)}
                rows={6}
                aria-label="Paste persona export JSON"
                placeholder='{ "format": "zaylo-personas", ... }'
                className="w-full px-3 py-2 rounded-lg border text-xs font-mono focus:outline-none focus:border-transparent focus:ring-2"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border, rgba(128,128,128,0.2))',
                  color: 'var(--foreground)',
                }}
              />

              <button
                type="button"
                onClick={() => handleImportText(pastedJson, 'pasted JSON')}
                disabled={busy || !pastedJson.trim()}
                className="w-full px-4 py-2 rounded-lg text-xs font-medium text-white transition-opacity disabled:opacity-40 hover:opacity-90"
                style={{ backgroundColor: 'var(--theme-accent)', color: 'var(--theme-accent-ink, #111)' }}
              >
                {busy ? 'Importing…' : 'Import pasted JSON'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Save personas as JSON files you own. Re-import them on any Zaylo installation.
              </p>

              <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1" aria-label="Custom personas available for export">
                {customPersonas.length === 0 ? (
                  <li className="text-xs py-3 text-center rounded-lg border border-dashed" style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border, rgba(128,128,128,0.2))' }}>
                    No custom personas to export yet.
                  </li>
                ) : (
                  customPersonas.slice(0, MAX_CUSTOM_EXPORT).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs" style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))' }}>
                      <span className="flex items-center gap-2 min-w-0 truncate">
                        <span aria-hidden="true">{p.avatar || '✨'}</span>
                        <span className="truncate">{p.name}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          downloadJson(`zaylo-${slug(p.name)}.json`, serializePersonaForExport(p));
                          setSuccess(`Exported "${p.name}".`);
                        }}
                        className="shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium hover:bg-black/5 dark:hover:bg-white/10"
                        style={{ color: 'var(--theme-accent)' }}
                      >
                        <Download className="w-3 h-3 inline mr-1" aria-hidden="true" />
                        Export
                      </button>
                    </li>
                  ))
                )}
              </ul>

              {customPersonas.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    downloadJson(
                      'zaylo-personas-all.json',
                      serializePersonaCollectionForExport(customPersonas.slice(0, MAX_CUSTOM_EXPORT))
                    );
                    setSuccess(`Exported ${Math.min(customPersonas.length, MAX_CUSTOM_EXPORT)} personas.`);
                  }}
                  className="w-full px-4 py-2 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--theme-accent)', color: 'var(--theme-accent-ink, #111)' }}
                >
                  Export all custom personas ({Math.min(customPersonas.length, MAX_CUSTOM_EXPORT)})
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
