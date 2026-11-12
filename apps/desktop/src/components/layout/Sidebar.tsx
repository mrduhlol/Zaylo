import { themeArtwork } from '../../theme/artwork';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Layers,
  Users,
  LayoutGrid,
  Plus,
  MessageSquare,
  Search,
  Pin,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Edit2,
  Check,
  X,
  LayoutDashboard,
  Server,
  Smartphone,
  Activity,
  Terminal,
  Gauge,
  Database,
  PanelLeftClose,
  PanelLeft,
  Archive,
  Share2,
  FolderInput,
} from 'lucide-react';
import { useAppStore, NavTab } from '../../stores/useAppStore';
import { useWorkspacePreferences } from '../../stores/useWorkspacePreferences';
import { useProjects } from '../../features/projects/useProjects';
import { AtomIcon } from './sidebar/AtomIcon';
import type { PlaygroundConversation } from '../../features/playground/types';

type SidebarConversation = PlaygroundConversation;

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const PRIMARY_TOOLS: NavItem[] = [
  { id: 'playground', label: 'Playground', icon: Play },
  { id: 'models', label: 'Models', icon: Layers },
  { id: 'personas', label: 'Personas', icon: Users },
  { id: 'loftydb', label: 'LoftyDB', icon: Database },
  { id: 'forge', label: 'Forge', icon: LayoutGrid },
];

const SECONDARY_TOOLS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'server', label: 'Server & API', icon: Server },
  { id: 'devices', label: 'Connected Devices', icon: Smartphone },
  { id: 'performance', label: 'Performance', icon: Activity },
  { id: 'logs', label: 'Terminal Logs', icon: Terminal },
  { id: 'benchmark', label: 'Hardware Benchmark', icon: Gauge },
];

interface ChatMenuState {
  conv: SidebarConversation;
  x: number;
  y: number;
}

