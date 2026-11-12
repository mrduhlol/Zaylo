import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ listener: undefined as ((event: KeyboardEvent) => void) | undefined }));
vi.mock('../apps/desktop/node_modules/react/index.js', () => ({ useEffect: (effect: () => unknown) => effect() }));
vi.mock('../apps/desktop/src/stores/useWorkspacePreferences', () => ({
  DEFAULT_KEYBINDINGS: { chat1: 'Mod+1', accidentalCopy: 'Mod+C' },
  useWorkspacePreferences: (select: (s: unknown) => unknown) => select({ keybindings: { chat1: 'Mod+1', accidentalCopy: 'Mod+C' } }),
}));
import { shortcutConflict, useWorkspaceShortcuts } from '../apps/desktop/src/features/settings/useWorkspaceShortcuts';

class Control {
  constructor(private kind: 'input' | 'capture' | 'contenteditable') {}
  closest(selectors: string) {
    return (this.kind === 'input' && selectors.includes('input')) || (this.kind === 'capture' && selectors.includes('data-shortcut-capture')) || (this.kind === 'contenteditable' && selectors.includes('contenteditable')) ? this : null;
  }
}
function event(key: string, target: Control, patch: Record<string, unknown> = {}) {
  return { key, target, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, repeat: false, defaultPrevented: false,
    isComposing: false, keyCode: 0, preventDefault: vi.fn(), getModifierState: () => false, ...patch } as unknown as KeyboardEvent;
}
beforeEach(() => {
  vi.stubGlobal('Element', Control);
  vi.stubGlobal('navigator', { platform: 'Linux' });
  vi.stubGlobal('window', { addEventListener: (_name: string, callback: (e: KeyboardEvent) => void) => { state.listener = callback; }, removeEventListener: vi.fn() });
});
afterEach(() => { vi.unstubAllGlobals(); state.listener = undefined; });

describe('workspace shortcut dispatch', () => {
  it('switches chats while the plain text composer has focus', () => {
    const action = vi.fn(); useWorkspaceShortcuts({ chat1: action }); const e = event('1', new Control('input'));
    state.listener?.(e); expect(action).toHaveBeenCalledOnce(); expect(e.preventDefault).toHaveBeenCalledOnce();
  });
  it('preserves native copy even if a custom binding tries to claim it inside text input', () => {
    const action = vi.fn(); useWorkspaceShortcuts({ accidentalCopy: action }); const e = event('c', new Control('input'));
    state.listener?.(e); expect(action).not.toHaveBeenCalled(); expect(e.preventDefault).not.toHaveBeenCalled();
  });
  it('does not navigate during IME composition or shortcut capture', () => {
    const action = vi.fn(); useWorkspaceShortcuts({ chat1: action });
    state.listener?.(event('1', new Control('input'), { isComposing: true }));
    state.listener?.(event('1', new Control('capture')));
    state.listener?.(event('1', new Control('contenteditable')));
    expect(action).not.toHaveBeenCalled();
  });
  it('detects case-insensitive conflicts without treating an unchanged binding as a conflict', () => {
    expect(shortcutConflict({ a: 'Mod+K', b: 'Mod+B' }, 'b', 'mod+k')).toBe('a');
    expect(shortcutConflict({ a: 'Mod+K' }, 'a', 'mod+k')).toBeUndefined();
  });
});
