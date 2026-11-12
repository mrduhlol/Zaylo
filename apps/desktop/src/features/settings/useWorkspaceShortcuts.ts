import { useEffect } from 'react';
import { DEFAULT_KEYBINDINGS, useWorkspacePreferences } from '../../stores/useWorkspacePreferences';

export type WorkspaceShortcutAction = keyof typeof DEFAULT_KEYBINDINGS;
export const shortcutLabels: Record<string, string> = {
  newChat: 'New chat', searchChats: 'Search chats', toggleSidebar: 'Toggle sidebar', settings: 'Open Settings',
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`chat${i + 1}`, `Open sidebar chat ${i + 1}`])),
};

/** Shared by capture and dispatch; Mod means Command on macOS and Control elsewhere. */
export function shortcutFromEvent(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>): string | null {
  if (['Control', 'Meta', 'Alt', 'Shift', 'Dead', 'Process', 'Unidentified'].includes(event.key)) return null;
  if (event.metaKey && event.ctrlKey) return null;
  const key = event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key;
  return [...(event.metaKey || event.ctrlKey ? ['Mod'] : []), ...(event.altKey ? ['Alt'] : []), ...(event.shiftKey ? ['Shift'] : []), key].join('+');
}

export function shortcutConflict(bindings: Record<string, string>, action: string, shortcut: string): string | undefined {
  return Object.keys(bindings).find(key => key !== action && bindings[key].toLowerCase() === shortcut.toLowerCase());
}

/** Parent supplies navigation actions. Text editing, IME and Settings capture retain their keyboard events. */
export function useWorkspaceShortcuts(actions: Partial<Record<WorkspaceShortcutAction, () => void>>) {
  const keybindings = useWorkspacePreferences(state => state.keybindings);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.keyCode === 229) return;
      const target = event.target;
      if (target instanceof Element && target.closest('select, [contenteditable="true"], [role="combobox"], [data-shortcut-capture]')) return;
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
      if ((isMac && event.ctrlKey) || (!isMac && event.metaKey)) return;
      const shortcut = shortcutFromEvent(event);
      const textInput = target instanceof Element && Boolean(target.closest('input, textarea'));
      const editing = new Set(['Mod+A', 'Mod+C', 'Mod+V', 'Mod+X', 'Mod+Z', 'Mod+Shift+Z', 'Mod+Y']);
      if (textInput && (!shortcut?.startsWith('Mod+') || editing.has(shortcut))) return;
      if (event.getModifierState?.('AltGraph')) return;
      const action = Object.keys(keybindings).find(key => keybindings[key].toLowerCase() === shortcut?.toLowerCase());
      if (action && actions[action]) { event.preventDefault(); actions[action]?.(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions, keybindings]);
}
