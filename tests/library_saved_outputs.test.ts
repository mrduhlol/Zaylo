import { describe, expect, it } from 'vitest';
import { getSavedOutputsPage, OUTPUT_PAGE_SIZE } from '../apps/desktop/src/features/library/savedOutputs';
import type { PlaygroundConversation } from '../apps/desktop/src/features/playground/types';

const chart = (title: string) => '```json:chart-spec\n' + JSON.stringify({ type: 'bar', title, series: [{ name: 'Revenue', data: [2, 4] }] }) + '\n```';
const presentation = '```presentation\n' + JSON.stringify({ title: 'Planning review', slides: [{ title: 'Next steps' }] }) + '\n```';
const chat = (id: string, content: string, patch: Partial<PlaygroundConversation> = {}): PlaygroundConversation => ({
  id, title: `Source ${id}`, modelId: 'local', modelName: 'Local model', createdAt: 1, updatedAt: 2,
  messages: [{ role: 'assistant', content }], ...patch,
});

describe('saved output library', () => {
  it('derives real chart and presentation titles with their original chat and message', () => {
    const result = getSavedOutputsPage([chat('work', `${chart('Quarterly revenue')}\n${presentation}`)], new Set());
    expect(result.items.map(item => [item.kind, item.title, item.conversationId, item.messageIndex])).toEqual([
      ['Chart', 'Quarterly revenue', 'work', 0], ['Presentation', 'Planning review', 'work', 0],
    ]);
    expect(new Set(result.items.map(item => item.id)).size).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it('excludes temporary and deleted chats but identifies archived saved outputs', () => {
    const result = getSavedOutputsPage([
      chat('private', chart('Private'), { temporary: true }), chat('removed', chart('Removed')),
      chat('archive', chart('Archived output'), { archivedAt: 3 }),
    ], new Set(['removed']));
    expect(result.items.map(item => [item.title, item.archived])).toEqual([['Archived output', true]]);
  });

  it('searches case-insensitive output titles, types and source chat titles', () => {
    const chats = [chat('budget', chart('Revenue')), chat('team', presentation)];
    expect(getSavedOutputsPage(chats, new Set(), '  REVENUE ').items.map(item => item.title)).toEqual(['Revenue']);
    expect(getSavedOutputsPage(chats, new Set(), 'source budget').items.map(item => item.title)).toEqual(['Revenue']);
    expect(getSavedOutputsPage(chats, new Set(), 'presentation').items.map(item => item.title)).toEqual(['Planning review']);
    expect(getSavedOutputsPage(chats, new Set(), 'absent').items).toEqual([]);
  });

  it('ignores prose, malformed JSON and user-supplied specs while handling text content parts', () => {
    const chats = [chat('mixed', '', { messages: [
      { role: 'user', content: chart('User sample') },
      { role: 'assistant', content: 'Some prose. ```json\n{invalid}\n```' },
      { role: 'assistant', content: [{ type: 'text', text: chart('Saved multipart') }] },
    ] })];
    expect(getSavedOutputsPage(chats, new Set()).items.map(item => [item.title, item.messageIndex])).toEqual([['Saved multipart', 2]]);
    expect(getSavedOutputsPage([], new Set()).items).toEqual([]);
  });

  it('returns bounded nonoverlapping pages and stops parsing after its lookahead', () => {
    const chats = Array.from({ length: OUTPUT_PAGE_SIZE + 2 }, (_, i) => chat(String(i), chart(`Chart ${i}`)));
    const first = getSavedOutputsPage(chats, new Set());
    const second = getSavedOutputsPage(chats, new Set(), '', 1);
    expect(first.items).toHaveLength(OUTPUT_PAGE_SIZE);
    expect(first.hasMore).toBe(true);
    expect(second.items.map(item => item.title)).toEqual([`Chart ${OUTPUT_PAGE_SIZE}`, `Chart ${OUTPUT_PAGE_SIZE + 1}`]);
    expect(second.hasMore).toBe(false);
    const unvisited = chat('unvisited', '');
    Object.defineProperty(unvisited, 'messages', { get() { throw new Error('Should not scan beyond lookahead'); } });
    expect(getSavedOutputsPage([...chats, unvisited], new Set()).items).toHaveLength(OUTPUT_PAGE_SIZE);
  });
});
