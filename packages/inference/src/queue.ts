import { RateLimitError } from '@local-ai/shared';

export class RequestQueue {
  private activeCount = 0;
  private queue: Array<() => void> = [];

  constructor(
    private maxConcurrent: number = 4,
    private maxQueueSize: number = 16
  ) {}

  public getActiveCount(): number {
    return this.activeCount;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public setMaxConcurrent(limit: number): void {
    this.maxConcurrent = Math.max(1, limit);
    this.processNext();
  }

  public async acquire(signal?: AbortSignal): Promise<() => void> {
    signal?.throwIfAborted();
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++;
      return this.createRelease();
    }

    if (this.queue.length >= this.maxQueueSize) {
      throw new RateLimitError('Inference server queue is full. Try again shortly.');
    }

    return new Promise<() => void>((resolve, reject) => {
      const onAbort = () => {
        this.queue = this.queue.filter((entry) => entry !== grant);
        reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
      };
      const grant = () => {
        signal?.removeEventListener('abort', onAbort);
        this.activeCount++;
        resolve(this.createRelease());
      };
      this.queue.push(grant);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  private createRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.release();
    };
  }

  private release(): void {
    this.activeCount = Math.max(0, this.activeCount - 1);
    this.processNext();
  }

  private processNext(): void {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }
}
