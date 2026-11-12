import { afterEach, describe, expect, it } from 'vitest';
import { chatDrafts, mayRecallMemory, maySaveMemory, nextBackground } from '../apps/desktop/src/features/playground/hooks/chatSession';

afterEach(() => chatDrafts.clear());

describe('chat privacy and draft isolation', () => {
  it('forbids temporary chat recall and saving even when memory flags are enabled', () => {
    const temporary = { temporary: true, memoryEnabled: true, memorySaveEnabled: true };
    expect(mayRecallMemory(temporary)).toBe(false);
    expect(maySaveMemory(temporary)).toBe(false);
  });
  it('honors independent explicit recall and save restrictions', () => {
    expect(mayRecallMemory({ memoryEnabled: false })).toBe(false);
    expect(maySaveMemory({ memorySaveEnabled: false })).toBe(false);
    expect(mayRecallMemory({ memorySaveEnabled: false })).toBe(true);
    expect(maySaveMemory({ memoryEnabled: false })).toBe(true);
  });
  it('keeps text and image selection isolated by chat without invoking storage', () => {
    const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('Drafts must not access storage'); } });
    try {
      chatDrafts.set('regular', { text: 'first', image: { name: 'local.png', dataUrl: 'data:image/png;base64,AA' } });
      chatDrafts.set('temporary', { text: 'private' });
      expect(chatDrafts.get('temporary')).toEqual({ text: 'private' });
      expect(chatDrafts.get('regular')?.image?.name).toBe('local.png');
      chatDrafts.set('temporary', { text: '' });
      expect(chatDrafts.get('regular')?.text).toBe('first');
    } finally {
      if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage);
      else Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
});

describe('new conversation background selection', () => {
  it('can select all ten sources initially', () => {
    expect(new Set(Array.from({ length: 100 }, (_, i) => nextBackground(10, -1, () => i / 100))).size).toBe(10);
  });
  it('never immediately repeats and can reach every other source', () => {
    for (let previous = 0; previous < 10; previous++) {
      const selections = Array.from({ length: 100 }, (_, i) => nextBackground(10, previous, () => i / 100));
      expect(selections).not.toContain(previous);
      expect(new Set(selections).size).toBe(9);
    }
  });
  it('supports a single available source', () => expect(nextBackground(1, 0)).toBe(0));
});
