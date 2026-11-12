import React, { useRef, useState, useEffect } from 'react';
import {
  Square,
  Plus,
  Paperclip,
  Layers,
  X,
  AlertCircle,
  Play,
  RotateCw,
  SendHorizonal,
  FileText,
  BarChart2,
  Presentation,
  TrendingUp,
  Palette,
  Brain,
} from 'lucide-react';
import { chatDrafts } from '../hooks/chatSession';
import { VoiceInput } from '../../voice/VoiceInput';
import type { ServerState } from '@local-ai/shared';

interface MessageComposerProps {
  conversationId?: string;
  /** Parent supplies local transcription UI; never invoke browser speech services here. */
  voiceControl?: React.ReactNode;
  /** Local recorder replaces the entire composer while preserving the text draft. */
  recordingContent?: React.ReactNode;
  onSendMessage: (text: string) => void;
  onStopGeneration: () => void;
  isGenerating: boolean;
  serverState: ServerState;
  isVisionSupported: boolean;
  pendingImage?: { dataUrl: string; name: string };
  onSetPendingImage: (img?: { dataUrl: string; name: string }) => void;
  ragEnabled: boolean;
  ragDocsCount: number;
  onOpenRagModal: () => void;
  onStartServer: () => void;
  isStartingServer: boolean;
  onToggleRag?: () => void;
  memoryEnabled?: boolean;
  memoryCount?: number;
  loftyDbConnected?: boolean;
  onToggleMemory?: () => void;
  onOpenMemorySection?: () => void;
  externalInput?: string;
  onClearExternalInput?: () => void;
  onOpenChartModal?: () => void;
  onOpenPresentationModal?: () => void;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  conversationId = 'new',
  voiceControl,
  recordingContent,
  onSendMessage,
  onStopGeneration,
  isGenerating,
  serverState,
  isVisionSupported,
  pendingImage,
  onSetPendingImage,
  ragEnabled,
  ragDocsCount,
  onOpenRagModal,
  onStartServer,
  isStartingServer,
  onToggleRag,
  memoryEnabled = true,
  memoryCount = 0,
  loftyDbConnected = false,
  onToggleMemory,
  onOpenMemorySection,
  externalInput,
  onClearExternalInput,
  onOpenChartModal,
  onOpenPresentationModal,
}) => {
  const [voiceContainer, setVoiceContainer] = useState<HTMLDivElement | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [input, setInput] = useState(() => chatDrafts.get(conversationId)?.text || '');
  useEffect(() => { chatDrafts.set(conversationId, { text: input, image: pendingImage }); }, [conversationId, input, pendingImage]);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isToolsOpen) return;
    const dismiss = (e: PointerEvent) => { if (!toolsRef.current?.contains(e.target as Node)) setIsToolsOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsToolsOpen(false); };
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [isToolsOpen]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isServerRunning = serverState === 'RUNNING';

  // Handle external prompt suggestions (e.g. from empty state buttons)
  useEffect(() => {
    if (externalInput) {
      setInput(externalInput);
      onClearExternalInput?.();
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(180, textareaRef.current.scrollHeight)}px`;
        }
      }, 50);
    }
  }, [externalInput, onClearExternalInput]);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(180, textareaRef.current.scrollHeight)}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isGenerating) return;
    if ((!input.trim() && !pendingImage) || !isServerRunning) return;
    const msg = input;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSetPendingImage({ dataUrl: reader.result, name: file.name });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              onSetPendingImage({
                dataUrl: reader.result,
                name: file.name || 'clipboard-image.png',
              });
            }
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 pb-6 pt-2 select-none shrink-0 z-10 flex flex-col items-center">
      <div className="w-full max-w-[950px] space-y-2">
        {/* Server Stopped Warning Banner */}
        {!isServerRunning && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-600 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Inference server is currently stopped. Start server to chat with this model.</span>
            </div>
            <button
              onClick={onStartServer}
              disabled={isStartingServer}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-700 dark:text-amber-200 text-xs font-medium transition-colors"
            >
              {isStartingServer ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Start Server</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Pending Image Attachment Pill */}
        {pendingImage && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 p-1.5 pl-2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xs">
              <img
                src={pendingImage.dataUrl}
                alt="Upload preview"
                className="w-7 h-7 rounded-lg object-cover border border-[var(--border)]"
              />
              <span className="text-xs text-[var(--foreground)] truncate max-w-[200px]">
                {pendingImage.name}
              </span>
              <button
                type="button"
                onClick={() => onSetPendingImage(undefined)}
                className="p-1 text-zinc-400 hover:text-[var(--foreground)] transition-colors"
                title="Remove attachment"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {!isVisionSupported && (
              <span className="text-xs text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 px-2.5 py-1 rounded-lg">
                Active model is text-only. Multimodal images require a vision model.
              </span>
            )}
          </div>
        )}

        {/* Floating Composer Container */}
        <div ref={setVoiceContainer} className="zaylo-composer-glow relative rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] transition-colors px-4 pt-3.5 pb-2.5">
          {recordingContent || <div inert={voiceActive || undefined} style={voiceActive ? { visibility: 'hidden' } : undefined}>
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            aria-label="Message"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              !isServerRunning
                ? 'Server stopped. Start server to chat...'
                : 'Ask anything...'
            }
            disabled={!isServerRunning}
            className="w-full bg-transparent pr-12 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none resize-none font-sans leading-relaxed select-text min-h-[38px] max-h-[180px]"
          />

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          {/* Bottom Controls Row inside Composer */}
          <div className="flex items-center justify-between pt-2 border-t border-transparent select-none">
            {/* Left Tools: Plus, Paperclip, RAG toggle */}
            <div className="flex items-center gap-2.5 text-[var(--muted-foreground)]">
              {/* Plus Action */}
              <div ref={toolsRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsToolsOpen(!isToolsOpen)}
                  className="p-1 rounded-md hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
                  title="Tools & Prompts"
                  aria-label="Tools and prompts" aria-expanded={isToolsOpen}
                >
                  <Plus className="w-4 h-4" />
                </button>

                {isToolsOpen && (
                  <div className="absolute bottom-full mb-2 left-0 w-56 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl py-1.5 z-50 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChartModal?.();
                        setIsToolsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      <BarChart2 className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Generate AI Chart</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenPresentationModal?.();
                        setIsToolsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      <Presentation className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Create Presentation (.pptx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInput('Analyze this dataset and generate a comparative visualization: ');
                        setIsToolsOpen(false);
                        textareaRef.current?.focus();
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Analyze Dataset</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        fileInputRef.current?.click();
                        setInput('Extract the design theme, color palette, and layout from this reference image: ');
                        setIsToolsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      <Palette className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Use Reference Design</span>
                    </button>
                    <div className="my-1 border-t border-[var(--border)]" />
                    <button
                      type="button"
                      onClick={() => {
                        fileInputRef.current?.click();
                        setIsToolsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>Attach image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenRagModal();
                        setIsToolsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Manage RAG Library</span>
                    </button>
                  </div>
                )}
              </div>

              {/* File Attachment */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1 rounded-md hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
                title="Attach image"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* RAG Label & Toggle Switch */}
              <div className="flex items-center gap-1.5 pl-1">
                <button
                  type="button"
                  onClick={onOpenRagModal}
                  className="flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                  title="RAG Context Knowledge"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>RAG</span>
                  {ragDocsCount > 0 && (
                    <span className="text-[10px] font-mono text-[var(--muted-foreground)]">({ragDocsCount})</span>
                  )}
                </button>

                {/* Minimal iOS-style Toggle Switch */}
                <button
                  type="button"
                  onClick={() => onToggleRag?.()}
                  className={`w-8 h-4.5 rounded-full p-0.5 transition-colors focus:outline-none ${
                    ragEnabled ? 'bg-[var(--foreground)]' : 'bg-[var(--border)]'
                  }`}
                  role="switch" aria-checked={ragEnabled} aria-label="Document context"
                  title={ragEnabled ? 'Disable RAG' : 'Enable RAG'}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full transition-transform ${
                      ragEnabled ? 'translate-x-3.5 bg-[var(--background)]' : 'translate-x-0 bg-[var(--muted-foreground)]'
                    }`}
                  />
                </button>
              </div>

              {/* LoftyDB Memory Label & Toggle Switch */}
              <div className="flex items-center gap-1.5 pl-1">
                <button
                  type="button"
                  onClick={() => onOpenMemorySection?.()}
                  className="flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                  title={
                    loftyDbConnected
                      ? 'Open LoftyDB Memory Studio'
                      : 'LoftyDB offline — click to configure or start'
                  }
                >
                  <Brain className={`w-3.5 h-3.5 ${loftyDbConnected && memoryEnabled ? 'text-emerald-500' : ''}`} />
                  <span>Memory</span>
                  {memoryCount > 0 && (
                    <span className="text-[10px] font-mono text-[var(--muted-foreground)]">({memoryCount})</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onToggleMemory?.()}
                  disabled={!onToggleMemory}
                  role="switch" aria-checked={memoryEnabled && loftyDbConnected} aria-label="Memory recall"
                  className={`w-8 h-4.5 rounded-full p-0.5 transition-colors focus:outline-none ${
                    memoryEnabled && loftyDbConnected ? 'bg-[var(--foreground)]' : 'bg-[var(--border)]'
                  }`}
                  title={
                    !loftyDbConnected
                      ? 'LoftyDB is offline'
                      : memoryEnabled
                      ? 'Disable LoftyDB Memory Recall'
                      : 'Enable LoftyDB Memory Recall'
                  }
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full transition-transform ${
                      memoryEnabled && loftyDbConnected
                        ? 'translate-x-3.5 bg-[var(--background)]'
                        : 'translate-x-0 bg-[var(--muted-foreground)]'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Right Control: Black/White Send / Stop Button */}
            <div className="flex items-center gap-2">
              {voiceControl || <VoiceInput container={voiceContainer} disabled={isGenerating}
                onActiveChange={setVoiceActive}
                onTranscript={(text, review) => {
                  if (review || !isServerRunning) { setInput(text); textareaRef.current?.focus(); }
                  else { setInput(''); onSendMessage(text); }
                }} />}
              {isGenerating ? (
                <button
                  type="button"
                  onClick={onStopGeneration}
                  className="h-8 px-3 gap-2 rounded-xl bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center" aria-label="Stop generation"
                  title="Stop generating"
                >
                  <Square className="w-3.5 h-3.5 fill-current" /><span className="text-xs">Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={(!input.trim() && !pendingImage) || !isServerRunning}
                  className="w-8 h-8 rounded-xl bg-[var(--foreground)] text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-black dark:disabled:hover:bg-white flex items-center justify-center transition-transform active:scale-95 shadow-sm"
                  title="Send prompt (Enter)"
                >
                  <SendHorizonal className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          </div>}
        </div>
      </div>
    </div>
  );
};
