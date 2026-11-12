import { describe, expect, it } from 'vitest';
import { InferenceService, RagEngine } from '@local-ai/inference';
import type { InferenceRuntime } from '@local-ai/runtimes';
import type { ChatCompletionRequest, ChatMessage, RagSearchResult } from '@local-ai/shared';

const source: RagSearchResult = { documentId: 'handbook', documentName: 'Handbook.md', chunkId: 'handbook-2', chunkIndex: 1, content: 'The local service listens on port 8080.', score: 0.94 };
function service() {
  let modelMessages: ChatMessage[] = [];
  const rag = {
    search: async () => [source],
    augmentMessages: (messages: ChatMessage[], sources: RagSearchResult[]) => [{ role: 'system', content: sources.map(s => s.content).join('\n') }, ...messages] as ChatMessage[],
  } as unknown as RagEngine;
  const runtime = {
    async *chatStream(request: ChatCompletionRequest) {
      modelMessages = request.messages;
      yield { id: 'chunk', object: 'chat.completion.chunk' as const, created: 0, model: 'local', choices: [{ index: 0, delta: { content: 'Port 8080.' } }] };
      yield { id: 'chunk', object: 'chat.completion.chunk' as const, created: 0, model: 'local', choices: [{ index: 0, delta: {}, finish_reason: 'stop' as const }] };
    },
  } as unknown as InferenceRuntime;
  const inference = new InferenceService(undefined, undefined, 1, rag);
  inference.setRuntime(runtime, 'local');
  return { inference, messages: () => modelMessages };
}
const request: ChatCompletionRequest = { model: 'local', messages: [{ role: 'user', content: 'What is the service port?' }], rag: true, memory: false };

describe('document retrieval provenance', () => {
  it('emits the exact supplied source once in a streamed response', async () => {
    const test = service(); const chunks = [];
    for await (const chunk of test.inference.chatStream(request)) chunks.push(chunk);
    expect(chunks[0].sources).toEqual([source]);
    expect(chunks[1].sources).toBeUndefined();
    expect(test.messages()[0].content).toContain(source.content);
    expect(chunks[0].sources?.[0]).not.toBe(source);
  });
  it('retains provenance on the final non-streamed response and message', async () => {
    const test = service(); const response = await test.inference.chat(request);
    expect(response.sources).toEqual([source]);
    expect(response.choices[0].message?.sources).toEqual([source]);
    expect(response.choices[0].message?.content).toBe('Port 8080.');
  });
  it('does not claim document context when retrieval is disabled', async () => {
    const test = service(); const response = await test.inference.chat({ ...request, rag: false });
    expect(response.sources).toBeUndefined();
    expect(test.messages().every(m => m.role !== 'system')).toBe(true);
  });
});
