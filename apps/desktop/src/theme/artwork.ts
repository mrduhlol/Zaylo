import type { ThemeFamily } from '../stores/useWorkspacePreferences';

/** User-supplied ASCII stills, bundled offline and shared by header/theme previews. */
export const themeArtwork: Record<ThemeFamily, { src: string; filter?: string }> = {
  't3-chat': { src: new URL('./artwork/t3-chat.jpg', import.meta.url).href },
  grove: { src: new URL('./artwork/ember.jpg', import.meta.url).href, filter: 'hue-rotate(65deg) saturate(.7)' },
  ocean: { src: new URL('./artwork/ocean.jpg', import.meta.url).href },
  ember: { src: new URL('./artwork/ember.jpg', import.meta.url).href },
  iris: { src: new URL('./artwork/iris.jpg', import.meta.url).href },
};
