import crypto from 'node:crypto';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  EmbeddingRequest,
  EmbeddingResponse,
  RagSearchResult,
} from '@local-ai/shared';
import { ModelNotLoadedError, ValidationError } from '@local-ai/shared';
import { ChatCompletionRequestSchema } from '@local-ai/shared';
import type { InferenceRuntime } from '@local-ai/runtimes';
import { RequestQueue } from './queue.js';
import { MetricsRepository, LogsRepository } from '@local-ai/database';
import { createChatCompletionResponse } from '@local-ai/protocol';
import { RagEngine } from './rag.js';
import { MemoryEngine } from './memory/MemoryEngine.js';

export function extractMessageText(message: ChatMessage): string {
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => (part.type === 'text' ? part.text || '' : '[image]'))
      .join(' ');
  }
  return '';
}

export interface InferenceMetrics {
  totalRequests: number;
  activeRequests: number;
  averageTokensPerSec: number;
  averageLatencyMs: number;
}

export class InferenceService {
  private queue: RequestQueue;
  private currentRuntime?: InferenceRuntime;
  private currentModelName: string = '';
  private activeAbortControllers = new Map<string, AbortController>();
  private ragEngine?: RagEngine;
  private memoryEngine?: MemoryEngine;
  private onMemoryMutated?: () => void;
  
  // Rolling metrics
  private totalRequests = 0;
  private recentTokensPerSec: number[] = [];
  private recentLatencies: number[] = [];

  constructor(
    private metricsRepo?: MetricsRepository,
    _logsRepo?: LogsRepository,
    maxConcurrent: number = 4,
    ragEngine?: RagEngine,
    memoryEngine?: MemoryEngine
  ) {
    this.queue = new RequestQueue(maxConcurrent);
    this.ragEngine = ragEngine;
    this.memoryEngine = memoryEngine;
  }

  public setRagEngine(ragEngine?: RagEngine): void {
    this.ragEngine = ragEngine;
  }

  public getRagEngine(): RagEngine | undefined {
    return this.ragEngine;
  }

  public setMemoryEngine(memoryEngine?: MemoryEngine, onMemoryMutated?: () => void): void {
    this.memoryEngine = memoryEngine;
    this.onMemoryMutated = onMemoryMutated;
  }

  public getMemoryEngine(): MemoryEngine | undefined {
    return this.memoryEngine;
  }

  public setRuntime(runtime?: InferenceRuntime, modelName?: string): void {
    this.currentRuntime = runtime;
    this.currentModelName = modelName || '';
  }

  public getRuntime(): InferenceRuntime | undefined {
    return this.currentRuntime;
  }

  public getModelName(): string {
    return this.currentModelName;
  }

  public setMaxConcurrency(max: number): void {
    this.queue.setMaxConcurrent(max);
  }

