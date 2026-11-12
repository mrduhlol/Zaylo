import React, { useState, useRef, useEffect } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { useWorkspacePreferences } from '../../../stores/useWorkspacePreferences';
import {
  Box,
  Columns2,
  Clock,
  MoreHorizontal,
  Sliders,
  Activity,
  Trash2,
  Power,
  Sun,
  Moon,
} from 'lucide-react';
import type { UnifiedModelOption } from '../types';
import type { ServerState, Persona } from '@local-ai/shared';
import { PlaygroundPersonaSelector } from '../../personas/components/PlaygroundPersonaSelector';
import { useAppStore } from '../../../stores/useAppStore';
import { SystemStatusPopover } from '../../../components/layout/SystemStatusPopover';

interface PlaygroundToolbarProps {
  models: UnifiedModelOption[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
  serverState: ServerState;
  isLoadingModel: boolean;
  isGeneratingImage?: boolean;
  onNewChat: () => void;
  onToggleHistory: () => void;
  onTogglePerformance: () => void;
  onToggleSettings: () => void;
  onToggleCompare: () => void;
  isHistoryOpen: boolean;
  isPerformanceOpen: boolean;
  isSettingsOpen: boolean;
  isCompareMode: boolean;
  conversationCount: number;
  activePersona?: Persona;
  personas?: Persona[];
  onSelectPersona?: (personaId: string) => void;
  onOpenPersonaManagement?: () => void;
  onCreatePersona?: () => void;
  onClearConversation?: () => void;
}

export const PlaygroundToolbar: React.FC<PlaygroundToolbarProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  serverState,
  isLoadingModel,
  onToggleHistory,
  onTogglePerformance,
  onToggleSettings,
  onToggleCompare,
  isCompareMode,
  activePersona,
  personas,
  onSelectPersona,
  onOpenPersonaManagement,
  onCreatePersona,
  onClearConversation,
}) => {
  const builderMode = useWorkspacePreferences((state) => state.builderMode);
  const { theme, toggleTheme, startServer, stopServer, setActiveTab } = useAppStore();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const selectedModel = models.find((m) => m.id === selectedModelId);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {

      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setIsMoreMenuOpen(false); moreMenuRef.current?.querySelector('button')?.focus(); }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('keydown', handleEscape); };
  }, []);

  return (
    <div className="min-h-16 px-3 sm:px-6 py-3 gap-2 border-b border-[var(--border)] bg-[var(--background)] flex items-center justify-between select-none shrink-0 z-20">
      {/* Left Controls: Model Pill & Persona Pill */}
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        {/* Model Selector Pill */}
        <div className="relative inline-block" ref={modelDropdownRef}>
          <Select.Root value={selectedModel?.id || ''} onValueChange={onSelectModel} disabled={isLoadingModel || models.length === 0}>
            <Select.Trigger aria-label="AI model" className="flex max-w-[160px] sm:max-w-[260px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--theme-accent)] disabled:opacity-60">
              <Box className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
              <span className="truncate"><Select.Value placeholder={models.length ? 'Select model' : 'No models installed'} /></span>
              <Select.Icon><ChevronDown className="h-3.5 w-3.5" /></Select.Icon>
            </Select.Trigger>
            <Select.Portal><Select.Content position="popper" sideOffset={6} collisionPadding={12} className="z-50 max-h-[var(--radix-select-content-available-height)] max-w-[calc(100vw-24px)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--popover)] p-1 text-xs text-[var(--popover-foreground)] shadow-lg">
              <Select.Viewport className="max-h-72 overflow-y-auto">{models.map(model => <Select.Item key={model.id} value={model.id} className="relative cursor-default rounded-lg py-2 pl-8 pr-4 outline-none data-[highlighted]:bg-[var(--accent)]">
                <Select.ItemIndicator className="absolute left-2 top-2"><Check className="h-4 w-4" /></Select.ItemIndicator>
                <Select.ItemText>{model.name}</Select.ItemText>
              </Select.Item>)}</Select.Viewport>
            </Select.Content></Select.Portal>
          </Select.Root>
          {models.length === 0 && <button type="button" onClick={() => setActiveTab('models')} className="mt-1 text-xs text-[var(--muted-foreground)] underline underline-offset-4 hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-[var(--theme-accent)]">Browse models</button>}
        </div>

        {/* Persona Selector Pill */}
        {!selectedModel?.isImageModel && activePersona && personas && onSelectPersona && (
          <PlaygroundPersonaSelector
            activePersona={activePersona}
            personas={personas}
            onSelectPersona={onSelectPersona}
            onOpenManagement={onOpenPersonaManagement || (() => {})}
            onCreatePersona={onCreatePersona || (() => {})}
          />
        )}
      </div>

      {/* Right Controls: Compare, History, More */}
      <div className="flex items-center gap-1.5">
        <SystemStatusPopover />
        {/* Compare Control */}
        {builderMode && <button
          onClick={onToggleCompare}
          className={`p-2 rounded-xl border transition-colors ${
            isCompareMode
              ? 'bg-zinc-100 dark:bg-[#202020] border-zinc-300 dark:border-[#262626] text-zinc-900 dark:text-[#F5F5F5]'
              : 'bg-[var(--card)] hover:bg-[var(--accent)] border-[var(--border)] text-[var(--muted-foreground)] shadow-xs'
          }`}
          title="Compare Models side-by-side"
        >
          <Columns2 className="w-4 h-4" />
        </button>}

        {/* History Control */}
        <button
          onClick={onToggleHistory}
          className="p-2 rounded-xl bg-[var(--card)] hover:bg-[var(--accent)] border border-[var(--border)] text-[var(--muted-foreground)] shadow-xs transition-colors"
          title="Conversation History"
        >
          <Clock className="w-4 h-4" />
        </button>

        {/* More Options Menu */}
        <div className="relative inline-block" ref={moreMenuRef}>
          <button
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className="p-2 rounded-xl bg-[var(--card)] hover:bg-[var(--accent)] border border-[var(--border)] text-[var(--muted-foreground)] shadow-xs transition-colors"
            aria-label="More options" aria-expanded={isMoreMenuOpen}
            title="More Options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMoreMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-56 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl py-1.5 z-50 text-xs select-none animate-in fade-in zoom-in-95 duration-100">
              {builderMode && <> <button
                onClick={() => {
                  onToggleSettings();
                  setIsMoreMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
              >
                <Sliders className="w-4 h-4 text-zinc-500 dark:text-[#737373]" />
                <span>Generation Parameters...</span>
              </button>

              <button
                onClick={() => {
                  onTogglePerformance();
                  setIsMoreMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
              >
                <Activity className="w-4 h-4 text-zinc-500 dark:text-[#737373]" />
                <span>Performance Monitor</span>
              </button></>}

              <button
                onClick={() => {
                  toggleTheme();
                  setIsMoreMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Switch to Light Theme</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-zinc-500" />
                    <span>Switch to Dark Theme</span>
                  </>
                )}
              </button>

              <div className="border-t border-[var(--border)] my-1" />

              {builderMode && <button
                onClick={() => {
                  if (serverState === 'RUNNING') {
                    stopServer();
                  } else {
                    startServer();
                  }
                  setIsMoreMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
              >
                <Power className={`w-4 h-4 ${serverState === 'RUNNING' ? 'text-rose-500' : 'text-emerald-500'}`} />
                <span>{serverState === 'RUNNING' ? 'Stop Local Engine' : 'Start Local Engine'}</span>
              </button>}

              {onClearConversation && (
                <button
                  onClick={() => {
                    onClearConversation();
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear Conversation</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
