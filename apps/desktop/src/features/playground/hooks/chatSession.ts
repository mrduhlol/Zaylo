/** Drafts deliberately live in renderer memory only, including temporary chats. */
export interface ChatDraft { text: string; image?: { dataUrl: string; name: string } }
export const chatDrafts = new Map<string, ChatDraft>();
export interface ChatPrivacy { temporary?: boolean; memoryEnabled?: boolean; memorySaveEnabled?: boolean }
export const mayRecallMemory = (chat?: ChatPrivacy) => !chat?.temporary && chat?.memoryEnabled !== false;
export const maySaveMemory = (chat?: ChatPrivacy) => !chat?.temporary && chat?.memorySaveEnabled !== false;
/** Select from all other entries; deterministic random injection supports lifecycle tests. */
export function nextBackground(count: number, previous: number, random = Math.random): number {
  if (count <= 1) return 0;
  const slot = Math.min(count - 2, Math.floor(random() * (count - 1)));
  return slot >= previous && previous >= 0 ? slot + 1 : slot;
}