  public abortRequest(requestId: string): boolean {
    const controller = this.activeAbortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.activeAbortControllers.delete(requestId);
      return true;
    }
    return false;
  }

  public async *chatStream(
    request: ChatCompletionRequest,
    clientIp: string = '127.0.0.1',
    externalSignal?: AbortSignal
  ): AsyncIterable<ChatCompletionResponse> {
    const parsed = ChatCompletionRequestSchema.safeParse(request);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    }

    if (!this.currentRuntime) {
      throw new ModelNotLoadedError('No inference model is currently loaded');
    }

    const release = await this.queue.acquire(externalSignal);
    const requestId = `chatcmpl-${crypto.randomBytes(12).toString('hex')}`;
    const abortController = new AbortController();
    this.activeAbortControllers.set(requestId, abortController);

    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    let completionTokens = 0;
    let accumulatedContent = '';

    const onAbort = () => abortController.abort(externalSignal?.reason);
    externalSignal?.addEventListener('abort', onAbort, { once: true });
    if (externalSignal?.aborted) onAbort();

    try {
      abortController.signal.throwIfAborted();
      this.totalRequests++;

      // Automatically augment messages with local document context if RAG is requested
      let effectiveRequest = { ...request };

      // Layer persona instructions if passed in request and not already present
      if (request.personaInstructions && request.personaInstructions.trim()) {
        const hasInstructions = effectiveRequest.messages.some((m) =>
          typeof m.content === 'string' && m.content.includes(request.personaInstructions!.trim())
        );
        if (!hasInstructions) {
          const sysIdx = effectiveRequest.messages.findIndex((m) => m.role === 'system');
          if (sysIdx >= 0) {
            const existing = typeof effectiveRequest.messages[sysIdx].content === 'string'
              ? (effectiveRequest.messages[sysIdx].content as string)
              : '';
            const updated = existing
              ? `${existing}\n\n---\n\n${request.personaInstructions.trim()}`
              : request.personaInstructions.trim();
            effectiveRequest.messages = effectiveRequest.messages.map((m, idx) =>
              idx === sysIdx ? { ...m, content: updated } : m
            );
          } else {
            effectiveRequest.messages = [
              { role: 'system', content: request.personaInstructions.trim() },
              ...effectiveRequest.messages,
            ];
          }
        }
      }

      const userMessages = request.messages.filter((m) => m.role === 'user');
      const lastUserMsg = userMessages[userMessages.length - 1];
      const lastUserText = lastUserMsg ? extractMessageText(lastUserMsg) : '';

      // Automatically recall long-term memories from LoftyDB when enabled
      const shouldUseMemory =
        Boolean(this.memoryEngine) &&
        (request.memory === true ||
          (request.memory !== false && Boolean(this.memoryEngine?.isAutoRecallEnabled())));

      if (shouldUseMemory && this.memoryEngine && lastUserText) {
        try {
          const recalled = await this.memoryEngine.recall({
            query: lastUserText,
            scope: request.memoryScope || 'all',
            personaId: request.personaId,
            conversationId: request.conversationId,
          });
          if (recalled.length > 0) {
            effectiveRequest.messages = this.memoryEngine.augmentMessages(effectiveRequest.messages, recalled);
          }
        } catch {
          // Graceful fallback if LoftyDB is offline or unreachable
        }

      }

      // Explicit save preference is independent of recall. Existing API callers retain
      // the previous behavior when memorySave is omitted.
      const shouldSaveMemory = request.memorySave ?? (shouldUseMemory && request.memory !== false);
      if (this.memoryEngine && lastUserText && shouldSaveMemory) {
        if (this.memoryEngine.isAutoExtractEnabled()) {
          this.memoryEngine
            .extractAndPersistFromUserMessage(lastUserText, {
              personaId: request.personaId,
              conversationId: request.conversationId,
            })
            .then((saved) => {
              if (saved.length > 0) {
                this.onMemoryMutated?.();
              }
            })
            .catch(() => {});
        }
      }

      let sources: RagSearchResult[] | undefined;
      if (request.rag && this.ragEngine && lastUserText) {
        const searchResults = await this.ragEngine.search(lastUserText, 4, request.ragDocumentIds);
        if (searchResults.length > 0) {
          effectiveRequest.messages = this.ragEngine.augmentMessages(effectiveRequest.messages, searchResults);
          sources = searchResults.map(source => ({ ...source }));
        }
      }

      abortController.signal.throwIfAborted();
      const stream = this.currentRuntime.chatStream(effectiveRequest, abortController.signal);
      let sentSources = false;

      for await (const chunk of stream) {
        abortController.signal.throwIfAborted();
        if (!firstTokenTime) {
          firstTokenTime = Date.now();
        }

        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          completionTokens++;
          accumulatedContent += delta;
        }

        // Ensure chunk contains ID
        chunk.id = requestId;
        chunk.model = this.currentModelName || request.model;
        if (!sentSources && sources?.length) { chunk.sources = sources; sentSources = true; }
        yield chunk;
      }

      const endTime = Date.now();
      const latencyMs = endTime - startTime;
      const durationSec = (endTime - (firstTokenTime || startTime)) / 1000;
      const tokensPerSec = durationSec > 0 ? completionTokens / durationSec : 0;

      // Update rolling metrics
      this.recordMetricsSample(tokensPerSec, latencyMs);

      // Estimate prompt tokens roughly (4 chars per token)
      const promptText = effectiveRequest.messages.map(extractMessageText).join(' ');
      const promptTokens = Math.max(1, Math.ceil(promptText.length / 4));

      this.metricsRepo?.logRequest({
        id: requestId,
        modelId: this.currentModelName || request.model,
        clientIp,
        promptTokens,
        completionTokens,
        latencyMs,
        tokensPerSec,
        statusCode: 200,
        isStreaming: true,
      });
    } catch (err: any) {
      const endTime = Date.now();
      const latencyMs = endTime - startTime;
      this.metricsRepo?.logRequest({
        id: requestId,
        modelId: this.currentModelName || request.model,
        clientIp,
        promptTokens: 0,
        completionTokens,
        latencyMs,
        tokensPerSec: 0,
        statusCode: err?.statusCode || 500,
        isStreaming: true,
        errorMessage: err?.message,
      });
      throw err;
    } finally {
      externalSignal?.removeEventListener('abort', onAbort);
      this.activeAbortControllers.delete(requestId);
      release();
    }
  }

  public async chat(
    request: ChatCompletionRequest,
    clientIp: string = '127.0.0.1',
    signal?: AbortSignal
  ): Promise<ChatCompletionResponse> {
    const requestId = `chatcmpl-${crypto.randomBytes(12).toString('hex')}`;
    let accumulatedContent = '';
    let finishReason: 'stop' | 'length' = 'stop';
    let sources: RagSearchResult[] | undefined;
    const startTime = Date.now();

    for await (const chunk of this.chatStream(request, clientIp, signal)) {
      if (chunk.sources) sources = chunk.sources;
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) accumulatedContent += delta;
      if (chunk.choices[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason as any;
      }
    }

    const promptText = request.messages.map(extractMessageText).join(' ');
    const promptTokens = Math.max(1, Math.ceil(promptText.length / 4));
    const completionTokens = Math.max(1, Math.ceil(accumulatedContent.length / 4));

    const response = createChatCompletionResponse({
      id: requestId,
      model: this.currentModelName || request.model,
      created: Math.floor(startTime / 1000),
      message: {
        role: 'assistant',
        content: accumulatedContent,
        ...(sources ? { sources } : {}),
      },
      finishReason,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    });
    if (sources) response.sources = sources;
    return response;
  }

  public async embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (!this.currentRuntime) {
      throw new ModelNotLoadedError('No inference model is currently loaded');
    }
    return this.currentRuntime.embeddings(request);
  }

  public getMetrics(): InferenceMetrics {
    const avgTok = this.recentTokensPerSec.length > 0
      ? this.recentTokensPerSec.reduce((a, b) => a + b, 0) / this.recentTokensPerSec.length
      : 0;

    const avgLat = this.recentLatencies.length > 0
      ? this.recentLatencies.reduce((a, b) => a + b, 0) / this.recentLatencies.length
      : 0;

    return {
      totalRequests: this.totalRequests,
      activeRequests: this.queue.getActiveCount(),
      averageTokensPerSec: parseFloat(avgTok.toFixed(1)),
      averageLatencyMs: Math.round(avgLat),
    };
  }

  private recordMetricsSample(tokPerSec: number, latencyMs: number): void {
    if (tokPerSec > 0) {
      this.recentTokensPerSec.push(tokPerSec);
      if (this.recentTokensPerSec.length > 20) this.recentTokensPerSec.shift();
    }
    if (latencyMs > 0) {
      this.recentLatencies.push(latencyMs);
      if (this.recentLatencies.length > 20) this.recentLatencies.shift();
    }
  }
}
