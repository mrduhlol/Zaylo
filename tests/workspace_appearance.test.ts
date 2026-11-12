import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyWorkspacePreferences, THEME_FAMILIES, watchWorkspacePreferences } from '../apps/desktop/src/theme';

const prefs = { themeFamily: 'grove' as const, translucent: true, opacity: .75, animationsEnabled: false, animationIntensity: .3, textSize: 20 };
afterEach(() => vi.unstubAllGlobals());
function documentRoot() {
  const attributes = new Map<string, string>(); const properties = new Map<string, string>();
  vi.stubGlobal('document', { documentElement: { setAttribute: (key: string, value: string) => attributes.set(key, value), style: { setProperty: (key: string, value: string) => properties.set(key, value) } } });
  return { attributes, properties };
}
describe('workspace appearance application', () => {
  it.each(THEME_FAMILIES)('applies %s without changing Light/Dark selection', family => {
    const root = documentRoot(); root.attributes.set('data-theme', 'light');
    applyWorkspacePreferences({ ...prefs, themeFamily: family });
    expect(root.attributes.get('data-theme-family')).toBe(family);
    expect(root.attributes.get('data-theme')).toBe('light');
    expect(root.attributes.get('data-translucent')).toBe('true');
    expect(root.attributes.get('data-motion')).toBe('off');
    expect(root.properties.get('--zaylo-text-size')).toBe('20px');
  });
  it('falls back to a known palette for an unsupported persisted family', () => {
    const root = documentRoot();
    applyWorkspacePreferences({ ...prefs, themeFamily: 'unsupported' as typeof prefs.themeFamily });
    expect(root.attributes.get('data-theme-family')).toBe('iris');
  });
  it('applies updates and returns store subscription cleanup', () => {
    const root = documentRoot(); let current = { ...prefs }; let notify = () => {};
    const unsubscribe = vi.fn();
    const store = { getState: () => current, subscribe: (callback: () => void) => { notify = callback; return unsubscribe; } };
    const stop = watchWorkspacePreferences(store as unknown as Parameters<typeof watchWorkspacePreferences>[0]);
    expect(root.properties.get('--zaylo-opacity')).toBe('0.75');
    current = { ...current, textSize: 24, opacity: 1 }; notify();
    expect(root.properties.get('--zaylo-text-size')).toBe('24px');
    expect(root.properties.get('--zaylo-opacity')).toBe('1');
    stop(); expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
