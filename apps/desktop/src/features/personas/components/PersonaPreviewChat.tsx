import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Send, Square, AlertCircle, MessageSquare, Cpu, Sliders } from 'lucide-react';
import { useAppStore } from '../../../stores/useAppStore';
import { useWorkspacePreferences } from '../../../stores/useWorkspacePreferences';
import { api } from '../../../api/client';
import { PersonaPromptAdapter } from '@local-ai/inference';
import type { Persona } from '@local-ai/shared';
import { getExamplePrompts } from '../utils/personaExamples';

interface PersonaPreviewChatProps {
  persona: Persona;
  isOpen: boolean;
  onClose: () => void;
  /** Navigates the user to model setup when no local model is loaded. */
  onOpenModels: () => void;
}

interface PreviewMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Temporary preview chat for a persona. Conversations live only in this
 * component's state: they are never written to saved history, memory, or the
 * model context beyond the preview itself (memory is disabled and no
 * conversationId is sent). Replies come only from the actually loaded local
 * model — nothing here fabricates assistant text.
 */
export const PersonaPreviewChat: React.FC<PersonaPreviewChatProps> = ({
  persona,
  isOpen,
  onClose,
  onOpenModels,
}) => {
  const serverState = useAppStore((s) => s.serverState);
  const serverInstance = useAppStore((s) => s.serverInstance);
  const installedModels = useAppStore((s) => s.installedModels);
  const builderMode = useWorkspacePreferences((s) => s.builderMode);

  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Builder-only generation controls (preview-session scoped, not persisted).
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [maxTokens, setMaxTokens] = useState(512);
  const [modelNameOverride, setModelNameOverride] = useState('');

  const requestIdRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // The genuinely loaded local model; preview requires one to be running.
  const loadedModelName =
    serverState === 'RUNNING' && serverInstance?.modelName ? serverInstance.modelName : '';
  const effectiveModelName =
    builderMode && modelNameOverride.trim() ? modelNameOverride.trim() : loadedModelName;
  const modelReady = Boolean(loadedModelName);
  const hasInstalledModel = installedModels.length > 0;

  const composedSystemPrompt = useMemo(
    () =>
      PersonaPromptAdapter.composeSystemPrompt(
        'You are a private local AI assistant running on this device.',
        persona
      ),
    [persona]
  );

  // Reset the ephemeral conversation whenever the dialog closes or persona changes.
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setInput('');
      setError(null);
      setIsGenerating(false);
      setModelNameOverride('');
    }
  }, [isOpen, persona.id]);

  // Stop any in-flight generation on close so nothing keeps streaming.
  useEffect(() => {
    if (isOpen) return;
    if (requestIdRef.current) {
      void api.invoke('inference:abort', { requestId: requestIdRef.current }).catch(() => {});
      requestIdRef.current = null;
    }
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, [isOpen]);

  // Keep the transcript scrolled to the newest message.
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Escape closes; Escape alone never aborts generation.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const examplePrompts = getExamplePrompts(persona);

  const handleStop = () => {
    if (requestIdRef.current) {
      void api.invoke('inference:abort', { requestId: requestIdRef.current }).catch(() => {});
    }
    setIsGenerating(false);
  };

  const handleSend = async (text: string) => {
    const userText = text.trim();
    if (!userText || isGenerating) return;

    setError(null);

    if (!effectiveModelName) {
      // Surface the setup requirement honestly instead of faking a reply.
      setError(
        hasInstalledModel
          ? 'No local model is currently loaded. Load a model in Models to preview this persona with real responses.'
          : 'No local model is installed yet. Download a model in Models to preview this persona.'
      );
      return;
    }

    const nextMessages: PreviewMessage[] = [
      ...messages,
      { role: 'user', content: userText },
    ];
    setMessages(nextMessages);
    setInput('');
    setIsGenerating(true);

    const reqId = `preview-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    requestIdRef.current = reqId;

    let streamed = '';
    const unsub = api.on('inference:chunk', (data: { requestId: string; chunk: any }) => {
      if (data.requestId !== reqId) return;
      const delta = data.chunk?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta) {
        streamed += delta;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: streamed };
          return copy;
        });
      }
    });
    unsubscribeRef.current = unsub;

    try {
      const response = await api.invoke('inference:chat', {
        model: effectiveModelName,
        messages: [
          { role: 'system', content: composedSystemPrompt },
          ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
        ],
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        stream: true,
        // Preview chats are deliberately excluded from history and memory.
        memory: false,
      });

      const finalContent =
        typeof response?.choices?.[0]?.message?.content === 'string' &&
        response.choices[0].message.content
          ? response.choices[0].message.content
          : streamed;

      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: finalContent || streamed };
        return copy;
      });
    } catch (err: any) {
      const raw = err?.message || 'Inference request failed';
      // Remove the empty assistant bubble and show the real failure.
      setMessages((prev) => prev.slice(0, -1));
      setError(raw);
    } finally {
      setIsGenerating(false);
      requestIdRef.current = null;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="persona-preview-title"
        className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl border flex flex-col h-[75vh]"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border, rgba(128,128,128,0.2))', color: 'var(--foreground)' }}
      >
        {/* Header */}
        <div
          className="px-5 py-3 border-b flex items-center justify-between gap-3"
          style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))', backgroundColor: 'var(--background)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg" aria-hidden="true">{persona.avatar || '✨'}</span>
            <div className="min-w-0">
              <h2 id="persona-preview-title" className="text-sm font-bold truncate">
                Preview: {persona.name}
              </h2>
              <p className="text-[11px] truncate" style={{ color: 'var(--muted-foreground)' }}>
                {modelReady ? (
                  <>Loaded model: <span className="font-mono">{loadedModelName}</span></>
                ) : (
                  'Local model not loaded'
                )}
                {' · '}Preview only, never saved to history or memory
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isGenerating && (
              <button
                onClick={handleStop}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-300 text-xs font-medium hover:bg-rose-500/20 transition-colors"
                title="Stop generating"
              >
                <Square className="w-3 h-3" aria-hidden="true" />
                <span>Stop</span>
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close persona preview"
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Builder-only runtime controls */}
        {builderMode && (
          <div
            className="px-5 py-2.5 border-b flex flex-wrap items-center gap-3 text-[11px]"
            style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))', backgroundColor: 'var(--background)' }}
          >
            <span className="flex items-center gap-1 font-mono uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
              <Sliders className="w-3 h-3" aria-hidden="true" /> Runtime
            </span>
            <label className="flex items-center gap-1">
              <span style={{ color: 'var(--muted-foreground)' }}>Model</span>
              <input
                value={modelNameOverride}
                onChange={(e) => setModelNameOverride(e.target.value)}
                placeholder={loadedModelName || 'model name'}
                className="w-40 px-2 py-0.5 rounded-md border bg-transparent text-xs font-mono focus:outline-none focus:ring-1"
                style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))' }}
              />
            </label>
            <label className="flex items-center gap-1">
              <span style={{ color: 'var(--muted-foreground)' }}>Temp {temperature.toFixed(2)}</span>
              <input
                type="range" min={0} max={1.5} step={0.05} value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-20"
                aria-label="Preview temperature"
              />
            </label>
            <label className="flex items-center gap-1">
              <span style={{ color: 'var(--muted-foreground)' }}>Top-p {topP.toFixed(2)}</span>
              <input
                type="range" min={0.05} max={1} step={0.05} value={topP}
                onChange={(e) => setTopP(parseFloat(e.target.value))}
                className="w-20"
                aria-label="Preview top-p"
              />
            </label>
            <label className="flex items-center gap-1">
              <span style={{ color: 'var(--muted-foreground)' }}>Max tokens</span>
              <input
                type="number" min={16} max={4096} value={maxTokens}
                onChange={(e) => setMaxTokens(Math.max(16, Math.min(4096, parseInt(e.target.value, 10) || 512)))}
                className="w-16 px-1.5 py-0.5 rounded-md border bg-transparent text-xs font-mono focus:outline-none focus:ring-1"
                style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))' }}
                aria-label="Preview max tokens"
              />
            </label>
          </div>
        )}

        {/* Transcript */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" aria-live="polite">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border, rgba(128,128,128,0.2))' }}
                aria-hidden="true"
              >
                {persona.avatar || '✨'}
              </div>
              <p className="text-xs max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
                {modelReady
                  ? persona.greetingMessage || `Try a quick example to preview how "${persona.name}" behaves.`
                  : 'Preview needs a loaded local model — replies always come from your own hardware.'}
              </p>
              {modelReady ? (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {examplePrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => void handleSend(prompt)}
                      disabled={isGenerating}
                      className="px-2.5 py-1 rounded-full border text-[11px] transition-all hover:opacity-80 disabled:opacity-40 hover:-translate-y-0.5"
                      style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))', color: 'var(--foreground)' }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={onOpenModels}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'var(--theme-accent)', color: 'var(--theme-accent-ink, #111)' }}
                >
                  <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{hasInstalledModel ? 'Load a model' : 'Set up a model'}</span>
                </button>
              )}
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user' ? 'text-white' : ''
                }`}
                style={
                  msg.role === 'user'
                    ? { backgroundColor: 'var(--theme-accent)', color: 'var(--theme-accent-ink, #fff)' }
                    : { backgroundColor: 'var(--background)', border: '1px solid var(--border, rgba(128,128,128,0.2))' }
                }
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isGenerating && (
            <div className="flex justify-start" aria-hidden="true">
              <div className="px-3.5 py-2 rounded-2xl text-xs" style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border, rgba(128,128,128,0.2))', color: 'var(--muted-foreground)' }}>
                Generating…
              </div>
            </div>
          )}
        </div>

        {/* Error strip */}
        {error && (
          <div
            role="alert"
            className="mx-4 mb-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-300 text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="min-w-0">{error}</span>
            <button
              onClick={onOpenModels}
              className="shrink-0 underline underline-offset-2 font-medium hover:opacity-80"
            >
              Open Models
            </button>
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend(input);
          }}
          className="p-3"
        >
          <div className="zaylo-composer-glow flex items-end gap-2 p-1.5 rounded-2xl border" style={{ borderColor: 'var(--border, rgba(128,128,128,0.2))' }}>
            <label htmlFor="persona-preview-input" className="sr-only">
              Message for persona preview
            </label>
            <textarea
              id="persona-preview-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend(input);
                }
              }}
              rows={1}
              placeholder={
                modelReady ? `Message "${persona.name}"…` : 'Load a local model to preview this persona…'
              }
              className="flex-1 bg-transparent px-3 py-2 text-xs resize-none focus:outline-none"
              style={{ color: 'var(--foreground)' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isGenerating}
              aria-label="Send preview message"
              className="p-2 rounded-xl text-white transition-opacity disabled:opacity-40 hover:opacity-90 shrink-0"
              style={{ backgroundColor: 'var(--theme-accent)', color: 'var(--theme-accent-ink, #fff)' }}
            >
              {isGenerating ? <Square className="w-4 h-4" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>
          <p className="mt-1.5 px-2 text-[10px] flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
            <MessageSquare className="w-3 h-3" aria-hidden="true" />
            Offline preview on your local model — this conversation is never saved or used as memory.
          </p>
        </form>
      </div>
    </div>
  );
};
