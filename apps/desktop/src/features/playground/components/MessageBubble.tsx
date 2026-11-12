import React, { useEffect, useRef, useState } from 'react';
import {
  Copy,
  Volume2,
  Square,
  Check,
  RotateCw,
  Clock,
  Zap,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  BookmarkPlus,
} from 'lucide-react';
import type { ChatMessage, ChatMessageContentPart, ChartSpec, PresentationSpec } from '@local-ai/shared';
import { MarkdownRenderer } from '../utils/markdown';
import { parseMessageSpecs } from '../utils/specParser';
import { InlineChartCard } from '../../visualizations/InlineChartCard';
import { InlinePresentationCard } from '../../presentations/InlinePresentationCard';
import { PresentationStudioModal } from '../../presentations/PresentationStudioModal';
import { createPresentationFromChart } from '../../presentations/ReferenceParser';
import type { InferenceGenerationStats } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
  index: number;
  isStreaming?: boolean;
  modelName?: string;
  stats?: InferenceGenerationStats;
  onRegenerate?: () => void;
  onRetry?: () => void;
  onOpenPresentationStudio?: (spec: PresentationSpec) => void;
  onSaveToMemory?: (text: string) => void | Promise<void>;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isStreaming,
  modelName,
  stats,
  onRegenerate,
  onOpenPresentationStudio,
  onSaveToMemory,
}) => {
  const [actionError, setActionError] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [localVoices, setLocalVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const speech = window.speechSynthesis;
    const refresh = () => setLocalVoices(speech.getVoices().filter(voice => voice.localService));
    refresh(); speech.addEventListener('voiceschanged', refresh);
    return () => { speech.removeEventListener('voiceschanged', refresh); if (utterance.current) { utterance.current.onend = null; utterance.current.onerror = null; speech.cancel(); } };
  }, []);
  const [copied, setCopied] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);
  const [savedMem, setSavedMem] = useState(false);
  const [feedback, setFeedback] = useState<'liked' | 'disliked' | null>(null);
  const [generatedDeck, setGeneratedDeck] = useState<PresentationSpec | null>(null);
  const isUser = message.role === 'user';

  const extractRawText = (content: string | ChatMessageContentPart[]): string => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((p) => (p.type === 'text' ? p.text : ''))
        .filter(Boolean)
        .join('\n');
    }
    return '';
  };

  const rawText = extractRawText(message.content);
  const parsed = parseMessageSpecs(rawText);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(rawText); setActionError(''); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setActionError('Could not copy. Select the response text and copy it manually.'); }
  };
  const readAloud = () => {
    if (speaking) { window.speechSynthesis.cancel(); utterance.current = null; setSpeaking(false); return; }
    if (!localVoices.length) return;
    const speech = new SpeechSynthesisUtterance(rawText);
    speech.voice = localVoices.find(voice => voice.default) || localVoices[0];
    speech.onend = () => { utterance.current = null; setSpeaking(false); };
    speech.onerror = () => { utterance.current = null; setSpeaking(false); setActionError('Local read aloud stopped. Please try again.'); };
    utterance.current = speech; setActionError(''); setSpeaking(true); window.speechSynthesis.speak(speech);
  };

  const handleCreatePresentationFromChart = (chart: ChartSpec) => {
    const deck = createPresentationFromChart(chart);
    if (onOpenPresentationStudio) {
      onOpenPresentationStudio(deck);
    } else {
      setGeneratedDeck(deck);
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end w-full py-2">
        <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-[#f5f5f5] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-[#111111] dark:text-[#F5F5F5] text-sm leading-relaxed break-words shadow-xs select-text">
          {typeof message.content === 'string' ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : Array.isArray(message.content) ? (
            <div className="space-y-2">
              {message.content.map((part, pIdx) => {
                if (part.type === 'image_url') {
                  return (
                    <div key={pIdx} className="rounded-xl overflow-hidden max-w-sm my-1 border border-zinc-200 dark:border-[#262626]">
                      <img src={part.image_url.url} alt="Attachment" className="max-h-60 w-auto object-contain rounded" />
                    </div>
                  );
                }
                if (part.type === 'text') {
                  return <p key={pIdx} className="whitespace-pre-wrap">{part.text}</p>;
                }
                return null;
              })}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // AI Response: Clean Document Style
  return (
    <div className="w-full py-4 text-sm select-text group">
      {/* Model Name Indicator */}
      {modelName && (
        <div className="text-[11px] font-mono text-zinc-400 dark:text-[#737373] mb-2 flex items-center gap-1.5 select-none">
          <Sparkles className="w-3 h-3 text-zinc-400 dark:text-[#737373]" />
          <span>{modelName}</span>
        </div>
      )}

      {/* Content Rendering */}
      <div className="prose dark:prose-invert max-w-none text-[#111111] dark:text-[#F5F5F5] leading-relaxed break-words">
        {typeof message.content === 'string' ? (
          <div>
            {parsed.cleanContent && <MarkdownRenderer content={parsed.cleanContent} />}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-1 bg-zinc-900 dark:bg-white animate-pulse align-middle" />
            )}
          </div>
        ) : Array.isArray(message.content) ? (
          <div className="space-y-2">
            {message.content.map((part, pIdx) => {
              if (part.type === 'image_url') {
                return (
                  <div key={pIdx} className="rounded-xl overflow-hidden max-w-sm my-2 border border-zinc-200 dark:border-[#262626]">
                    <img src={part.image_url.url} alt="Output visual" className="max-h-64 w-auto object-contain" />
                  </div>
                );
              }
              if (part.type === 'text') {
                const subParsed = parseMessageSpecs(part.text);
                return subParsed.cleanContent ? <MarkdownRenderer key={pIdx} content={subParsed.cleanContent} /> : null;
              }
              return null;
            })}
          </div>
        ) : null}

        {/* Embedded Charts (if any detected) */}
        {!isStreaming && parsed.charts.length > 0 && (
          <div className="space-y-3 my-2 not-prose">
            {parsed.charts.map((chart, cIdx) => (
              <InlineChartCard
                key={chart.id || cIdx}
                spec={chart}
                onCreatePresentation={handleCreatePresentationFromChart}
              />
            ))}
          </div>
        )}

        {/* Embedded Presentations (if any detected) */}
        {!isStreaming && parsed.presentations.length > 0 && (
          <div className="space-y-3 my-2 not-prose">
            {parsed.presentations.map((pres, pIdx) => (
              <InlinePresentationCard
                key={pres.id || pIdx}
                spec={pres}
              />
            ))}
          </div>
        )}
      </div>

      {/* Active Studio Modal if user created deck from inline chart */}
      {generatedDeck && (
        <PresentationStudioModal
          isOpen={true}
          initialSpec={generatedDeck}
          onClose={() => setGeneratedDeck(null)}
        />
      )}


      {/* AI Response Actions Row */}
      {!isStreaming && rawText && (
        <div className="mt-3.5 flex items-center justify-between text-xs text-zinc-400 dark:text-[#737373] select-none">
          <div className="flex items-center gap-1">
            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-[#202020] text-zinc-400 dark:text-[#A1A1AA] hover:text-zinc-800 dark:hover:text-[#F5F5F5] transition-colors"
              title="Copy response"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button type="button" onClick={readAloud} disabled={!localVoices.length}
              aria-label={speaking ? 'Stop reading aloud' : 'Read response aloud'} aria-pressed={speaking}
              title={localVoices.length ? (speaking ? 'Stop reading aloud' : 'Read aloud using an on-device voice') : 'No on-device voice is available. Install a system voice to enable read aloud.'}
              className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-40">
              {speaking ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            {actionError && <span role="alert" className="max-w-64 text-xs text-[var(--status-error)]">{actionError}</span>}
            {/* Regenerate Button */}
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-[#202020] text-zinc-400 dark:text-[#A1A1AA] hover:text-zinc-800 dark:hover:text-[#F5F5F5] transition-colors"
                title="Regenerate response"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Like */}
            <button
              onClick={() => setFeedback(feedback === 'liked' ? null : 'liked')}
              className={`p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-[#202020] transition-colors ${
                feedback === 'liked' ? 'text-black dark:text-white' : 'text-zinc-400 dark:text-[#A1A1AA] hover:text-zinc-800 dark:hover:text-[#F5F5F5]'
              }`}
              title="Good response"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>

            {/* Dislike */}
            <button
              onClick={() => setFeedback(feedback === 'disliked' ? null : 'disliked')}
              className={`p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-[#202020] transition-colors ${
                feedback === 'disliked' ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-400 dark:text-[#A1A1AA] hover:text-zinc-800 dark:hover:text-[#F5F5F5]'
              }`}
              title="Bad response"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>

            {onSaveToMemory && (
              <button
                disabled={savingMemory}
                onClick={async () => {
                  setSavingMemory(true); setActionError('');
                  try {
                    await onSaveToMemory(rawText);
                    setSavedMem(true); setTimeout(() => setSavedMem(false), 2000);
                  } catch (error) { setActionError(error instanceof Error ? error.message : 'Could not save this memory. Try again.'); }
                  finally { setSavingMemory(false); }
                }}
                className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-[#202020] text-zinc-400 dark:text-[#A1A1AA] hover:text-zinc-800 dark:hover:text-[#F5F5F5] transition-colors"
                title={savingMemory ? 'Saving memory…' : 'Save to memory'}
              >
                {savedMem ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <BookmarkPlus className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          {/* Performance Stats Pill */}
          {stats && (
            <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 dark:text-[#737373]">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-500" />
                {stats.tokensPerSec} tok/s
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {stats.latencyMs} ms
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
