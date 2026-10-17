import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../lib/store.ts';
import { getStoredTheme, setStoredTheme, Theme } from '../../lib/theme.ts';
import {
  X,
  Sliders,
  List,
  AlignLeft,
  Table,
  Code,
  RotateCcw,
  Sparkles,
  Trash2,
  Check,
  Moon,
  Sun,
  Laptop,
  FileCode,
  Eye,
  CheckCircle2,
} from 'lucide-react';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setSettingsOpen,
    outputStyle,
    setOutputStyle,
    responseDepth,
    setResponseDepth,
    showLineNumbers,
    setShowLineNumbers,
    codeFontSize,
    setCodeFontSize,
    reduceEffects,
    setReduceEffects,
    startOnboarding,
    conversations,
    newChat,
    setActiveConversation,
  } = useChatStore();

  const [confirmClearChats, setConfirmClearChats] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<Theme>(getStoredTheme());

  useEffect(() => {
    setCurrentTheme(getStoredTheme());
  }, [isSettingsOpen]);

  if (!isSettingsOpen) return null;

  const handleThemeChange = (t: Theme) => {
    setCurrentTheme(t);
    setStoredTheme(t);
  };

  const handleClearAllChats = () => {
    // Reset to a single fresh empty chat
    const id = newChat('Untitled Space');
    setActiveConversation(id);
    setConfirmClearChats(false);
  };

  const handleResetDefaults = () => {
    setOutputStyle('lists');
    setResponseDepth('concise');
    setShowLineNumbers(true);
    setCodeFontSize('base');
    setReduceEffects(false);
    handleThemeChange('system');
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[var(--modal-backdrop)] backdrop-blur-2xl animate-[wordReveal_160ms_ease-out] select-none">
      <div className="relative w-full max-w-xl max-h-[88vh] rounded-[24px] bg-[var(--bg)] border border-[var(--line-strong)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 px-6 border-b border-[var(--line)] flex items-center justify-between bg-[var(--elev-1)]">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-[var(--text)]" />
            <span className="font-serif-display text-2xl text-[var(--text)]">Settings & Preferences</span>
          </div>

          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1.5 rounded-[6px] text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--elev-2)] transition-colors"
            title="Close Settings (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-7">
          {/* 1. Preferred Output Structure: Lists vs Paragraphs vs Tables vs Code */}
          <div className="space-y-3">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-3)] block">
                Default Response Format Style
              </span>
              <p className="text-[13px] text-[var(--text-2)] mt-0.5">
                Configure how Noevix structures syntheses and solutions.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  id: 'lists',
                  label: 'Lists & Outlines',
                  desc: 'High-density bullet points & rapid scanning',
                  icon: List,
                },
                {
                  id: 'paragraphs',
                  label: 'Paragraphs & Prose',
                  desc: 'Editorial narrative, deep explanations & context',
                  icon: AlignLeft,
                },
                {
                  id: 'code_first',
                  label: 'Code-First',
                  desc: 'Prioritize executable code blocks foremost',
                  icon: Code,
                },
                {
                  id: 'tables',
                  label: 'Tables & Matrix',
                  desc: 'Comparison matrices & trade-off analysis',
                  icon: Table,
                },
              ].map((style) => {
                const Icon = style.icon;
                const isSelected = outputStyle === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => setOutputStyle(style.id as any)}
                    className={`p-3.5 rounded-[12px] border text-left transition-all flex flex-col justify-between min-h-[96px] ${
                      isSelected
                        ? 'bg-[var(--elev-3)] border-[var(--text)] text-[var(--text)] shadow-xs'
                        : 'bg-[var(--elev-1)] border-[var(--line)] hover:bg-[var(--elev-2)] text-[var(--text-2)]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <Icon className="w-4 h-4" />
                      {isSelected && <Check className="w-3.5 h-3.5 text-[var(--text)]" />}
                    </div>
                    <div>
                      <div className="font-medium text-[13.5px] mt-2">{style.label}</div>
                      <div className="text-[11px] text-[var(--text-3)] leading-tight mt-0.5">{style.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-full h-[1px] bg-[var(--line)]" />

          {/* 2. Response Detail Depth */}
          <div className="space-y-3">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-3)] block">
              Response Depth & Verbosity
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'concise', label: 'Concise & Direct', desc: 'Direct technical answers with zero conversational filler' },
                { id: 'comprehensive', label: 'Deep Architectural', desc: 'Comprehensive context, proofs, invariants, and edge cases' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setResponseDepth(d.id as any)}
                  className={`p-3 rounded-[10px] border text-left transition-all ${
                    responseDepth === d.id
                      ? 'bg-[var(--elev-3)] border-[var(--text)] text-[var(--text)]'
                      : 'bg-[var(--elev-1)] border-[var(--line)] text-[var(--text-2)] hover:bg-[var(--elev-2)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium">{d.label}</span>
                    {responseDepth === d.id && <Check className="w-3 h-3" />}
                  </div>
                  <span className="text-[11px] text-[var(--text-3)] block mt-0.5">{d.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="w-full h-[1px] bg-[var(--line)]" />

          {/* 3. Code Editor Theme & Gutter Settings */}
          <div className="space-y-3.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-3)] block">
              Code Editor Blocks
            </span>

            {/* Line numbers toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-[10px] bg-[var(--elev-1)] border border-[var(--line)]">
              <div>
                <span className="text-[13.5px] font-medium block">Show Gutter Line Numbers</span>
                <span className="text-[11px] text-[var(--text-3)]">
                  Displays line number column inside code blocks.
                </span>
              </div>
              <button
                onClick={() => setShowLineNumbers(!showLineNumbers)}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  showLineNumbers ? 'bg-[var(--text)]' : 'bg-[var(--line-strong)]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-[var(--bg)] transition-transform duration-150 ${
                    showLineNumbers ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Code font size */}
            <div className="flex items-center justify-between p-3.5 rounded-[10px] bg-[var(--elev-1)] border border-[var(--line)]">
              <div>
                <span className="text-[13.5px] font-medium block">Editor Font Scale</span>
                <span className="text-[11px] text-[var(--text-3)]">Adjust typography size for code snippets</span>
              </div>
              <div className="flex items-center gap-1 rounded-[8px] bg-[var(--elev-2)] p-0.5 border border-[var(--line)]">
                {(['sm', 'base', 'lg'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setCodeFontSize(sz)}
                    className={`px-3 py-1 rounded-[6px] text-[11px] font-mono uppercase transition-colors ${
                      codeFontSize === sz
                        ? 'bg-[var(--text)] text-[var(--bg)] font-bold'
                        : 'text-[var(--text-3)] hover:text-[var(--text)]'
                    }`}
                  >
                    {sz === 'sm' ? '12px' : sz === 'base' ? '13px' : '15px'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="w-full h-[1px] bg-[var(--line)]" />

          {/* 4. Atmosphere, Effects & Theme Selection */}
          <div className="space-y-3.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-3)] block">
              Atmosphere & Appearance
            </span>

            {/* Interactive Theme Selector */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'dark', label: 'Obsidian Dark', desc: 'Pure dark canvas', icon: Moon },
                { id: 'light', label: 'Editorial Light', desc: 'Paper & ink contrast', icon: Sun },
                { id: 'system', label: 'System Sync', desc: 'Follow OS theme', icon: Laptop },
              ].map((th) => {
                const Icon = th.icon;
                const isSelected = currentTheme === th.id;
                return (
                  <button
                    key={th.id}
                    onClick={() => handleThemeChange(th.id as Theme)}
                    className={`p-3 rounded-[10px] border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[var(--elev-3)] border-[var(--text)] text-[var(--text)] shadow-xs'
                        : 'bg-[var(--elev-1)] border-[var(--line)] text-[var(--text-2)] hover:bg-[var(--elev-2)]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <Icon className="w-4 h-4" />
                      {isSelected && <Check className="w-3.5 h-3.5 text-[var(--text)]" />}
                    </div>
                    <div>
                      <div className="font-medium text-[12.5px]">{th.label}</div>
                      <div className="text-[10px] text-[var(--text-3)] leading-tight mt-0.5">{th.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Reduce Effects toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-[10px] bg-[var(--elev-1)] border border-[var(--line)]">
              <div>
                <span className="text-[13.5px] font-medium block">Reduce Atmospheric Effects</span>
                <span className="text-[11px] text-[var(--text-3)]">
                  Disables grain texture and rotating border highlight.
                </span>
              </div>
              <button
                onClick={() => setReduceEffects(!reduceEffects)}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  reduceEffects ? 'bg-[var(--text)]' : 'bg-[var(--line-strong)]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-[var(--bg)] transition-transform duration-150 ${
                    reduceEffects ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="w-full h-[1px] bg-[var(--line)]" />

          {/* 5. Onboarding & Reset Actions */}
          <div className="space-y-3">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-3)] block">
              Tools & Data Management
            </span>

            {/* Replay Onboarding button */}
            <button
              onClick={() => {
                setSettingsOpen(false);
                startOnboarding();
              }}
              className="w-full py-2.5 px-4 rounded-[10px] border border-[var(--line)] hover:bg-[var(--elev-2)] text-[13px] font-mono text-[var(--text-2)] hover:text-[var(--text)] transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Launch Animated Onboarding Screen</span>
            </button>

            {/* Reset to defaults */}
            <button
              onClick={handleResetDefaults}
              className="w-full py-2 px-4 rounded-[10px] bg-[var(--elev-1)] hover:bg-[var(--elev-2)] border border-[var(--line)] text-[12px] font-mono text-[var(--text-3)] hover:text-[var(--text)] transition-colors flex items-center justify-center gap-2"
            >
              {resetSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--text)]" />
                  <span>Settings Reset to Defaults</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All Settings to Defaults</span>
                </>
              )}
            </button>

            {/* Clear All Chats */}
            {confirmClearChats ? (
              <div className="p-3 rounded-[10px] bg-[var(--elev-2)] border border-[var(--line-strong)] space-y-2">
                <span className="text-[12px] text-[var(--text)] block font-medium">
                  Are you sure you want to clear all chat spaces?
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleClearAllChats}
                    className="px-3 py-1 rounded-[6px] bg-[var(--text)] text-[var(--bg)] text-[12px] font-medium"
                  >
                    Confirm Clear
                  </button>
                  <button
                    onClick={() => setConfirmClearChats(false)}
                    className="px-3 py-1 rounded-[6px] border border-[var(--line)] text-[12px] text-[var(--text-3)] hover:text-[var(--text)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClearChats(true)}
                className="w-full py-2 px-4 rounded-[10px] text-[12px] font-mono text-[var(--text-3)] hover:text-[var(--text)] transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Chat History ({conversations.length} spaces)</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-[var(--line)] bg-[var(--elev-1)] flex items-center justify-between text-[11px] font-mono text-[var(--text-3)]">
          <span>
            {currentTheme === 'dark'
              ? 'Obsidian Dark Active'
              : currentTheme === 'light'
              ? 'Editorial Light Active'
              : 'System Theme Active'}
          </span>
          <button
            onClick={() => setSettingsOpen(false)}
            className="px-5 py-1.5 rounded-[9999px] bg-[var(--text)] text-[var(--bg)] text-[12px] font-semibold hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
