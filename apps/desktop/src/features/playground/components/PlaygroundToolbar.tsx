import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  ChevronDown,
  Columns2,
  Clock,
  MoreHorizontal,
  Sliders,
  Activity,
  Trash2,
  Check,
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
  const { theme, toggleTheme, startServer, stopServer } = useAppStore();
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const selectedModel = models.find((m) => m.id === selectedModelId) || models[0];

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="h-[76px] px-6 border-b border-[#eaeaea] dark:border-[#262626] bg-white dark:bg-[#090909] flex items-center justify-between select-none shrink-0 z-20">
      {/* Left Controls: Model Pill & Persona Pill */}
      <div className="flex items-center gap-2.5">
        {/* Model Selector Pill */}
        <div className="relative inline-block" ref={modelDropdownRef}>
          <button
            type="button"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#141414] hover:bg-zinc-50 dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-xs font-medium text-[#111111] dark:text-[#F5F5F5] transition-colors shadow-xs"
            title="Select AI Model"
          >
            <Box className="w-3.5 h-3.5 text-zinc-600 dark:text-[#A1A1AA] shrink-0" />
            <span className="truncate max-w-[140px] sm:max-w-[180px] font-sans">
              {isLoadingModel ? 'Loading...' : selectedModel?.name || 'Select Model'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 dark:text-[#737373] transition-transform duration-150 shrink-0 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Model Dropdown Popup */}
          {isModelDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-72 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] shadow-xl py-1.5 z-50 text-xs overflow-hidden select-none animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 border-b border-[#eaeaea] dark:border-[#222222] flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500 dark:text-[#737373] uppercase tracking-wider">
                  Available Models
                </span>
                <span className="text-[10px] font-mono text-zinc-400 dark:text-[#A1A1AA]">
                  {models.length} installed
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto py-1 scrollbar-thin">
                {models.map((m) => {
                  const isSelected = m.id === selectedModelId;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        onSelectModel(m.id);
                        setIsModelDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-zinc-100 dark:bg-[#202020] text-zinc-900 dark:text-[#F5F5F5] font-medium'
                          : 'text-zinc-700 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#202020]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Box className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-zinc-900 dark:text-[#F5F5F5]' : 'text-zinc-400 dark:text-[#737373]'}`} />
                        <div className="truncate">
                          <span className="truncate block leading-tight">{m.name}</span>
                          <span className="text-[10px] text-zinc-400 dark:text-[#737373] font-mono leading-none">
                            {m.type === 'adapter' ? 'LoRA Adapter' : m.taskType || 'Text'}
                          </span>
                        </div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-black dark:text-white shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
        <button
          onClick={onToggleCompare}
          className={`p-2 rounded-xl border transition-colors ${
            isCompareMode
              ? 'bg-zinc-100 dark:bg-[#202020] border-zinc-300 dark:border-[#262626] text-zinc-900 dark:text-[#F5F5F5]'
              : 'bg-white dark:bg-[#141414] hover:bg-zinc-50 dark:hover:bg-[#202020] border-[#eaeaea] dark:border-[#262626] text-zinc-600 dark:text-[#A1A1AA] shadow-xs'
          }`}
          title="Compare Models side-by-side"
        >
          <Columns2 className="w-4 h-4" />
        </button>

        {/* History Control */}
        <button
          onClick={onToggleHistory}
          className="p-2 rounded-xl bg-white dark:bg-[#141414] hover:bg-zinc-50 dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-zinc-600 dark:text-[#A1A1AA] shadow-xs transition-colors"
          title="Conversation History"
        >
          <Clock className="w-4 h-4" />
        </button>

        {/* More Options Menu */}
        <div className="relative inline-block" ref={moreMenuRef}>
          <button
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className="p-2 rounded-xl bg-white dark:bg-[#141414] hover:bg-zinc-50 dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-zinc-600 dark:text-[#A1A1AA] shadow-xs transition-colors"
            title="More Options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMoreMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-56 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] shadow-xl py-1.5 z-50 text-xs select-none animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  onToggleSettings();
                  setIsMoreMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-700 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-[#F5F5F5] transition-colors"
              >
                <Sliders className="w-4 h-4 text-zinc-500 dark:text-[#737373]" />
                <span>Generation Parameters...</span>
              </button>

              <button
                onClick={() => {
                  onTogglePerformance();
                  setIsMoreMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-700 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-[#F5F5F5] transition-colors"
              >
                <Activity className="w-4 h-4 text-zinc-500 dark:text-[#737373]" />
                <span>Performance Monitor</span>
              </button>

              <button
                onClick={() => {
                  toggleTheme();
                  setIsMoreMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-700 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-[#F5F5F5] transition-colors"
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

              <div className="border-t border-[#eaeaea] dark:border-[#222222] my-1" />

              <button
                onClick={() => {
                  if (serverState === 'RUNNING') {
                    stopServer();
                  } else {
                    startServer();
                  }
                  setIsMoreMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-700 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-[#F5F5F5] transition-colors"
              >
                <Power className={`w-4 h-4 ${serverState === 'RUNNING' ? 'text-rose-500' : 'text-emerald-500'}`} />
                <span>{serverState === 'RUNNING' ? 'Stop Local Engine' : 'Start Local Engine'}</span>
              </button>

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
