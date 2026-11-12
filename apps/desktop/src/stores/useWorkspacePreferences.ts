import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeFamily = 't3-chat' | 'grove' | 'ocean' | 'ember' | 'iris';
export type StartupBehavior = 'new-chat' | 'continue';
export type StatusMetric = 'cpu' | 'ram' | 'gpu' | 'vram' | 'model' | 'speed';

export const DEFAULT_KEYBINDINGS: Record<string, string> = {
  newChat: 'Mod+Shift+O',
  searchChats: 'Mod+K',
  toggleSidebar: 'Mod+B',
  settings: 'Mod+,',
  chat1: 'Mod+1', chat2: 'Mod+2', chat3: 'Mod+3',
  chat4: 'Mod+4', chat5: 'Mod+5', chat6: 'Mod+6',
  chat7: 'Mod+7', chat8: 'Mod+8', chat9: 'Mod+9',
};

interface WorkspacePreferences {
  builderMode: boolean;
  themeFamily: ThemeFamily;
  translucent: boolean;
  opacity: number;
  animationsEnabled: boolean;
  animationIntensity: number;
  startupBehavior: StartupBehavior;
  reviewVoiceBeforeSending: boolean;
  textSize: number;
  defaultPersonaId: string | null;
  collapsedSections: Record<string, boolean>;
  visibleMetrics: StatusMetric[];
  keybindings: Record<string, string>;
  setBuilderMode: (value: boolean) => void;
  setThemeFamily: (value: ThemeFamily) => void;
  setTranslucent: (value: boolean) => void;
  setOpacity: (value: number) => void;
  setAnimationsEnabled: (value: boolean) => void;
  setAnimationIntensity: (value: number) => void;
  setStartupBehavior: (value: StartupBehavior) => void;
  setReviewVoiceBeforeSending: (value: boolean) => void;
  setTextSize: (value: number) => void;
  setDefaultPersonaId: (value: string | null) => void;
  toggleSection: (name: string) => void;
  setVisibleMetrics: (value: StatusMetric[]) => void;
  setKeybinding: (action: string, shortcut: string) => void;
  resetKeybindings: () => void;
}

/** Device-local presentation preferences; no conversation content is stored here. */
export const useWorkspacePreferences = create<WorkspacePreferences>()(persist((set) => ({
  builderMode: false,
  themeFamily: 'iris',
  translucent: false,
  opacity: 0.9,
  animationsEnabled: true,
  animationIntensity: 0.5,
  startupBehavior: 'new-chat',
  reviewVoiceBeforeSending: false,
  textSize: 16,
  defaultPersonaId: null,
  collapsedSections: {},
  visibleMetrics: ['cpu', 'ram', 'model', 'speed'],
  keybindings: { ...DEFAULT_KEYBINDINGS },
  setBuilderMode: (builderMode) => set({ builderMode }),
  setThemeFamily: (themeFamily) => set({ themeFamily }),
  setTranslucent: (translucent) => set({ translucent }),
  setOpacity: (opacity) => set({ opacity: Math.min(1, Math.max(0.65, opacity)) }),
  setAnimationsEnabled: (animationsEnabled) => set({ animationsEnabled }),
  setAnimationIntensity: (animationIntensity) => set({ animationIntensity: Math.min(1, Math.max(0, animationIntensity)) }),
  setStartupBehavior: (startupBehavior) => set({ startupBehavior }),
  setReviewVoiceBeforeSending: (reviewVoiceBeforeSending) => set({ reviewVoiceBeforeSending }),
  setTextSize: (textSize) => set({ textSize: Math.min(24, Math.max(12, textSize)) }),
  setDefaultPersonaId: (defaultPersonaId) => set({ defaultPersonaId }),
  toggleSection: (name) => set((state) => ({ collapsedSections: {
    ...state.collapsedSections, [name]: !state.collapsedSections[name],
  } })),
  setVisibleMetrics: (visibleMetrics) => set({ visibleMetrics }),
  setKeybinding: (action, shortcut) => set((state) => ({ keybindings: { ...state.keybindings, [action]: shortcut } })),
  resetKeybindings: () => set({ keybindings: { ...DEFAULT_KEYBINDINGS } }),
}), { name: 'zaylo-workspace-preferences', version: 1 }));
