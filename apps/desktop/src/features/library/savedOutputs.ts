import type { PlaygroundConversation } from '../playground/types';
import { parseMessageSpecs } from '../playground/utils/specParser';

export interface SavedOutput {
  id: string;
  title: string;
  kind: 'Chart' | 'Presentation';
  conversationId: string;
  conversationTitle: string;
  messageIndex: number;
  archived: boolean;
}

export const OUTPUT_PAGE_SIZE = 24;

/** Stop collecting after one page and a lookahead; never duplicate specs into storage. */
export function getSavedOutputsPage(
  conversations: PlaygroundConversation[],
  deletedIds: ReadonlySet<string>,
  query = '',
  page = 0,
): { items: SavedOutput[]; hasMore: boolean } {
  const q = query.trim().toLocaleLowerCase();
  const offset = Math.max(0, Math.floor(page)) * OUTPUT_PAGE_SIZE;
  const items: SavedOutput[] = [];
  let matches = 0;
  for (const chat of conversations) {
    if (chat.temporary || deletedIds.has(chat.id)) continue;
    for (const [messageIndex, message] of chat.messages.entries()) {
      if (message.role !== 'assistant') continue;
      const text = typeof message.content === 'string' ? message.content : message.content.filter(part => part.type === 'text').map(part => part.text).join('\n');
      if (!text.includes('```')) continue;
      const specs = parseMessageSpecs(text);
      for (const [kind, list] of [['Chart', specs.charts], ['Presentation', specs.presentations]] as const) {
        for (const [index, spec] of list.entries()) {
          const title = typeof spec.title === 'string' && spec.title.trim() ? spec.title : `Untitled ${kind.toLowerCase()}`;
          if (q && !`${title} ${chat.title} ${kind}`.toLocaleLowerCase().includes(q)) continue;
          if (matches++ < offset) continue;
          if (items.length === OUTPUT_PAGE_SIZE) return { items, hasMore: true };
          items.push({ id: `${chat.id}:${messageIndex}:${kind}:${index}`, title, kind, conversationId: chat.id, conversationTitle: chat.title, messageIndex, archived: Boolean(chat.archivedAt) });
        }
      }
    }
  }
  return { items, hasMore: false };
}
