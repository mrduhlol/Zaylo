/*
 * Zaylo appearance preference application.
 *
 * Single entry point the app shell calls whenever an appearance preference
 * changes. Keeps components declarative: components never touch CSS
 * variables directly.
 */
import type { useWorkspacePreferences } from '../stores/useWorkspacePreferences';

type WorkspacePrefs = ReturnType<typeof useWorkspacePreferences.getState>;

/** Valid theme family identifiers, mirroring ThemeFamily in the shared store. */
export const THEME_FAMILIES = [
  't3-chat',
  'grove',
  'ocean',
  'ember',
  'iris',
] as const;

/**
 * Apply appearance preferences to the document root as CSS attributes and
 * custom properties consumed by theme/palettes.css, theme/fonts.css and
 * theme/effects.css. Idempotent: safe to call on every store change.
 */
export function applyWorkspacePreferences(prefs: Pick<WorkspacePrefs,
  'themeFamily' | 'translucent' | 'opacity' | 'animationsEnabled' |
  'animationIntensity' | 'textSize'>): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const family = (THEME_FAMILIES as readonly string[]).includes(prefs.themeFamily)
    ? prefs.themeFamily
    : 'iris';

  root.setAttribute('data-theme-family', family);
  root.setAttribute('data-translucent', prefs.translucent ? 'true' : 'false');
  root.setAttribute(
    'data-motion',
    prefs.animationsEnabled ? 'on' : 'off',
  );

  root.style.setProperty('--zaylo-text-size', `${prefs.textSize}px`);
  root.style.setProperty('--zaylo-opacity', String(prefs.opacity));
  root.style.setProperty('--zaylo-motion', String(prefs.animationIntensity));
}

/**
 * Subscribe a store to preference application. Returns the unsubscribe
 * function so the app shell can clean up on unmount.
 */
export function watchWorkspacePreferences(
  store: typeof useWorkspacePreferences,
): () => void {
  const apply = () => applyWorkspacePreferences(store.getState());
  apply();
  return store.subscribe(apply);
}
