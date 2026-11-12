import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { RequestQueue } from '../packages/inference/src/queue';
import { InferenceService } from '../packages/inference/src/service';

describe('inference cancellation', () => {
  it('removes a canceled waiter and preserves capacity for the next request', async () => {
    const queue = new RequestQueue(1);
    const release = await queue.acquire();
    const controller = new AbortController();
    const canceled = queue.acquire(controller.signal);
    const rejection = expect(canceled).rejects.toMatchObject({ name: 'AbortError' });
    const waiting = queue.acquire();
    controller.abort();
    await rejection;
    expect(queue.getQueueLength()).toBe(1);
    release();
    const finish = await waiting;
    expect(queue.getActiveCount()).toBe(1);
    release(); // Releasing an old lease twice must not release a new request.
    expect(queue.getActiveCount()).toBe(1);
    finish();
    expect(queue.getActiveCount()).toBe(0);
  });

  it('rejects already-aborted requests before allocating capacity', async () => {
    const queue = new RequestQueue(1);
    const controller = new AbortController();
    controller.abort();
    await expect(queue.acquire(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(queue.getActiveCount()).toBe(0);
  });

  it('stops before the first token and allows the next legacy request to run', async () => {
    const service = new InferenceService(undefined, undefined, 1);
    let started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    let calls = 0;
    service.setRuntime({
      async *chatStream(_request: unknown, signal: AbortSignal) {
        calls++;
        if (calls === 1) {
          started();
          await new Promise<void>((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
          });
        }
        yield { id: 'runtime', choices: [{ index: 0, delta: { content: 'ok' } }] };
      },
    } as any);
    const request = { model: 'test', messages: [{ role: 'user' as const, content: 'hello' }] };
    const controller = new AbortController();
    const first = service.chatStream(request, undefined, controller.signal)[Symbol.asyncIterator]().next();
    const rejection = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await ready;
    controller.abort();
    await rejection;
    expect(service.getMetrics().activeRequests).toBe(0);
    const result = await service.chat(request);
    expect(result.choices[0].message?.content).toBe('ok');
    expect(service.getMetrics().activeRequests).toBe(0);
  });
});

// Guard the renderer/native boundary without requiring a graphical Electron session.
describe('desktop stream ownership', () => {
  it('assigns IDs before invoke and filters concurrent streams in both consumers', () => {
    const playground = readFileSync('apps/desktop/src/features/playground/PlaygroundView.tsx', 'utf8');
    const preview = readFileSync('apps/desktop/src/features/personas/components/PersonaTestChat.tsx', 'utf8');
    expect(playground).toContain('const clientRequestId = crypto.randomUUID()');
    expect(playground).toContain('streamRequestIdRef.current = clientRequestId');
    expect(playground).toContain('if (data.requestId !== clientRequestId) return');
    expect(preview).toContain('id: crypto.randomUUID()');
    expect(preview).toContain('if (current.id !== requestId) return');
    expect(preview).toContain('clientRequestId: current.id');
    expect(preview).not.toContain('if (!current.id) current.id = requestId');
  });

  it('preserves legacy IDs while correlating new requests and preventing active collisions', () => {
    const handlers = readFileSync('apps/desktop/electron/ipc/handlers.ts', 'utf8');
    expect(handlers).toContain('requestId: clientRequestId ?? chunk.id');
    expect(handlers).toContain('pendingInference.has(clientRequestId)');
    expect(handlers).toContain('pendingInference.delete(clientRequestId)');
    expect(handlers).toContain('pendingInference.clear()');
  });
});
