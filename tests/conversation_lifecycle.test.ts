import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchThrough, canRecallMemory, canSaveMemory, installConversationPrivacy, mergeHistory, savedHistory } from '../apps/desktop/src/features/conversations/lifecycle';
import type { PlaygroundConversation } from '../apps/desktop/src/features/playground/types';
import type { AppAPI } from '../apps/desktop/src/api/client';

vi.mock('@local-ai/inference', () => ({
  PersonaManager: class {
    getAllPersonas() { return [{ id: 'general' }]; }
    getActivePersona() { return { id: 'general' }; }
    getDefaultPersona() { return { id: 'general' }; }
  },
  PersonaResolver: { resolve: () => ({ id: 'general' }) },
  PersonaPromptAdapter: {},
}));
const chat = (patch: Partial<PlaygroundConversation> = {}): PlaygroundConversation => ({
  id: 'chat-a', title: 'Original', modelId: 'model', modelName: 'Model',
  messages: [{ role: 'user', content: 'private question' }, { role: 'assistant', content: 'answer' }],
  createdAt: 1, updatedAt: 1, ...patch,
});
const storage = new Map<string, string>();
const localStorage = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) };

beforeEach(() => { storage.clear(); vi.stubGlobal('localStorage', localStorage); vi.stubGlobal('window', { localStorage }); });

describe('conversation privacy boundary', () => {
  it('excludes temporary chats from disk, all conversation saves, manual memory, recall and automatic extraction', async () => {
    const temporary = chat({ temporary: true });
    expect(savedHistory([temporary])).toEqual([]);
    expect(canSaveMemory(temporary)).toBe(false);
    expect(canRecallMemory(temporary)).toBe(false);
    const invoke = vi.fn(async () => []);
    const client = { invoke, on: vi.fn() } as unknown as AppAPI;
    installConversationPrivacy(client, () => ({ conversations: [temporary], activeConvId: temporary.id, blocked: [] }));
    await client.invoke('memory:save-conversation', temporary);
    await expect(client.invoke('memory:save', { content: 'secret', conversationId: temporary.id })).rejects.toThrow('disabled');
    expect(await client.invoke('memory:recall', { query: 'secret', conversationId: temporary.id })).toEqual([]);
    await client.invoke('inference:chat', { model: 'model', messages: temporary.messages, memory: true, conversationId: temporary.id });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]).toEqual(['inference:chat', expect.objectContaining({ memory: false })]);
  });

  it('recalls without automatic extraction when saving is disabled', async () => {
    const current = chat({ memorySaveEnabled: false });
    const invoke = vi.fn(async (channel: string) => channel === 'memory:recall' ? [{ memory: { content: 'relevant context' } }] : {});
    const client = { invoke, on: vi.fn() } as unknown as AppAPI;
    installConversationPrivacy(client, () => ({ conversations: [current], activeConvId: current.id, blocked: [] }));
    await client.invoke('inference:chat', { model: 'model', messages: current.messages, memory: true, conversationId: current.id });
    expect(invoke).toHaveBeenCalledWith('memory:recall', expect.objectContaining({ query: 'private question' }));
    expect(invoke).toHaveBeenCalledWith('inference:chat', expect.objectContaining({ memory: false, messages: expect.arrayContaining([expect.objectContaining({ role: 'system', content: expect.stringContaining('relevant context') })]) }));
  });

  it('filters archived, temporary and deleted results from backend history search', async () => {
    const archived = chat({ archivedAt: 2 });
    const invoke = vi.fn(async () => [chat(), chat({ id: 'deleted' }), chat({ id: 'temp' })]);
    const client = { invoke, on: vi.fn() } as unknown as AppAPI;
    installConversationPrivacy(client, () => ({ conversations: [archived, chat({ id: 'temp', temporary: true })], activeConvId: archived.id, blocked: ['deleted'] }));
    expect(await client.invoke('memory:search-conversations', { query: 'question' })).toEqual([]);
  });

  it('injects real project context and document IDs without changing source messages', async () => {
    const current = chat({ projectId: 'project' });
    const invoke = vi.fn(async () => ({}));
    const client = { invoke, on: vi.fn() } as unknown as AppAPI;
    installConversationPrivacy(client, () => ({ conversations: [current], activeConvId: current.id, blocked: [], instructions: 'Use concise answers.', documentIds: ['doc'] }));
    await client.invoke('inference:chat', { model: 'model', messages: current.messages, conversationId: current.id });
    expect(invoke).toHaveBeenCalledWith('inference:chat', expect.objectContaining({ rag: true, ragDocumentIds: ['doc'], messages: expect.arrayContaining([{ role: 'system', content: 'Use concise answers.' }]) }));
    expect(current.messages).toHaveLength(2);
  });
});

