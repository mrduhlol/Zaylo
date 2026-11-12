import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../apps/desktop/src/stores/useAppStore';
import { api } from '../apps/desktop/src/api/client';

const chat = (id: string, modelId: string, modelName = modelId) => ({
  id, modelId, modelName, title: id, messages: [], createdAt: 1, updatedAt: 1,
});

describe('conversation model restoration', () => {
  beforeEach(() => {
    useAppStore.setState({
      conversations: [chat('text', 'text-install'), chat('image', 'sd-model'), chat('legacy', '', '')],
      activeConvId: 'image', selectedModel: 'Stable Diffusion', installedModels: [],
      serverInstance: { modelName: 'Running text model' } as any,
    });
  });

  it('restores text and image conversations without changing the running model', () => {
    const invoke = vi.spyOn(api, 'invoke');
    const runtime = useAppStore.getState().serverInstance;
    useAppStore.getState().selectChat('text');
    expect(useAppStore.getState()).toMatchObject({ activeConvId: 'text', selectedModel: 'text-install', activeTab: 'playground' });
    useAppStore.getState().selectChat('image');
    expect(useAppStore.getState().selectedModel).toBe('sd-model');
    expect(useAppStore.getState().serverInstance).toBe(runtime);
    expect(invoke).not.toHaveBeenCalled();
    invoke.mockRestore();
  });

  it('restores legacy chats to the running text model', () => {
    useAppStore.getState().selectChat('legacy');
    expect(useAppStore.getState().selectedModel).toBe('Running text model');
  });

  it('clears stale image selection when no conversation or runtime model is available', () => {
    useAppStore.setState({ serverInstance: undefined });
    useAppStore.getState().selectChat('legacy');
    expect(useAppStore.getState().selectedModel).toBe('');
  });

  it('ignores stale conversation IDs and preserves explicit model selection', () => {
    useAppStore.getState().selectChat('missing');
    expect(useAppStore.getState().selectedModel).toBe('Stable Diffusion');
    useAppStore.getState().setSelectedModel('Explicit model');
    expect(useAppStore.getState().selectedModel).toBe('Explicit model');
  });
});
