import React, { useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { useAppStore } from './stores/useAppStore';

import { api } from './api/client';
import { watchWorkspacePreferences } from './theme';
import { useWorkspacePreferences } from './stores/useWorkspacePreferences';
import { OverviewView } from './features/overview/OverviewView';
import { ModelsView } from './features/models/ModelsView';
import { ForgeView } from './features/forge/ForgeView';
import { PlaygroundView } from './features/playground/PlaygroundView';
import { PersonasView } from './features/personas/PersonasView';
import { LoftyDbView } from './features/loftydb/LoftyDbView';
import { ServerApiView } from './features/server-api/ServerApiView';
import { DevicesView } from './features/devices/DevicesView';
import { PerformanceView } from './features/performance/PerformanceView';
import { LogsView } from './features/logs/LogsView';
import { BenchmarkView } from './features/benchmark/BenchmarkView';
import { SettingsView } from './features/settings/SettingsView';
import { OnboardingWizard } from './features/onboarding/OnboardingWizard';
import type { SystemMetricSample, StructuredLog } from '@local-ai/shared';

export const App: React.FC = () => {
  const {
    activeTab,
    theme,
    fetchHardware,
    fetchServerState,
    fetchModels,
    fetchLogs,
    fetchDevicesAndKeys,
    fetchLoftyDbState,
    fetchMemories,
    setLoftyDbStatus,
    appendLoftyDbLog,
    updateMetric,
    addLog,
  } = useAppStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  // Appearance preferences: theme family, translucency, motion and text size.
  // Attribute/variable-driven; no component re-render beyond this effect.
  useEffect(() => watchWorkspacePreferences(useWorkspacePreferences), []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      const state = useAppStore.getState();
      if (state.themePreference === 'system') {
        state.setTheme(e.matches ? 'dark' : 'light');
      }
    };
    media.addEventListener('change', handleMediaChange);
    return () => media.removeEventListener('change', handleMediaChange);
  }, []);

  useEffect(() => {
    // Initial data fetch
    fetchHardware();
    fetchServerState();
    fetchModels();
    fetchLogs();
    fetchDevicesAndKeys();
    fetchLoftyDbState();

    // Subscribe to typed IPC events
    const unsubLoftyStatus = api.on('loftydb:status-changed', (status) => {
      setLoftyDbStatus(status);
    });
    const unsubLoftyLog = api.on('loftydb:log', (line) => {
      appendLoftyDbLog(line);
    });
    const unsubMemoryUpdated = api.on('memory:updated', () => {
      void fetchMemories();
    });
    const unsubMetrics = api.on('metrics:update', (sample: SystemMetricSample) => {
      updateMetric(sample);
    });

    const unsubLogs = api.on('logs:new', (log: StructuredLog) => {
      addLog(log);
    });

    const unsubState = api.on('server:state-changed', () => {
      fetchServerState();
      fetchModels();
    });

    const unsubDownloads = api.on('download:progress', (progress: any) => {
      if (progress?.status === 'cancelled' || progress?.status === 'failed') {
        useAppStore.getState().removeDownload(progress.id);
      } else if (progress?.status === 'completed') {
        useAppStore.getState().removeDownload(progress.id);
        fetchModels();
      } else if (progress) {
        useAppStore.getState().setDownloadProgress(progress);
      }
    });

    const unsubModelsUpdated = api.on('models:updated', () => {
      fetchModels();
    });

    const unsubForgeStatus = api.on('forge:training-status', (event: any) => {
      if (event?.status === 'COMPLETED') {
        fetchModels();
      }
    });

    const unsubImageProgress = api.on('image:progress', (event: any) => {
      useAppStore.getState().setImageProgress(event.progress);
    });

    const unsubImageStatus = api.on('image:status', (event: any) => {
      if (event.status === 'CANCELLED' || event.status === 'FAILED') {
        useAppStore.getState().setIsGeneratingImage(false);
        useAppStore.getState().setImageProgress(undefined);
      } else if (event.message) {
        const cur = useAppStore.getState().imageProgress;
        useAppStore.getState().setImageProgress({
          step: cur?.step || 0,
          totalSteps: cur?.totalSteps || 20,
          percentage: cur?.percentage || 0,
          elapsedSeconds: cur?.elapsedSeconds || 0,
          statusMessage: event.message,
        });
      }
    });

    const unsubImageCompleted = api.on('image:completed', () => {
      useAppStore.getState().setIsGeneratingImage(false);
      useAppStore.getState().setImageProgress(undefined);
      useAppStore.getState().fetchImageHistory();
    });

    const unsubImageError = api.on('image:error', (event: any) => {
      useAppStore.getState().setIsGeneratingImage(false);
      useAppStore.getState().setImageProgress(undefined);
      console.error('Image generation error:', event.error);
    });

    useAppStore.getState().fetchImageHistory();

    return () => {
      unsubLoftyStatus?.();
      unsubLoftyLog?.();
      unsubMemoryUpdated?.();
      unsubMetrics?.();
      unsubLogs?.();
      unsubState?.();
      unsubDownloads?.();
      unsubModelsUpdated?.();
      unsubForgeStatus?.();
      unsubImageProgress?.();
      unsubImageStatus?.();
      unsubImageCompleted?.();
      unsubImageError?.();
    };
  }, []);

  return (
    <div data-theme={theme} className="app-root flex h-screen w-screen bg-white dark:bg-[#090909] text-[#111111] dark:text-[#f5f5f5] overflow-hidden select-none font-sans">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#090909]">
        {activeTab !== 'playground' && <Header />}

        <main className="flex-1 overflow-hidden bg-white dark:bg-[#090909]">
          {activeTab === 'overview' && <OverviewView />}
          {activeTab === 'models' && <ModelsView />}
          {activeTab === 'forge' && <ForgeView />}
          {activeTab === 'playground' && <PlaygroundView />}
          {activeTab === 'personas' && <PersonasView />}
          {activeTab === 'loftydb' && <LoftyDbView />}
          {activeTab === 'server' && <ServerApiView />}
          {activeTab === 'devices' && <DevicesView />}
          {activeTab === 'performance' && <PerformanceView />}
          {activeTab === 'logs' && <LogsView />}
          {activeTab === 'benchmark' && <BenchmarkView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Guided First-Launch Onboarding Wizard */}
      <OnboardingWizard />
    </div>
  );
};
