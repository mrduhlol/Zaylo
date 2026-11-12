import React, { useEffect, useMemo, useState } from 'react';
import {
  History,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  MessageSquare,
  Search,
} from 'lucide-react';
import type { PlaygroundConversation } from '../types';
import { api } from '../../../api/client';
import { useAppStore } from '../../../stores/useAppStore';

interface HistoryDrawerProps {
  conversations: PlaygroundConversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
  onClose,
}) => {
  const { loftyDbStatus, deletedChats } = useAppStore();
  const visibleHistory = useMemo(() => {
    const deleted = new Set(deletedChats.map(chat => chat.id));
    return conversations.filter(chat => !chat.temporary && !chat.archivedAt && !deleted.has(chat.id));
  }, [conversations, deletedChats]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaygroundConversation[] | null>(null);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      if (loftyDbStatus?.connected) {
        void api
          .invoke('memory:search-conversations', { query: q, limit: 20 })
          .then((res) => { if (!cancelled) setSearchResults((res as PlaygroundConversation[]) || []); })
          .catch(() => {
            if (cancelled) return;
            setSearchResults(
              visibleHistory.filter((c) => c.title.toLowerCase().includes(q.toLowerCase()))
            );
          });
      } else {
        setSearchResults(
          visibleHistory.filter((c) => c.title.toLowerCase().includes(q.toLowerCase()))
        );
      }
    }, 200);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery, visibleHistory, loftyDbStatus?.connected]);

  const displayedConversations = (searchResults ?? visibleHistory).filter(chat => {
    const local = conversations.find(item => item.id === chat.id) || chat;
    return !local.temporary && !local.archivedAt && !deletedChats.some(item => item.id === chat.id);
  });

  const startRename = (conv: PlaygroundConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveRename = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRename(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete conversation "${title}"? This cannot be undone.`)) {
      onDelete(id);
    }
  };

  return (
    <aside className="w-80 border-l border-[#eaeaea] dark:border-[#262626] bg-white dark:bg-[#141414] p-5 space-y-4 select-none overflow-y-auto shrink-0 z-20 flex flex-col justify-between">
      <div className="space-y-4 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#eaeaea] dark:border-[#222222] pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#111111] dark:text-[#F5F5F5]">
            <History className="w-4 h-4 text-zinc-700 dark:text-[#A1A1AA]" />
            <span>Chat History</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-[#F5F5F5] hover:bg-zinc-100 dark:hover:bg-[#202020] transition-colors"
            title="Close History Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black font-medium text-xs shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Conversation</span>
        </button>

        {/* Search Conversations (LoftyDB Semantic Search when connected) */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={loftyDbStatus?.connected ? 'Semantic search chats...' : 'Filter chats...'}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-black dark:focus:border-white"
          />
        </div>

        {/* Conversations List */}
        <div className="space-y-1.5 pt-1">
          {displayedConversations.length === 0 ? (
            <div className="p-6 rounded-xl bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-center space-y-1.5 text-zinc-400 dark:text-[#737373]">
              <MessageSquare className="w-6 h-6 mx-auto opacity-40" />
              <p className="text-xs">{searchQuery ? 'No matching conversations.' : 'No saved conversations yet.'}</p>
              <p className="text-[10px]">Your chats are persisted automatically.</p>
            </div>
          ) : (
            displayedConversations.map((conv) => {
              const isActive = conv.id === activeId;
              const isEditing = editingId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer group space-y-1.5 ${
                    isActive
                      ? 'bg-zinc-100 dark:bg-[#202020] border-black dark:border-white text-[#111111] dark:text-[#F5F5F5] shadow-xs'
                      : 'bg-white dark:bg-[#141414] border-[#eaeaea] dark:border-[#262626] hover:border-zinc-400 dark:hover:border-[#737373] text-zinc-600 dark:text-[#A1A1AA]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {isEditing ? (
                      <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="flex-1 bg-white dark:bg-[#191919] border border-black dark:border-white rounded px-2 py-0.5 text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={(e) => saveRename(conv.id, e)}
                          className="p-1 text-emerald-400 hover:text-emerald-300"
                          title="Save title"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={cancelRename}
                          className="p-1 text-zinc-400 hover:text-zinc-200"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-semibold truncate flex-1 mr-2 text-zinc-900 dark:text-[#F5F5F5] group-hover:text-black dark:group-hover:text-white">
                          {conv.title}
                        </span>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => startRename(conv, e)}
                            className="p-1 rounded hover:bg-[#eaeaea] dark:hover:bg-[#202020] text-[#888888] dark:text-[#737373] hover:text-[#111111] dark:hover:text-[#f5f5f5] transition-colors"
                            title="Rename chat"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(conv.id, conv.title, e)}
                            className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[#888888] dark:text-[#737373] hover:text-rose-500 transition-colors"
                            title="Delete chat"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Metadata Row */}
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span className="truncate max-w-[140px]" title={conv.modelName}>
                      {conv.modelName}
                    </span>
                    <span>
                      {new Date(conv.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
};
