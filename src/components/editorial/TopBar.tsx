import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../lib/store.ts';
import { getStoredTheme, toggleTheme } from '../../lib/theme.ts';
import {
  Plus,
  MessageSquare,
  Search,
  Sliders,
  Check,
  Edit2,
  User,
  Sparkles,
  ChevronDown,
  Trash2,
  Menu,
  Sun,
  Moon,
} from 'lucide-react';

export const TopBar: React.FC = () => {
  const {
    activeId,
    conversations,
    renameConversation,
    newChat,
    setActiveConversation,
    deleteConversation,
    setIndexOpen,
    setSpacesMenuOpen,
    setSettingsOpen,
    setCurrentView,
    setAuthModalOpen,
  } = useChatStore();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [isQuickChatsOpen, setIsQuickChatsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>('dark');
  const inputRef = useRef<HTMLInputElement>(null);
  const quickChatsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateThemeState = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setCurrentTheme(isDark ? 'dark' : 'light');
    };
    updateThemeState();
    const observer = new MutationObserver(updateThemeState);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const activeSpace = conversations.find((c) => c.id === activeId);

  // Close quick chats dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quickChatsRef.current && !quickChatsRef.current.contains(e.target as Node)) {
        setIsQuickChatsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTitleSubmit = () => {
    if (activeId && titleInput.trim()) {
      renameConversation(activeId, titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  const handleNewChat = () => {
    const id = newChat('Untitled Space');
    setActiveConversation(id);
    setIsQuickChatsOpen(false);
  };

  const handleToggleTheme = () => {
    toggleTheme();
  };

  return (
    <header className="fixed top-0 inset-x-0 h-13 z-40 px-4 sm:px-6 flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur-md shadow-xs select-none">
      {/* Left: Brand + Prominent "+ New Chat" + "Chats Menu" */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Brand */}
        <button
          onClick={() => setCurrentView('marketing')}
          className="font-serif-display text-2xl font-normal tracking-tight text-[var(--text)] hover:opacity-80 transition-opacity"
          title="Return to Noevix Homepage"
        >
          Noevix
        </button>

        <div className="h-4 w-[1px] bg-[var(--line)] mx-1 hidden sm:block" />

        {/* Primary "+ New Chat" Button */}
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9999px] bg-[var(--text)] text-[var(--bg)] text-[12px] font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
          title="Create a new conversation space"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Chat</span>
        </button>

        {/* Chats Dropdown / Drawer Button */}
        <div className="relative" ref={quickChatsRef}>
          <button
            onClick={() => setIsQuickChatsOpen(!isQuickChatsOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[9999px] border text-[12px] font-mono transition-colors ${
              isQuickChatsOpen
                ? 'bg-[var(--elev-2)] border-[var(--text)] text-[var(--text)]'
                : 'bg-[var(--elev-1)] border-[var(--line)] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--elev-2)]'
            }`}
            title="Switch or manage chats"
          >
            <Menu className="w-3.5 h-3.5 text-[var(--text-3)]" />
            <span className="font-medium">Chats</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--elev-3)] text-[var(--text-3)]">
              {conversations.length}
            </span>
            <ChevronDown className="w-3 h-3 text-[var(--text-3)]" />
          </button>

          {/* Quick Chat Switcher Dropdown */}
          {isQuickChatsOpen && (
            <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 rounded-[16px] bg-[var(--elev-1)] border border-[var(--line-strong)] shadow-2xl p-2 z-50 animate-[wordReveal_140ms_ease-out]">
              <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-[var(--line)] mb-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-3)]">
                  Your Spaces ({conversations.length})
                </span>
                <button
                  onClick={() => {
                    setIsQuickChatsOpen(false);
                    setSpacesMenuOpen(true);
                  }}
                  className="font-mono text-[10px] text-[var(--text-3)] hover:text-[var(--text)] underline"
                >
                  Full Drawer
                </button>
              </div>

              {/* Action: + New Chat in dropdown */}
              <button
                onClick={handleNewChat}
                className="w-full mb-1 px-3 py-2 rounded-[8px] bg-[var(--elev-2)] hover:bg-[var(--elev-3)] text-[12.5px] font-medium text-[var(--text)] flex items-center gap-2 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start New Space</span>
              </button>

              {/* Chat items list */}
              <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                {conversations.map((c) => {
                  const isActive = c.id === activeId;
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setActiveConversation(c.id);
                        setIsQuickChatsOpen(false);
                      }}
                      className={`group flex items-center justify-between p-2 rounded-[8px] cursor-pointer text-left transition-colors ${
                        isActive
                          ? 'bg-[var(--elev-3)] text-[var(--text)] font-medium'
                          : 'hover:bg-[var(--elev-2)] text-[var(--text-2)] hover:text-[var(--text)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare className="w-3.5 h-3.5 text-[var(--text-3)] shrink-0" />
                        <span className="text-[13px] truncate">{c.title}</span>
                      </div>

                      {/* Delete action on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {conversations.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation(c.id);
                            }}
                            className="p-1 rounded-[4px] hover:bg-[var(--elev-1)] text-[var(--text-3)] hover:text-[var(--text)]"
                            title="Delete Chat"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                        {isActive && <Check className="w-3.5 h-3.5 text-[var(--text)] ml-1" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Index shortcut */}
              <div className="pt-2 mt-1 border-t border-[var(--line)] px-2 flex items-center justify-between text-[10px] font-mono text-[var(--text-3)]">
                <span>Search all spaces</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--elev-2)] border border-[var(--line)]">⌘K</kbd>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Current Space Title (Editable inline) */}
      <div className="flex-1 max-w-xs sm:max-w-md mx-auto text-center px-2">
        {isEditingTitle ? (
          <div className="flex items-center justify-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
                if (e.key === 'Escape') setIsEditingTitle(false);
              }}
              autoFocus
              className="bg-[var(--elev-2)] text-[13.5px] text-[var(--text)] px-3 py-1 rounded-[6px] border border-[var(--line-strong)] text-center outline-none w-full max-w-[260px]"
            />
            <button
              onClick={handleTitleSubmit}
              className="p-1 text-[var(--text-3)] hover:text-[var(--text)]"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setTitleInput(activeSpace?.title || 'Untitled Space');
              setIsEditingTitle(true);
            }}
            className="group inline-flex items-center gap-1.5 text-[13.5px] text-[var(--text-2)] hover:text-[var(--text)] transition-colors truncate max-w-full"
            title="Click to rename chat title"
          >
            <span className="truncate">{activeSpace?.title || 'Untitled Space'}</span>
            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
          </button>
        )}
      </div>

      {/* Right Controls: Index (⌘K), Settings, Lab, Account */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Lab Link */}
        <button
          onClick={() => setCurrentView('lab')}
          className="hidden md:flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-[var(--text-3)] hover:text-[var(--text)] transition-colors rounded-[9999px] border border-transparent hover:border-[var(--line)]"
          title="Aura State Machine Lab"
        >
          <Sparkles className="w-3 h-3" />
          <span>Lab</span>
        </button>

        {/* Index Overlay Button (⌘K) */}
        <button
          onClick={() => setIndexOpen(true)}
          className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-[9999px] border border-[var(--line)] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--elev-1)] transition-all font-mono"
          title="Search Spaces (⌘K)"
        >
          <Search className="w-3 h-3" />
          <span className="hidden sm:inline">Index</span>
          <kbd className="text-[9px] text-[var(--text-3)] ml-0.5">⌘K</kbd>
        </button>

        {/* Light / Dark Mode Toggle */}
        <button
          onClick={handleToggleTheme}
          className="w-8 h-8 rounded-full border border-[var(--line)] flex items-center justify-center text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--elev-1)] transition-colors"
          title={currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {currentTheme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 transition-transform hover:rotate-45" />
          ) : (
            <Moon className="w-3.5 h-3.5 transition-transform hover:-rotate-12" />
          )}
        </button>

        {/* Settings Button */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--elev-1)] transition-colors"
          title="Preferences & Settings (Theme, Lists, Paragraphs, Code theme)"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        {/* Auth / Account */}
        <button
          onClick={() => setAuthModalOpen(true, 'login')}
          className="w-8 h-8 rounded-full border border-[var(--line)] flex items-center justify-center text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--elev-1)] transition-colors"
          title="Account & Auth"
        >
          <User className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
