import { describe, expect, it, vi } from 'vitest';
import { InferenceService, type MemoryEngine } from '@local-ai/inference';
import type { InferenceRuntime } from '@local-ai/runtimes';
import type { ChatCompletionRequest } from '@local-ai/shared';

async function run(memory: boolean, memorySave: boolean | undefined) {
  const engine = {
    isAutoRecallEnabled: () => true,
    isAutoExtractEnabled: () => true,
    recall: vi.fn(async () => []),
    extractAndPersistFromUserMessage: vi.fn(async () => []),
  };
  const runtime = { async *chatStream() {
    yield { id: 'local', object: 'chat.completion.chunk', created: 0, model: 'local', choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: 'stop' }] };
  } } as unknown as InferenceRuntime;
  const service = new InferenceService(undefined, undefined, 1, undefined, engine as unknown as MemoryEngine);
  service.setRuntime(runtime, 'local');
  await service.chat({ model: 'local', messages: [{ role: 'user', content: 'I prefer tea.' }], memory, memorySave } as ChatCompletionRequest);
  return engine;
}

describe('independent memory consent', () => {
  it('recalls without saving', async () => {
    const engine = await run(true, false);
    expect(engine.recall).toHaveBeenCalledOnce();
    expect(engine.extractAndPersistFromUserMessage).not.toHaveBeenCalled();
  });
  it('saves without recalling', async () => {
    const engine = await run(false, true);
    expect(engine.recall).not.toHaveBeenCalled();
    expect(engine.extractAndPersistFromUserMessage).toHaveBeenCalledOnce();
  });
  it('disables both for a private request', async () => {
    const engine = await run(false, false);
    expect(engine.recall).not.toHaveBeenCalled();
    expect(engine.extractAndPersistFromUserMessage).not.toHaveBeenCalled();
  });
  it('preserves legacy memory opt-out when memorySave is omitted', async () => {
    const engine = await run(false, undefined);
    expect(engine.recall).not.toHaveBeenCalled();
    expect(engine.extractAndPersistFromUserMessage).not.toHaveBeenCalled();
  });
});
