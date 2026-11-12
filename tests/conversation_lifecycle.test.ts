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
    expect(branchThrough(original, -1).messages).toEqual([]);
    expect(original.messages).toHaveLength(2);
    expect(() => branchThrough(original, -2)).toThrow();
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
    expect(useAppStore.getState().deletedChats.some(chat => chat.id === id)).toBe(false);
    expect(useAppStore.getState().undoAction?.chat.id).not.toBe(id);
    useAppStore.getState().undoChatAction();
    expect(useAppStore.getState().conversations.some(chat => chat.id === id)).toBe(false);
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
    const { useWorkspacePreferences } = await import('../apps/desktop/src/stores/useWorkspacePreferences');
    useWorkspacePreferences.getState().setStartupBehavior('continue');
    vi.resetModules();
    const reloaded = await import('../apps/desktop/src/stores/useAppStore');
    expect(reloaded.useAppStore.getState().activeConvId).toBe(id);
  });

  it.each([false, true])('opens an empty chat on startup instead of the previous active chat (existing empty: %s)', async (hasEmpty) => {
    vi.resetModules();
    const existing = chat({ id: 'previous' });
    const empty = chat({ id: 'empty', messages: [{ role: 'assistant', content: 'Welcome' }] });
    storage.set('zaylo_playground_conversations_v3', JSON.stringify(hasEmpty ? [existing, empty] : [existing]));
    storage.set('zaylo_active_conversation', JSON.stringify(existing.id));
    const { useAppStore } = await import('../apps/desktop/src/stores/useAppStore');
    const state = useAppStore.getState();
    expect(state.activeConvId).not.toBe(existing.id);
    const active = state.conversations.find(item => item.id === state.activeConvId)!;
    expect(active.messages.some(message => message.role === 'user')).toBe(false);
    expect(active.temporary).not.toBe(true);
    expect(active.archivedAt).toBeUndefined();
    expect(state.conversations).toHaveLength(2);
    if (hasEmpty) expect(state.activeConvId).toBe(empty.id);
  });

  it('keeps deletion during an in-flight sync hidden, and retains a tombstone after permanent deletion', async () => {
    vi.resetModules();
    let resolveSync!: (value: PlaygroundConversation[]) => void;
    const calls = vi.fn(async (channel: string) => channel === 'memory:sync-conversations' ? new Promise<PlaygroundConversation[]>(resolve => { resolveSync = resolve; }) : true);
    vi.stubGlobal('window', { localStorage, electronAPI: { invoke: calls } });
    const { useAppStore } = await import('../apps/desktop/src/stores/useAppStore');
    const store = () => useAppStore.getState();
    store().setConversations([chat()]);
    useAppStore.setState({ loftyDbStatus: { connected: true } as any });
    const syncing = store().syncConversationsWithLoftyDb();
    store().deleteChat('chat-a');
    resolveSync([chat()]);
    await syncing;
    expect(store().conversations.some(item => item.id === 'chat-a')).toBe(false);
    expect(calls).not.toHaveBeenCalledWith('memory:delete-conversation', expect.anything());
    await store().permanentlyDeleteChat('chat-a');
    expect(calls).toHaveBeenCalledWith('memory:delete-conversation', { id: 'chat-a' });
    expect(JSON.parse(storage.get('zaylo_deleted_ids')!)).toContain('chat-a');
    expect(store().deletedChats).toEqual([]);
    expect(store().undoAction).toBeUndefined();
    const nextSync = store().syncConversationsWithLoftyDb();
    resolveSync([chat()]);
    await nextSync;
    expect(store().conversations.some(item => item.id === 'chat-a')).toBe(false);
  });

  it('never selects an archived chat on reload or through selection', async () => {
    vi.resetModules();
    storage.set('zaylo_playground_conversations_v3', JSON.stringify([chat({ archivedAt: 5, messages: [] })]));
    storage.set('zaylo_active_conversation', JSON.stringify('chat-a'));
    const { useAppStore } = await import('../apps/desktop/src/stores/useAppStore');
    const state = useAppStore.getState();
    expect(state.activeConvId).not.toBe('chat-a');
    expect(state.conversations[0].archivedAt).toBeUndefined();
    state.selectChat('chat-a');
    expect(useAppStore.getState().activeConvId).toBe(state.activeConvId);
  });

  it('persists real project document references and instructions across reload', async () => {
    vi.resetModules();
    const { useProjects } = await import('../apps/desktop/src/features/projects/useProjects');
    const id = useProjects.getState().createProject('Research');
    useProjects.getState().updateProject(id, { instructions: 'Cite attached evidence.', documentIds: ['uploaded-document'] });
    vi.resetModules();
    const reloaded = await import('../apps/desktop/src/features/projects/useProjects');
    expect(reloaded.useProjects.getState().projects).toEqual([expect.objectContaining({ id, name: 'Research', instructions: 'Cite attached evidence.', documentIds: ['uploaded-document'] })]);
    reloaded.useProjects.getState().deleteProject(id);
    expect(reloaded.useProjects.getState().projects).toEqual([]);
  });

  it('keeps an older request in its own project after switching chats, and isolates persona previews', async () => {
    vi.resetModules();
    const calls = vi.fn(async () => ({}));
    vi.stubGlobal('window', { localStorage, electronAPI: { invoke: calls } });
    const { useProjects } = await import('../apps/desktop/src/features/projects/useProjects');
    const first = useProjects.getState().createProject('First');
    const second = useProjects.getState().createProject('Second');
    useProjects.getState().updateProject(first, { instructions: 'Use FIRST project context.', documentIds: ['first-doc'] });
    useProjects.getState().updateProject(second, { instructions: 'Use SECOND project context.', documentIds: ['second-doc'] });
    const { useAppStore } = await import('../apps/desktop/src/stores/useAppStore');
    useAppStore.getState().setConversations([chat({ projectId: first }), chat({ id: 'chat-b', projectId: second })]);
    useAppStore.getState().selectChat('chat-b');
    const { api } = await import('../apps/desktop/src/api/client');
    await api.invoke('inference:chat', { model: 'local', messages: [{ role: 'user', content: 'Request from the first chat' }], conversationId: 'chat-a', memory: false, memorySave: false });
    expect(calls).toHaveBeenLastCalledWith('inference:chat', expect.objectContaining({
      messages: expect.arrayContaining([{ role: 'system', content: 'Use FIRST project context.' }]), ragDocumentIds: ['first-doc'],
    }));
    const previewMessages = [{ role: 'user' as const, content: 'Test this persona' }];
    await api.invoke('inference:chat', { model: 'local', messages: previewMessages, memory: false, memorySave: false });
    expect(calls).toHaveBeenLastCalledWith('inference:chat', expect.objectContaining({ messages: previewMessages }));
    expect(calls.mock.calls.at(-1)?.[1]).not.toHaveProperty('ragDocumentIds');
  });

});
