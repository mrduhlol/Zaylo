import { hasUserPrompt } from '../hooks/chatSession';
import React, { useRef, useEffect } from 'react';
import {
  Code,
  Database,
  FileText,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import { useWorkspacePreferences } from '../../../stores/useWorkspacePreferences';
import type { ChatMessage } from '@local-ai/shared';
import { MessageBubble } from './MessageBubble';
import type { UnifiedModelOption, InferenceGenerationStats } from '../types';

interface ConversationAreaProps {
  composer?: React.ReactNode;
  /** Integration point: parent may branch before editing; originals remain intact. */
  onEditPrompt?: (index: number, text: string) => void;
  messages: ChatMessage[];
  isGenerating: boolean;
  selectedModel?: UnifiedModelOption;
  generationStats?: InferenceGenerationStats;
  onSelectSuggestion: (prompt: string) => void;
  onRegenerate: () => void;
  onRetry: () => void;
  onClearConversation: () => void;
  onTriggerImageUpload?: () => void;
  onSaveToMemory?: (text: string) => void;
}

export const ConversationArea: React.FC<ConversationAreaProps> = ({
  composer,
  onEditPrompt,
  messages,
  isGenerating,
  selectedModel,
  generationStats,
  onSelectSuggestion,
  onRegenerate,
  onRetry,
  onClearConversation,
  onTriggerImageUpload,
  onSaveToMemory,
}) => {
  const builderMode = useWorkspacePreferences((state) => state.builderMode);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const welcome = messages.find(message => message.role === 'assistant');
  const greeting = typeof welcome?.content === 'string' && welcome.content.trim() ? welcome.content : 'A little curiosity goes a long way.';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [messages.length, isGenerating]);

  const handleSuggestionClick = (type: string) => {
    switch (type) {
      case 'code':
        onSelectSuggestion(builderMode ? 'Write an asynchronous, in-memory cache in TypeScript with sliding TTL expiration and cleanup.' : 'Help me write a clear, friendly message. Ask me who it is for and what I want to say.');
        break;
      case 'sql':
        onSelectSuggestion(builderMode ? 'Write an optimized PostgreSQL query using window functions to calculate running monthly revenue by customer tier.' : 'Help me make a practical plan for my week. Ask about my priorities and available time.');
        break;
      case 'summarize':
        onSelectSuggestion(builderMode ? 'Summarize the operational and privacy advantages of running local offline LLMs versus cloud AI APIs.' : 'Help me summarize a piece of writing. Ask me to paste the text and tell you how short the summary should be.');
        break;
      case 'image':
        if (onTriggerImageUpload) {
          onTriggerImageUpload();
        } else {
          onSelectSuggestion('Analyze this visual scene in detail: describe objects, relationships, and structured text.');
        }
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-6 flex flex-col scrollbar-thin">
      {/* Empty State Welcome Screen — The Visual Centerpiece */}
      {!hasUserPrompt(messages) ? (
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl mx-auto text-center space-y-7 my-auto select-none">
          {/* Prominent Clean Heading */}
          <div className="space-y-1.5">
            <h1 className="text-3xl sm:text-4xl font-semibold text-[var(--foreground)] tracking-tight font-sans">
              What can I help you with?
            </h1>
            <p key={greeting} tabIndex={greeting.length > 180 ? 0 : undefined} className="mx-auto max-h-28 max-w-2xl overflow-auto whitespace-pre-wrap break-words text-base sm:text-lg text-[var(--muted-foreground)] font-normal focus-visible:outline focus-visible:outline-[var(--theme-accent)]">
              {greeting}
            </p>
          </div>

          {composer}
          {/* Existing suggestion flows */}
          <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-2xl pt-2">
            {/* 1. Write Code */}
            <button
              onClick={() => handleSuggestionClick('code')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs sm:text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--theme-accent)] cursor-pointer"
            >
              <Code className="w-4 h-4 text-[var(--foreground)]" />
              <span>{builderMode ? 'Write code' : 'Write a message'}</span>
            </button>

            {/* 2. Query SQL */}
            <button
              onClick={() => handleSuggestionClick('sql')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs sm:text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--theme-accent)] cursor-pointer"
            >
              <Database className="w-4 h-4 text-[var(--foreground)]" />
              <span>{builderMode ? 'Query SQL' : 'Make a plan'}</span>
            </button>

            {/* 3. Summarize */}
            <button
              onClick={() => handleSuggestionClick('summarize')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs sm:text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--theme-accent)] cursor-pointer"
            >
              <FileText className="w-4 h-4 text-[var(--foreground)]" />
              <span>Summarize</span>
            </button>

            {/* 4. Analyze Image */}
            <button
              onClick={() => handleSuggestionClick('image')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs sm:text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--theme-accent)] cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 text-[var(--foreground)]" />
              <span>Analyze Image</span>
            </button>
          </div>
        </div>
      ) : (
        /* Active Conversation Column */
        <div className="space-y-2 max-w-[850px] mx-auto w-full pb-4 pr-5">
          <nav aria-label="User prompts" className="sticky top-4 h-0 z-20 flex justify-end translate-x-7">
            <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
              {messages.map((message, index) => message.role === 'user' && (
                <button key={index} type="button" title={typeof message.content === 'string' ? message.content : message.content.filter(p => p.type === 'text').map(p => (p as { text: string }).text).join(' ')}
                  aria-label={`Jump to prompt ${messages.slice(0, index + 1).filter(m => m.role === 'user').length}`}
                  className="group p-2 focus-visible:outline focus-visible:outline-[var(--theme-accent)]"
                  onClick={() => document.getElementById(`chat-prompt-${index}`)?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>
                  <span className="block w-3 h-1 rounded bg-[var(--muted-foreground)] group-hover:bg-[var(--theme-accent)] group-focus-visible:bg-[var(--theme-accent)]" />
                </button>
              ))}
            </div>
          </nav>
          {/* Subtle Clear Conversation header control */}
          <div className="flex justify-end pb-2 select-none">
            <button
              onClick={onClearConversation}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              title="Clear all messages in this conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear conversation</span>
            </button>
          </div>

          {messages.map((msg, idx) => {
            const isLastAssistant = !isGenerating && idx === messages.length - 1 && msg.role === 'assistant';
            const isCurrentlyStreaming = isGenerating && idx === messages.length - 1 && msg.role === 'assistant';

            return (
              <div key={idx} id={msg.role === 'user' ? `chat-prompt-${idx}` : undefined} className="scroll-mt-8">
              {msg.role === 'user' && onEditPrompt && !isGenerating && <button type="button" className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]" onClick={() => onEditPrompt(idx, typeof msg.content === 'string' ? msg.content : msg.content.filter(p => p.type === 'text').map(p => (p as { text: string }).text).join(' '))}>Edit as new prompt</button>}
              <MessageBubble
                message={msg}
                index={idx}
                isStreaming={isCurrentlyStreaming}
                modelName={selectedModel?.name}
                stats={builderMode && isLastAssistant ? generationStats : undefined}
                onRegenerate={isLastAssistant ? onRegenerate : undefined}
                onRetry={isLastAssistant ? onRetry : undefined}
                onSaveToMemory={onSaveToMemory}
              />
              {msg.role === 'assistant' && !!msg.sources?.length && <details className="mx-3 mb-4 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm">
                <summary className="cursor-pointer text-[var(--muted-foreground)] focus-visible:outline focus-visible:outline-[var(--theme-accent)]">Document sources · {msg.sources.length}</summary>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">Passages retrieved for this response. Retrieval does not guarantee that every claim is supported.</p>
                <ol className="mt-3 space-y-3">{msg.sources.map((source, sourceIndex) => <li key={`${source.chunkId}-${sourceIndex}`}>
                  <details><summary className="cursor-pointer font-medium text-[var(--foreground)]">{source.documentName} · Passage {source.chunkIndex + 1}</summary>
                    <blockquote className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words border-l-2 border-[var(--theme-accent)] pl-3 text-[var(--muted-foreground)]">{source.content}</blockquote>
                  </details>
                </li>)}</ol>
              </details>}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
};