const matchesProjectChat = (chat: PlaygroundConversation, query: string) => `${chat.title} ${chat.messages.map(message => typeof message.content === 'string' ? message.content : message.content.filter(part => part.type === 'text').map(part => part.text).join(' ')).join(' ')}`.toLowerCase().includes(query.toLowerCase().trim());

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    serverState,
    conversations,
    activeConvId,
    selectChat,
    createNewChat,
    deleteChat,
    renameChat,
    updateChatOptions,
    archiveChat,
    undoAction,
    undoChatAction,
    branchConversation,
    isSidebarCollapsed,
    toggleSidebar,
    installedModels,
    memories,
    loftyDbStatus,
  } = useAppStore();

  const { projects, selectProject } = useProjects();
  const [menuSection, setMenuSection] = useState<'project' | 'branch' | null>(null);
  const [notice, setNotice] = useState('');
  const { builderMode, collapsedSections, toggleSection, themeFamily } = useWorkspacePreferences();
  const headerArtwork = themeArtwork[themeFamily];

  const [searchQuery, setSearchQuery] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [chatMenu, setChatMenu] = useState<ChatMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const focusSearch = () => { searchRef.current?.focus(); searchRef.current?.select(); };
    window.addEventListener('zaylo:focus-chat-search', focusSearch);
    return () => window.removeEventListener('zaylo:focus-chat-search', focusSearch);
  }, []);

  const convs = conversations.filter(chat => !chat.archivedAt && !chat.temporary);
  const matchingProjects = projects.filter(project => `${project.name} ${project.instructions}`.toLowerCase().includes(searchQuery.toLowerCase().trim()) || convs.some(chat => chat.projectId === project.id && matchesProjectChat(chat, searchQuery)));

  const matchesSearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return () => true;
    return (conv: SidebarConversation) => matchesProjectChat(conv, q);
  }, [searchQuery]);

  const pinnedChats = useMemo(
    () => convs.filter((c) => c.pinned && matchesSearch(c)).sort((a, b) => b.updatedAt - a.updatedAt),
    [convs, matchesSearch]
  );

  const recentChats = useMemo(
    () =>
      convs
        .filter((c) => !c.pinned && (!c.projectId || !projects.some(project => project.id === c.projectId)) && matchesSearch(c))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [convs, matchesSearch, projects]
  );

  const pinnedExpanded = !collapsedSections['pinned'];
  const recentExpanded = !collapsedSections['recent'];
  const moreToolsExpanded = !collapsedSections['more-tools'];

  // Close the chat menu on outside click or Escape.
  useEffect(() => {
    if (!chatMenu) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setChatMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setChatMenu(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [chatMenu]);

  const openChatMenu = (conv: SidebarConversation, x: number, y: number) => {
    setMenuSection(null);
    setChatMenu({ conv, x, y });
  };

  const togglePin = (conv: SidebarConversation) => {
    updateChatOptions(conv.id, { pinned: !conv.pinned });
    setChatMenu(null);
  };

  const handleStartRename = (conv: SidebarConversation) => {
    setEditingChatId(conv.id);
    setEditingTitle(conv.title);
    setChatMenu(null);
  };

  const saveRename = () => {
    if (editingChatId && editingTitle.trim()) {
      renameChat(editingChatId, editingTitle.trim());
    }
    setEditingChatId(null);
  };

  const handleDelete = (conv: SidebarConversation) => {
    deleteChat(conv.id);
    setChatMenu(null);
  };

  const shareChat = async (conv: SidebarConversation) => {
    const text = `# ${conv.title}\n\n${conv.messages.map(message => `## ${message.role}\n\n${typeof message.content === 'string' ? message.content : message.content.map(part => part.type === 'text' ? part.text : '[Image attachment]').join('\n')}`).join('\n\n')}`;
    try {
      if (navigator.share) {
        try { await navigator.share({ title: conv.title, text }); setChatMenu(null); return; }
        catch (error) { if (error instanceof Error && error.name === 'AbortError') return; }
      }
      const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `${conv.title.replace(/[^a-z0-9 -]/gi, '_') || 'chat'}.md`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Chat exported as Markdown.');
    } catch { setNotice('Could not export this chat. Please try again.'); }
    setChatMenu(null);
  };

  const navButtonClass = (isActive: boolean) =>
    `w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
      isActive
        ? 'bg-[#f5f5f5] dark:bg-[#202020] text-[#111111] dark:text-[#F5F5F5]'
        : 'text-zinc-600 dark:text-[#A1A1AA] hover:text-zinc-900 dark:hover:text-[#F5F5F5] hover:bg-[#fafafa] dark:hover:bg-[#202020]'
    }`;

  const renderChatRow = (conv: SidebarConversation) => {
    const isActive = activeConvId === conv.id && activeTab === 'playground';
    const isEditing = editingChatId === conv.id;

    if (isEditing) {
      return (
        <div
          key={conv.id}
          className="px-2 py-1 rounded-lg bg-[#f5f5f5] dark:bg-[#202020] flex items-center gap-1.5 text-xs"
        >
          <input
            type="text"
            aria-label="Chat title"
            autoFocus
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveRename();
              if (e.key === 'Escape') setEditingChatId(null);
            }}
            className="flex-1 bg-transparent border-none text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none"
          />
          <button onClick={saveRename} className="p-0.5 text-emerald-600 hover:text-emerald-700" title="Save rename">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setEditingChatId(null)}
            className="p-0.5 text-zinc-400 hover:text-zinc-600"
            title="Cancel rename"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div
        key={conv.id}
        onClick={() => selectChat(conv.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          openChatMenu(conv, e.clientX, e.clientY);
        }}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            selectChat(conv.id);
          }
        }}
        className={`w-full group px-2.5 py-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-[#3f3f46] ${
          isActive
            ? 'bg-[#f5f5f5] dark:bg-[#202020] text-[#111111] dark:text-[#F5F5F5] font-medium'
            : 'text-zinc-600 dark:text-[#A1A1AA] hover:bg-[#fafafa] dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-[#F5F5F5]'
        }`}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {conv.pinned ? (
            <Pin
              className="w-3 h-3 shrink-0 fill-current text-zinc-500 dark:text-[#A1A1AA]"
              aria-label="Pinned chat"
            />
          ) : isActive ? (
            <MessageSquare className="w-3.5 h-3.5 shrink-0 text-[#111111] dark:text-[#F5F5F5]" />
          ) : null}
          <span className="truncate">{conv.title || 'New Chat'}</span>
        </div>

        {/* Hover/focus-only controls; unboxed (no border/background chip). */}
        <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 flex items-center shrink-0 ml-1 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePin(conv);
            }}
            className="p-0.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-[#F5F5F5] transition-colors bg-transparent border-0"
            title={conv.pinned ? 'Unpin chat' : 'Pin chat'}
          >
            <Pin className={`w-3 h-3 ${conv.pinned ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              openChatMenu(conv, rect.left, rect.bottom + 4);
            }}
            className="p-0.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-[#F5F5F5] transition-colors bg-transparent border-0"
            title="Chat options"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderSectionHeader = (
    name: string,
    label: string,
    count: number,
    expanded: boolean
  ) => (
    <button
      onClick={() => toggleSection(name)}
      className="w-full flex items-center justify-between px-2 py-1 rounded text-[11px] font-medium text-zinc-500 dark:text-[#737373] hover:text-zinc-800 dark:hover:text-[#A1A1AA] transition-colors"
      aria-expanded={expanded}
    >
      <span className="flex items-center gap-1">
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {label}
      </span>
      <span className="font-mono text-[10px]">{count}</span>
    </button>
  );

  const chatList = (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-3">
      {/* New chat */}
      <button
        onClick={() => createNewChat()}
        className="zaylo-glow-hover w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-lg text-xs font-medium text-zinc-700 dark:text-[#A1A1AA] hover:text-zinc-900 dark:hover:text-[#F5F5F5] hover:bg-[#fafafa] dark:hover:bg-[#202020] transition-colors"
        title="New chat (Ctrl+Shift+O)"
      >
        <Plus className="w-4 h-4" />
        <span>New chat</span>
      </button>

      <button onClick={() => createNewChat({ temporary: true })} className="text-left px-3 py-2 mb-2 text-xs text-[var(--muted-foreground)] zaylo-glow-hover rounded-lg">Temporary chat</button>
      {conversations.find(chat => chat.id === activeConvId)?.temporary && <p className="px-3 pb-3 text-xs text-[var(--muted-foreground)]">Temporary chat: history and memory are off. Content lasts until the app closes.</p>}
      {/* Search chats */}
      <div className="relative mb-2 px-0">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-[#737373] pointer-events-none" />
        <input
          type="text"
          ref={searchRef}
          aria-label="Search chats"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search chats..."
          className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-transparent border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#F5F5F5] placeholder:text-zinc-400 dark:placeholder:text-[#737373] focus:outline-none focus:border-zinc-400 dark:focus:border-[#3f3f46] transition-colors"
        />
      </div>

      {/* Personas (available in both modes; rendered here in normal mode) */}
      {!builderMode && (
        <div className="mb-2">
          {(() => {
            const personas = PRIMARY_TOOLS.find((t) => t.id === 'personas')!;
            const Icon = personas.icon;
            const isActive = activeTab === 'personas';
            return (
              <button onClick={() => setActiveTab('personas')} className={navButtonClass(isActive)} title="Personas">
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#111111] dark:text-[#F5F5F5]' : 'text-zinc-500 dark:text-[#737373]'}`} />
                  <span>Personas</span>
                </div>
              </button>
            );
          })()}
        </div>
      )}

      <button onClick={() => setActiveTab('library')} className={navButtonClass(activeTab === 'library')}><span>Library</span></button>
      {renderSectionHeader('projects', 'Projects', matchingProjects.length, !collapsedSections['projects'])}
      {!collapsedSections['projects'] && <div className="space-y-1 mb-3">
        <button onClick={() => { selectProject(undefined); setActiveTab('projects'); }} className="text-xs px-3 py-2 text-[var(--muted-foreground)]">Manage projects</button>
        {matchingProjects.map(project => {
          const chats = convs.filter(chat => chat.projectId === project.id && !chat.pinned && matchesSearch(chat));
          const expanded = !collapsedSections[project.id];
          return <div key={project.id}>
            {renderSectionHeader(project.id, project.name, convs.filter(chat => chat.projectId === project.id).length, expanded)}
            {expanded && <div className="pl-2 space-y-1"><button onClick={() => { selectProject(project.id); setActiveTab('projects'); }} className="text-xs px-3 py-2 underline text-[var(--muted-foreground)]">Files and instructions</button>{chats.map(renderChatRow)}</div>}
          </div>;
        })}
      </div>}
      {searchQuery && matchingProjects.length === 0 && pinnedChats.length === 0 && recentChats.length === 0 && (
        <div className="px-2 py-4 text-[11px] text-zinc-400 dark:text-[#737373]">
          No chats match “{searchQuery}”.
        </div>
      )}

      {/* Pinned — only rendered when populated */}
      {pinnedChats.length > 0 && (
        <div className="mb-1">
          {renderSectionHeader('pinned', 'Pinned', pinnedChats.length, pinnedExpanded)}
          {pinnedExpanded && <div className="space-y-1 mt-0.5">{pinnedChats.map(renderChatRow)}</div>}
        </div>
      )}

      {/* Recent chats */}
      {recentChats.length > 0 && (
        <div className="mb-1">
          {renderSectionHeader('recent', 'Recent', recentChats.length, recentExpanded)}
          {recentExpanded && <div className="space-y-1 mt-0.5 pb-2">{recentChats.map(renderChatRow)}</div>}
        </div>
      )}
    </div>
  );

  return (
    <aside
      className={`bg-white dark:bg-[#0D0D0D] border-r border-[#eaeaea] dark:border-[#262626] flex flex-col select-none shrink-0 h-screen transition-all duration-200 overflow-hidden ${
        isSidebarCollapsed ? 'w-0 border-0' : 'w-[280px]'
      }`}
    >
      {isSidebarCollapsed ? (
        /* Collapsed: no rail, no logo — just the reopen toggle; space is reclaimed. */
        <div className="fixed top-7 left-2 z-40">
          <div className="h-7 shrink-0 w-full [-webkit-app-region:drag]" />
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md text-zinc-400 dark:text-[#A1A1AA] hover:text-zinc-700 dark:hover:text-[#F5F5F5] hover:bg-zinc-100 dark:hover:bg-[#202020] transition-colors"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col min-h-0 flex-1">
            {/* macOS Traffic Lights Header & Drag Spacer */}
            <div className="h-7 shrink-0 w-full [-webkit-app-region:drag]" />

            {/* Brand Header */}
            <div className="relative isolate px-4 pb-5 pt-1 flex items-center justify-between">
              <div aria-hidden="true" className="pointer-events-none absolute -top-7 inset-x-0 -bottom-3 -z-10" style={{
                backgroundImage: `url("${headerArtwork.src}")`, backgroundSize: 'cover', backgroundPosition: 'center 44%',
                filter: headerArtwork.filter, opacity: .45,
                maskImage: 'linear-gradient(to bottom, black 15%, rgba(0,0,0,.85) 48%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 15%, rgba(0,0,0,.85) 48%, transparent 100%)',
              }} />
              <button type="button"
                onClick={() => setActiveTab('playground')}
                className="flex items-center gap-2.5 cursor-pointer group rounded-md focus-visible:outline focus-visible:outline-[var(--theme-accent)]"
                title="Zaylo AI Studio"
              >
                <div className="w-7 h-7 rounded-lg bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-sm tracking-tight shadow-sm shrink-0 transition-transform group-hover:scale-105">
                  <span>Z</span>
                </div>
                <span className="font-semibold text-base text-[#111111] dark:text-[#F5F5F5] tracking-tight">
                  Zaylo
                </span>
              </button>

              <button
                onClick={toggleSidebar}
                className="p-1 rounded-md text-zinc-400 dark:text-[#A1A1AA] hover:text-zinc-700 dark:hover:text-[#F5F5F5] hover:bg-zinc-100 dark:hover:bg-[#202020] transition-colors"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* Builder tools: ALL original destinations, above New chat */}
            {builderMode && (
              <nav className="px-3 pb-1 space-y-1 shrink-0">
                {PRIMARY_TOOLS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const badge =
                    item.id === 'models'
                      ? installedModels.length
                      : item.id === 'loftydb'
                      ? memories.length
                      : undefined;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={navButtonClass(isActive)}
                      title={item.label}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-[#111111] dark:text-[#F5F5F5]' : 'text-zinc-500 dark:text-[#737373]'
                          }`}
                        />
                        <span>{item.label}</span>
                        {item.id === 'loftydb' && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              loftyDbStatus?.connected ? 'bg-emerald-500' : 'bg-zinc-400'
                            }`}
                            title={loftyDbStatus?.connected ? 'LoftyDB Connected' : 'LoftyDB Offline'}
                          />
                        )}
                      </div>
                      {typeof badge === 'number' && badge > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-zinc-200/70 dark:bg-[#191919] text-zinc-700 dark:text-[#A1A1AA] border border-transparent dark:border-[#262626]">
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* More Tools — inline collapsible group of the remaining tools */}
                <button
                  onClick={() => toggleSection('more-tools')}
                  className={navButtonClass(SECONDARY_TOOLS.some((s) => s.id === activeTab))}
                  aria-expanded={moreToolsExpanded}
                  title="More Tools"
                >
                  <div className="flex items-center gap-2.5">
                    {moreToolsExpanded ? (
                      <ChevronDown className="w-4 h-4 shrink-0 text-zinc-500 dark:text-[#737373]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 shrink-0 text-zinc-500 dark:text-[#737373]" />
                    )}
                    <span>More Tools</span>
                  </div>
                </button>
                {moreToolsExpanded &&
                  SECONDARY_TOOLS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`${navButtonClass(isActive)} pl-8`}
                        title={item.label}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isActive ? 'text-[#111111] dark:text-[#F5F5F5]' : 'text-zinc-500 dark:text-[#737373]'
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>
                      </button>
                    );
                  })}

                <div className="border-t border-[#eaeaea] dark:border-[#262626] mx-1 my-1" />
              </nav>
            )}

            {/* Chats */}
            {chatList}
          </div>

          {/* Sidebar Footer */}
          <div className="border-t border-[#eaeaea] dark:border-[#262626] p-3 flex items-center justify-between select-none shrink-0 bg-white dark:bg-[#0D0D0D]">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  serverState === 'RUNNING'
                    ? 'bg-emerald-500 animate-pulse'
                    : serverState === 'STARTING'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-zinc-400'
                }`}
              />
              <span className="text-xs text-zinc-700 dark:text-[#A1A1AA] font-medium truncate">
                Local AI Engine
              </span>
            </div>

            <button
              onClick={() => setActiveTab('settings')}
              className="p-1.5 rounded-md text-zinc-400 dark:text-[#A1A1AA] hover:text-zinc-800 dark:hover:text-[#F5F5F5] hover:bg-zinc-100 dark:hover:bg-[#202020] transition-colors"
              title="Settings & Appearance"
            >
              <AtomIcon className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {undoAction && <div role="status" className="fixed bottom-5 left-4 z-50 flex gap-4 items-center rounded-lg p-3 shadow-lg bg-[var(--card)] text-[var(--foreground)] text-sm"><span>{undoAction.label}</span><button onClick={undoChatAction} className="underline font-semibold">Undo</button><button aria-label="Dismiss undo" onClick={() => useAppStore.setState({ undoAction: undefined })}><X className="w-4 h-4" /></button></div>}
      {notice && <div role="status" className="fixed bottom-20 left-4 z-50 rounded-lg p-3 bg-[var(--card)] text-[var(--foreground)] text-sm">{notice}<button aria-label="Dismiss message" className="ml-3 underline" onClick={() => setNotice('')}>Dismiss</button></div>}
      {/* Chat context menu (right-click or dots) */}
      {chatMenu && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 w-64 max-h-[70vh] overflow-auto rounded-xl bg-[var(--background)] text-[var(--foreground)] border border-current/20 shadow-xl py-1.5 text-xs"
          onKeyDown={event => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
          }}
          style={{
            left: Math.max(8, Math.min(chatMenu.x, window.innerWidth - 264)),
            top: Math.max(8, Math.min(chatMenu.y, window.innerHeight * 0.3 - 8)),
            maxWidth: 'calc(100vw - 16px)',
          }}
        >
          <button
            role="menuitem"
            onClick={() => handleStartRename(chatMenu.conv)}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2.5 text-zinc-700 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-[#F5F5F5] transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Rename
          </button>
          <button
            role="menuitem"
            onClick={() => togglePin(chatMenu.conv)}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2.5 text-zinc-700 dark:text-[#A1A1AA] hover:bg-zinc-50 dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-[#F5F5F5] transition-colors"
          >
            <Pin className={`w-3.5 h-3.5 ${chatMenu.conv.pinned ? 'fill-current' : ''}`} />
            {chatMenu.conv.pinned ? 'Unpin' : 'Pin'}
          </button>
          <div className="border-t border-zinc-100 dark:border-[#222222] my-1" />
          <button
            role="menuitem"
            onClick={() => void shareChat(chatMenu.conv)}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2.5 text-[var(--foreground)] hover:bg-[var(--card)]"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
          <button
            role="menuitem"
            onClick={() => { archiveChat(chatMenu.conv.id); setChatMenu(null); }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2.5 text-[var(--foreground)] hover:bg-[var(--card)]"
          >
            <Archive className="w-3.5 h-3.5" />
            Archive
          </button>
          <button
            role="menuitem"
            onClick={() => setMenuSection(menuSection === 'project' ? null : 'project')}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2.5 text-[var(--foreground)] hover:bg-[var(--card)]"
          >
            <FolderInput className="w-3.5 h-3.5" />
            Move to project
          </button>
          {menuSection === 'project' && <div className="px-3 py-2 space-y-2 border-y border-current/10">
            <button role="menuitem" className="block underline" onClick={() => { updateChatOptions(chatMenu.conv.id, { projectId: undefined }); setChatMenu(null); }}>No project</button>
            {projects.map(project => <button key={project.id} role="menuitem" className="block text-left underline break-all" onClick={() => { updateChatOptions(chatMenu.conv.id, { projectId: project.id }); setChatMenu(null); }}>{project.name}</button>)}
            {!projects.length && <button onClick={() => { setActiveTab('projects'); setChatMenu(null); }}>Create a project first</button>}
          </div>}
          <div className="px-3 py-2 space-y-2 border-y border-current/10">
            <label className="flex gap-2"><input type="checkbox" checked={conversations.find(c => c.id === chatMenu.conv.id)?.memoryEnabled !== false} onChange={event => updateChatOptions(chatMenu.conv.id, { memoryEnabled: event.target.checked })} />Recall memory in this chat</label>
            <label className="flex gap-2"><input type="checkbox" checked={conversations.find(c => c.id === chatMenu.conv.id)?.memorySaveEnabled !== false} onChange={event => updateChatOptions(chatMenu.conv.id, { memorySaveEnabled: event.target.checked })} />Save this chat to memory</label>
            <p className="text-[var(--muted-foreground)]">Changes apply to future requests. Existing memories remain in LoftyDB.</p>
          </div>
          {chatMenu.conv.messages.length > 0 && <button role="menuitem" className="w-full px-3 py-2 text-left" onClick={() => setMenuSection(menuSection === 'branch' ? null : 'branch')}>Branch from message…</button>}
          {menuSection === 'branch' && <div className="px-3 space-y-2">{chatMenu.conv.messages.map((message, index) => <button key={index} role="menuitem" className="block w-full text-left truncate py-1 underline" onClick={() => { branchConversation(chatMenu.conv.id, index); setChatMenu(null); }}>{index + 1}. {message.role}: {typeof message.content === 'string' ? message.content.slice(0, 70) : 'Message with attachments'}</button>)}</div>}
          <div className="border-t border-zinc-100 dark:border-[#222222] my-1" />
          <button
            role="menuitem"
            onClick={() => handleDelete(chatMenu.conv)}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2.5 text-[var(--foreground)] hover:bg-[var(--card)]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}
    </aside>
  );
};