describe('conversation state and recovery', () => {
  it('branches through the selected message, deep clones attachments and preserves ancestry/privacy/project', () => {
    const original = chat({ temporary: true, memoryEnabled: false, projectId: 'p', messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }, { role: 'assistant', content: 'reply' }] });
    const branch = branchThrough(original, 0);
    expect(branch).toMatchObject({ parentConversationId: original.id, temporary: true, memoryEnabled: false, projectId: 'p' });
    expect(branch.id).not.toBe(original.id);
    expect(branch.messages).toHaveLength(1);
    expect(branch.messages[0].content).not.toBe(original.messages[0].content);
    expect(() => branchThrough(original, 5)).toThrow();
  });

  it('preserves local archive/privacy metadata and never resurrects deleted IDs', () => {
    const local = chat({ archivedAt: 5, memorySaveEnabled: false });
    expect(mergeHistory([local], [chat({ updatedAt: 99 }), chat({ id: 'deleted' })], ['deleted'])).toEqual([local]);
  });

  it('keeps temporary creation, rename, generic setters and delete off disk and backend memory', async () => {
    vi.resetModules();
    const calls = vi.fn(async () => []);
    vi.stubGlobal('window', { localStorage, electronAPI: { invoke: calls } });
    const { useAppStore } = await import('../apps/desktop/src/stores/useAppStore');
    useAppStore.setState({ loftyDbStatus: { connected: true } as any });
    const id = useAppStore.getState().createNewChat({ temporary: true });
    useAppStore.getState().renameChat(id, 'Secret title');
    useAppStore.getState().setConversations(prev => prev.map(item => item.id === id ? { ...item, messages: chat().messages } : item));
    await useAppStore.getState().persistConversationToLoftyDb(useAppStore.getState().conversations.find(item => item.id === id)!);
    useAppStore.getState().deleteChat(id);
    expect(JSON.stringify([...storage.values()])).not.toContain('Secret title');
    expect((calls.mock.calls as any[]).some(([channel, payload]) => channel === 'memory:save-conversation' && payload?.id === id)).toBe(false);
    expect(calls.mock.calls.some(([channel]) => channel === 'memory:delete-conversation')).toBe(false);
  });

  it('archives with undo, keeps delete recoverable, and persists the active chat for Continue', async () => {
    vi.resetModules();
    const calls = vi.fn(async () => []);
    vi.stubGlobal('window', { localStorage, electronAPI: { invoke: calls } });
    const { useAppStore } = await import('../apps/desktop/src/stores/useAppStore');
    const store = () => useAppStore.getState();
    const id = store().createNewChat();
    expect(JSON.parse(storage.get('zaylo_active_conversation')!)).toBe(id);
    store().archiveChat(id);
    expect(store().conversations.find(item => item.id === id)?.archivedAt).toBeTypeOf('number');
    expect(store().activeConvId).not.toBe(id);
    store().undoChatAction();
    expect(store().conversations.find(item => item.id === id)?.archivedAt).toBeUndefined();
    store().deleteChat(id);
    expect(store().deletedChats.some(item => item.id === id)).toBe(true);
    expect(calls).not.toHaveBeenCalledWith('memory:delete-conversation', expect.anything());
    store().restoreChat(id);
    expect(store().conversations.some(item => item.id === id)).toBe(true);
    store().createNewChat();
    store().selectChat(id);
    vi.resetModules();
    const reloaded = await import('../apps/desktop/src/stores/useAppStore');
    expect(reloaded.useAppStore.getState().activeConvId).toBe(id);
  });
});
