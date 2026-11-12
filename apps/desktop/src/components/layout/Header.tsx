import { collapsedTitlebarInsets } from './titlebar';
import { useWorkspacePreferences } from '../../stores/useWorkspacePreferences';
import { SystemStatusPopover } from './SystemStatusPopover';
import React, { useState } from 'react';
import { Play, Square, RefreshCw, Copy, Check, Sun, Moon } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const Header: React.FC = () => {
  const builderMode = useWorkspacePreferences(state => state.builderMode);
  const {
    isSidebarCollapsed,
    activeTab,
    selectedModel,
    theme,
    toggleTheme,
    serverState,
    serverInstance,
    serverConfig,
    lanAddress,
    startServer,
    stopServer,
    restartServer,
  } = useAppStore();

  const [copied, setCopied] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  const endpointUrl = `http://${serverConfig?.lanEnabled && lanAddress ? lanAddress : '127.0.0.1'}:${serverConfig?.port || 8080}/v1`;

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText(endpointUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleServer = async () => {
    setLoadingAction(true);
    try {
      if (serverState === 'RUNNING') {
        await stopServer();
      } else {
        await startServer();
      }
    } catch (err: any) {
      alert(`Server action failed: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRestart = async () => {
    setLoadingAction(true);
    try {
      await restartServer();
    } catch (err: any) {
      alert(`Restart failed: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <header style={{ paddingLeft: isSidebarCollapsed ? collapsedTitlebarInsets().contentLeft : undefined }} className="zaylo-titlebar relative z-20 h-16 border-b border-[#eaeaea] dark:border-[#262626] bg-white dark:bg-[#090909] px-8 flex items-center justify-between select-none">
      {/* Title & Active Model */}
      <div className="flex items-center gap-4">
        {activeTab === 'overview' ? (
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-sm font-semibold tracking-tight text-[#111111] dark:text-[#F5F5F5]">Overview</h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono border ${
                  serverState === 'RUNNING'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : serverState === 'STARTING'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : 'bg-zinc-100 dark:bg-[#141414] text-zinc-500 dark:text-[#A1A1AA] border-zinc-200 dark:border-[#262626]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    serverState === 'RUNNING'
                      ? 'bg-emerald-500'
                      : serverState === 'STARTING'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-zinc-400'
                  }`}
                />
                {serverState === 'RUNNING' ? 'Running' : serverState === 'STARTING' ? 'Starting' : 'Stopped'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-[#A1A1AA] font-normal leading-none mt-1">
              Your local AI environment at a glance.
            </p>
          </div>
        ) : activeTab === 'personas' ? (
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-[#111111] dark:text-[#F5F5F5]">Personas</h1>
            <p className="text-[11px] text-zinc-500 dark:text-[#A1A1AA] font-normal leading-none mt-1">
              One AI engine. Multiple personalities.
            </p>
          </div>
        ) : activeTab === 'loftydb' ? (
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-[#111111] dark:text-[#F5F5F5]">LoftyDB</h1>
            <p className="text-[11px] text-zinc-500 dark:text-[#A1A1AA] font-normal leading-none mt-1">
              Temporal, reactive &amp; vector database powering Zaylo long-term memory.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-sm font-semibold capitalize tracking-wide text-[#111111] dark:text-[#F5F5F5]">{activeTab}</h1>
            {builderMode && activeTab === 'playground' && selectedModel ? (
              <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-50 dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-xs font-mono text-zinc-700 dark:text-[#A1A1AA]">
                <span className="text-zinc-400">Active:</span>
                <span className="text-[#111111] dark:text-[#F5F5F5] font-medium">{selectedModel}</span>
              </div>
            ) : builderMode && serverInstance?.modelName ? (
              <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-50 dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-xs font-mono text-zinc-700 dark:text-[#A1A1AA]">
                <span className="text-zinc-400">Loaded:</span>
                <span className="text-[#111111] dark:text-[#F5F5F5] font-medium">{serverInstance.modelName}</span>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <SystemStatusPopover />
        {/* Copy endpoint button */}
        {builderMode && serverState === 'RUNNING' && (
          <button
            onClick={handleCopyEndpoint}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#141414] hover:bg-zinc-50 dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-xs font-mono text-zinc-700 dark:text-[#A1A1AA] transition-colors"
            title="Copy OpenAI Base URL"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
            <span>{endpointUrl}</span>
          </button>
        )}

        {/* Server Start / Stop */}
        {builderMode && <button
          onClick={handleToggleServer}
          disabled={loadingAction || serverState === 'STARTING' || serverState === 'STOPPING'}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            serverState === 'RUNNING'
              ? 'bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50'
              : 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
          } disabled:opacity-50`}
        >
          {serverState === 'RUNNING' ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Server</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Server</span>
            </>
          )}
        </button>}

        {/* Restart Button */}
        {builderMode && serverState === 'RUNNING' && (
          <button
            onClick={handleRestart}
            disabled={loadingAction}
            className="p-1.5 rounded-lg bg-white dark:bg-[#141414] hover:bg-zinc-50 dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-zinc-500 hover:text-zinc-800 dark:hover:text-[#F5F5F5] transition-colors"
            title="Restart Inference Engine"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAction ? 'animate-spin' : ''}`} />
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg bg-white dark:bg-[#141414] hover:bg-zinc-50 dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-zinc-500 hover:text-zinc-800 dark:hover:text-[#F5F5F5] transition-colors flex items-center justify-center"
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-zinc-700" />
          )}
        </button>
      </div>
    </header>
  );
};
