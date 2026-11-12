import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};
beforeEach(() => { vi.resetModules(); storage.clear(); vi.stubGlobal('localStorage', localStorage); vi.stubGlobal('window', { localStorage }); });
afterEach(() => vi.unstubAllGlobals());

describe('persona selection and new-chat defaults', () => {
  it('uses the configured default for a new chat instead of the last active persona', async () => {
    const { useAppStore } = await import('../apps/desktop/src/stores/useAppStore');
    const [first, second] = useAppStore.getState().personas;
    expect(second).toBeDefined();
    useAppStore.getState().setActivePersonaId(first.id);
    useAppStore.getState().setDefaultPersonaId(second.id);
    const id = useAppStore.getState().createNewChat();
    expect(useAppStore.getState().conversations.find(chat => chat.id === id)?.personaId).toBe(second.id);
    expect(useAppStore.getState().activePersonaId).toBe(second.id);
  });
  it('uses an explicit persona for one new chat without changing older chats or the saved default', async () => {
    const { useAppStore } = await import('../apps/desktop/src/stores/useAppStore');
    const [first, second] = useAppStore.getState().personas;
    useAppStore.getState().setDefaultPersonaId(second.id);
    const before = useAppStore.getState().conversations.map(chat => ({ id: chat.id, personaId: chat.personaId }));
    const id = useAppStore.getState().createNewChat({ personaId: first.id });
    expect(useAppStore.getState().conversations.find(chat => chat.id === id)?.personaId).toBe(first.id);
    for (const original of before) expect(useAppStore.getState().conversations.find(chat => chat.id === original.id)?.personaId).toBe(original.personaId);
    expect(useAppStore.getState().defaultPersonaId).toBe(second.id);
    const next = useAppStore.getState().createNewChat();
    expect(useAppStore.getState().conversations.find(chat => chat.id === next)?.personaId).toBe(second.id);
  });
  it('changes the active older chat without overwriting the first stored conversation', async () => {
    const { useAppStore } = await import('../apps/desktop/src/stores/useAppStore');
    const [first, second] = useAppStore.getState().personas;
    const chat = (id: string) => ({ id, title: id, modelId: '', modelName: '', personaId: first.id, messages: [], createdAt: 1, updatedAt: 1 });
    useAppStore.getState().setConversations([chat('newer'), chat('older')]);
    useAppStore.setState({ activeConvId: 'older' });
    useAppStore.getState().setActivePersonaId(second.id);
    const saved = JSON.parse(storage.get('zaylo_playground_conversations_v3')!);
    expect(saved.find((item: { id: string }) => item.id === 'newer').personaId).toBe(first.id);
    expect(saved.find((item: { id: string }) => item.id === 'older').personaId).toBe(second.id);
  });
  it('initializes a fresh installation/reload with the configured default greeting', async () => {
    const { useAppStore } = await import('../apps/desktop/src/stores/useAppStore');
    const persona = useAppStore.getState().personas.find(item => item.greetingMessage && item.id !== useAppStore.getState().defaultPersonaId)!;
    expect(persona).toBeDefined();
    useAppStore.getState().setDefaultPersonaId(persona.id);
    storage.delete('zaylo_playground_conversations_v3');
    storage.delete('zaylo_active_conversation');
    vi.resetModules();
    const reloaded = await import('../apps/desktop/src/stores/useAppStore');
    const state = reloaded.useAppStore.getState();
    const fresh = state.conversations.find(chat => chat.id === state.activeConvId)!;
    expect(fresh.personaId).toBe(persona.id);
    expect(fresh.messages).toEqual([{ role: 'assistant', content: persona.greetingMessage }]);
  });
  it('does not add a fresh chat on reload when Continue is selected', async () => {
    const { useAppStore } = await import('../apps/desktop/src/stores/useAppStore');
    const { useWorkspacePreferences } = await import('../apps/desktop/src/stores/useWorkspacePreferences');
    useWorkspacePreferences.getState().setStartupBehavior('continue');
    useAppStore.getState().setConversations([{ id: 'existing', title: 'Existing', modelId: '', modelName: '', messages: [{ role: 'user', content: 'Keep this conversation' }], createdAt: 1, updatedAt: 1 }]);
    useAppStore.getState().selectChat('existing');
    vi.resetModules();
    const reloaded = await import('../apps/desktop/src/stores/useAppStore');
    expect(reloaded.useAppStore.getState().conversations.map(chat => chat.id)).toEqual(['existing']);
    expect(reloaded.useAppStore.getState().activeConvId).toBe('existing');
  });

});
