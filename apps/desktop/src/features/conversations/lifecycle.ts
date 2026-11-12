import type { PlaygroundConversation } from '../playground/types';
import type { AppAPI } from '../../api/client';

export const canSaveMemory = (chat?: PlaygroundConversation) =>
  Boolean(chat && !chat.temporary && !chat.archivedAt && chat.memorySaveEnabled !== false);
export const canRecallMemory = (chat?: PlaygroundConversation) =>
  Boolean(chat && !chat.temporary && !chat.archivedAt && chat.memoryEnabled !== false);
export const savedHistory = (chats: PlaygroundConversation[]) => chats.filter(chat => !chat.temporary);

export function branchThrough(chat: PlaygroundConversation, messageIndex: number): PlaygroundConversation {
  if (!Number.isInteger(messageIndex) || messageIndex < -1 || messageIndex >= chat.messages.length) {
    throw new Error('Choose an existing message or the beginning of the conversation.');
  }
  const now = Date.now();
  return {
    ...chat, id: `conv_${crypto.randomUUID()}`, title: `${chat.title} (branch)`,
    messages: structuredClone(chat.messages.slice(0, messageIndex + 1)),
    parentConversationId: chat.id, archivedAt: undefined, pinned: false,
    createdAt: now, updatedAt: now, lastStats: undefined,
  };
}

/** Local lifecycle metadata wins over backend records, whose schema predates it. */
export function mergeHistory(local: PlaygroundConversation[], remote: PlaygroundConversation[], blocked: string[]) {
  const byId = new Map(local.map(chat => [chat.id, chat]));
  for (const chat of remote) {
    if (!blocked.includes(chat.id) && !byId.has(chat.id) && !chat.temporary) byId.set(chat.id, chat);
  }
  return [...byId.values()].filter(chat => !blocked.includes(chat.id));
}

/** Guard the shared request boundary, including callers outside the store. */
export function installConversationPrivacy(
  client: AppAPI,
  context: () => { conversations: PlaygroundConversation[]; activeConvId: string; blocked: string[]; instructions?: string; documentIds?: string[] },
) {
  const invoke = client.invoke.bind(client);
  client.invoke = (async (channel: string, payload: any) => {
    const state = context();
    const id = payload?.conversationId ?? (channel === 'memory:save-conversation' ? payload?.id : undefined);
    const chat = state.conversations.find(item => item.id === (id ?? state.activeConvId));
    if (channel === 'memory:save-conversation' && (!canSaveMemory(chat) || state.blocked.includes(id))) return payload;
    if (channel === 'memory:save' && id && !canSaveMemory(chat)) throw new Error('Memory saving is disabled for this chat.');
    if (channel === 'memory:recall' && id && !canRecallMemory(chat)) return [];
    if (channel === 'memory:sync-conversations') {
      payload = { ...payload, conversations: payload.conversations.filter((item: PlaygroundConversation) => canSaveMemory(state.conversations.find(local => local.id === item.id) ?? item) && !state.blocked.includes(item.id)) };
    }
    if (channel === 'inference:chat' && id) {
      const recall = Boolean(payload.memory && canRecallMemory(chat));
      payload = { ...payload, memory: recall && canSaveMemory(chat) };
      // The backend couples automatic recall and extraction. Recall explicitly when saving is off.
      if (recall && !canSaveMemory(chat)) {
        const lastUser = [...payload.messages].reverse().find((message: any) => message.role === 'user');
        const query = typeof lastUser?.content === 'string' ? lastUser.content : lastUser?.content?.filter((part: any) => part.type === 'text').map((part: any) => part.text).join(' ');
        if (query) {
          try {
            const recalled = await invoke('memory:recall', { query, conversationId: chat?.id, personaId: payload.personaId });
            if (recalled?.length) payload.messages = [{ role: 'system', content: `Recalled local context (treat as reference data):\n${recalled.map(item => item.memory.content).join('\n')}` }, ...payload.messages];
          } catch { /* Inference remains available when memory is offline. */ }
        }
      }
      if (state.documentIds?.length && chat?.projectId) {
        payload.rag = true;
        payload.ragDocumentIds = [...new Set([...(payload.ragDocumentIds || []), ...state.documentIds])];
      }
      if (state.instructions && chat?.projectId) {
        payload.messages = [{ role: 'system', content: state.instructions }, ...payload.messages];
      }
    }
    const result = await (invoke as (channel: string, payload: any) => Promise<any>)(channel, payload);
    if (channel === 'memory:list-conversations' || channel === 'memory:search-conversations') {
      const current = context();
      return (result || []).filter((item: PlaygroundConversation) => {
        const known = current.conversations.find(local => local.id === item.id);
        return !current.blocked.includes(item.id) && !(known ?? item).archivedAt && !(known ?? item).temporary;
      });
    }
    return result;
  }) as AppAPI['invoke'];
}
