import React, { useState, useRef, useEffect } from 'react';
import { useChatStore, LensType } from '../../lib/store.ts';
import {
  Paperclip,
  ArrowUp,
  X,
  Check,
  ChevronDown,
  Bold,
  Italic,
  Code as CodeIcon,
  List,
  ListOrdered,
  Quote,
  Sparkles,
  Mic,
  AlignLeft,
  Maximize2,
  Minimize2,
  Trash2,
  Table as TableIcon,
  HelpCircle,
  FileText,
} from 'lucide-react';

const LENSES: Array<{ id: LensType; label: string; desc: string }> = [
  { id: 'auto', label: 'AUTO', desc: 'Adaptive routing across all 5 disciplines' },
  { id: 'engineering', label: 'ENGINEERING', desc: 'Algorithms, systems, Rust/TS, refactoring' },
  { id: 'design', label: 'DESIGN', desc: 'Spatial UI, monochrome systems, typography' },
  { id: 'research', label: 'RESEARCH', desc: 'Distributed papers, benchmarks, causal synthesis' },
  { id: 'reasoning', label: 'REASONING', desc: 'Formal proofs, trade-off matrix, logic' },
  { id: 'writing', label: 'WRITING', desc: 'Concise executive memos, RFCs, clear documentation' },
];

const PRESETS = [
  {
    category: 'Engineering',
    label: 'Refactor for zero allocation',
    text: 'Refactor the following logic to eliminate heap allocations and optimize for CPU cache locality:\n\n',
  },
  {
    category: 'Reasoning',
    label: 'Architectural trade-off matrix',
    text: 'Provide a structured comparison and trade-off matrix comparing the following options under heavy concurrency:\n\n',
  },
  {
    category: 'Research',
    label: 'Causal literature synthesis',
    text: 'Synthesize the state of the art and empirical benchmarks from recent papers on:\n\n',
  },
  {
    category: 'Formal Logic',
    label: 'Formal invariant proof',
    text: 'Formulate a step-by-step invariant verification and formal proof for:\n\n',
  },
  {
    category: 'Writing',
    label: 'Executive decision memo (RFC)',
    text: 'Draft a concise 1-page executive RFC outlining problem statement, proposed migration, and risk matrix for:\n\n',
  },
];

export const Dock: React.FC = () => {
  const {
    activeId,
    messages,
    sendMessage,
    isStreaming,
    stopStreaming,
    selectedLensOverride,
    setSelectedLens,
    setIsTyping,
    setTypingRate,
    isLensMenuOpen,
    setLensMenuOpen,
    outputStyle,
    setOutputStyle,
    startOnboarding,
    conversations,
    setActiveConversation,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; size: number; type: string }>>([]);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lensMenuRef = useRef<HTMLDivElement>(null);
  const presetsRef = useRef<HTMLDivElement>(null);
  const keystrokeTimesRef = useRef<number[]>([]);
  const speechRecognitionRef = useRef<any>(null);

  const activeMessages = (activeId && messages[activeId]) || [];
  const isEmptyState = activeMessages.length === 0;

  // Auto-resize textarea unless expanded
  useEffect(() => {
    if (textareaRef.current) {
      if (isExpanded) {
        textareaRef.current.style.height = '240px';
      } else {
        textareaRef.current.style.height = 'auto';
        const scrollH = textareaRef.current.scrollHeight;
        const maxH = window.innerHeight * 0.38;
        textareaRef.current.style.height = `${Math.min(scrollH, maxH)}px`;
      }
    }
  }, [input, isExpanded]);

  // Keystroke rate tracking for Aura energy
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const now = performance.now();
    keystrokeTimesRef.current.push(now);
    keystrokeTimesRef.current = keystrokeTimesRef.current.filter((t) => now - t < 2000);
    const rate = keystrokeTimesRef.current.length;

    setIsTyping(val.length > 0);
    setTypingRate(rate);
  };

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isStreaming) return;
    const textToSend = input.trim();
    const attToSend = [...attachments];
    setInput('');
    setAttachments([]);
    setIsTyping(false);
    setTypingRate(0);
    setIsExpanded(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    sendMessage(textToSend, attToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // ⌘/ or Ctrl+/ toggles lens menu
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      setLensMenuOpen(!isLensMenuOpen);
      return;
    }

    // ⌘⏎ or Enter (without shift) sends
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    // Stop streaming on Escape
    if (e.key === 'Escape' && isStreaming) {
      e.preventDefault();
      stopStreaming();
      return;
    }

    // Up arrow on empty input edits last user prompt
    if (e.key === 'ArrowUp' && !input.trim() && activeMessages.length > 0) {
      const lastUser = [...activeMessages].reverse().find((m) => m.role === 'user');
      if (lastUser) {
        e.preventDefault();
        setInput(lastUser.content);
      }
    }
  };

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (lensMenuRef.current && !lensMenuRef.current.contains(e.target as Node)) {
        setLensMenuOpen(false);
      }
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setShowPresets(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newItems = Array.from(files).map((f) => ({
      id: 'att_' + Date.now() + Math.random().toString(36).slice(2, 6),
      name: f.name,
      size: f.size,
      type: f.type || 'text/plain',
    }));
    setAttachments((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Formatting tools helper
  const insertFormatting = (prefix: string, suffix = '') => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const selected = text.slice(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;
    const nextVal = text.slice(0, start) + replacement + text.slice(end);
    setInput(nextVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + (selected.length || 4));
    }, 10);
  };

  // Voice dictation with browser speech recognition or simulated voice transcript
  const handleToggleVoice = () => {
    if (isListening) {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('');
          setInput((prev) => (prev ? prev + ' ' : '') + transcript);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        speechRecognitionRef.current = recognition;
        recognition.start();
        return;
      } catch {}
    }

    // Fallback simulation
    setIsListening(true);
    setTimeout(() => {
      setInput((prev) => (prev ? prev + ' ' : '') + 'Synthesize an asynchronous actor pattern in TypeScript.');
      setIsListening(false);
    }, 1600);
  };

  const currentLensLabel =
    LENSES.find((l) => l.id === selectedLensOverride)?.label || 'AUTO';

  const charCount = input.length;
  const wordCount = input.trim() ? input.trim().split(/\s+/).length : 0;
  const tokenEst = Math.ceil(charCount / 4);

  return (
    <div
      className={`transition-all duration-500 ease-out z-30 ${
        isEmptyState
          ? 'fixed inset-0 flex flex-col items-center justify-center p-6 pointer-events-none'
          : 'fixed bottom-0 inset-x-0 pb-6 pt-2 px-4 pointer-events-none'
      }`}
    >
      <div className="w-full max-w-[760px] mx-auto pointer-events-auto flex flex-col items-center">
        {/* Empty state "Begin." serif headline with quick starter chips */}
        {isEmptyState && (
          <div className="text-center mb-6 animate-[wordReveal_600ms_ease-out] max-w-xl">
            <h1 className="font-serif-display text-5xl sm:text-6xl text-[var(--text)] font-normal tracking-tight">
              Begin.
            </h1>
            <p className="text-[13px] text-[var(--text-3)] font-mono uppercase tracking-widest mt-2">
              One intelligence. Every discipline.
            </p>

            {/* Quick starter chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              {[
                { label: 'Rust Ring Buffer', prompt: 'Construct a lock-free ring buffer in Rust with zero heap allocations.' },
                { label: 'Vector Clocks Proof', prompt: 'Provide a formal invariant proof for vector clock dominance in distributed stores.' },
                { label: 'Raft vs EPaxos', prompt: 'Synthesize core trade-offs between Raft and Egalitarian Paxos under write contention.' },
                { label: 'Monochrome Design System', prompt: 'Draft the CSS token architecture for an editorial monochrome UI.' },
              ].map((starter, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(starter.prompt);
                    textareaRef.current?.focus();
                  }}
                  className="px-3 py-1.5 rounded-[9999px] bg-[var(--elev-1)] hover:bg-[var(--elev-2)] border border-[var(--line)] text-[12px] text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
                >
                  {starter.label}
                </button>
              ))}

              {/* Onboarding trigger */}
              <button
                onClick={startOnboarding}
                className="px-3 py-1.5 rounded-[9999px] bg-[var(--elev-2)] hover:bg-[var(--elev-3)] border border-[var(--line-strong)] text-[12px] font-mono text-[var(--text)] flex items-center gap-1.5"
                title="View animated introduction"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Quick Tour</span>
              </button>
            </div>
          </div>
        )}

        {/* The Dock Container - Crisp responsive shell with dynamic theme styling */}
        <div className="relative w-full rounded-[24px] bg-[var(--elev-1)] border border-[var(--line-strong)] dock-outer-glow shadow-2xl transition-all duration-200">
          {/* Top Formatting & Assistant Toolbar if toggled */}
          {showToolbar && (
            <div className="px-4 py-2 border-b border-[var(--line)] flex items-center justify-between text-[11px] font-mono text-[var(--text-3)] bg-[var(--elev-2)] rounded-t-[24px] flex-wrap gap-2">
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => insertFormatting('**', '**')}
                  className="p-1.5 rounded-[4px] hover:text-[var(--text)] hover:bg-[var(--elev-2)] transition-colors"
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => insertFormatting('*', '*')}
                  className="p-1.5 rounded-[4px] hover:text-[var(--text)] hover:bg-[var(--elev-2)] transition-colors"
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => insertFormatting('`', '`')}
                  className="p-1.5 rounded-[4px] hover:text-[var(--text)] hover:bg-[var(--elev-2)] transition-colors"
                  title="Inline Code"
                >
                  <CodeIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => insertFormatting('\n```typescript\n', '\n```')}
                  className="p-1.5 rounded-[4px] hover:text-[var(--text)] hover:bg-[var(--elev-2)] transition-colors"
                  title="Code Block"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => insertFormatting('\n- ')}
                  className="p-1.5 rounded-[4px] hover:text-[var(--text)] hover:bg-[var(--elev-2)] transition-colors"
                  title="Bullet List"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => insertFormatting('\n1. ')}
                  className="p-1.5 rounded-[4px] hover:text-[var(--text)] hover:bg-[var(--elev-2)] transition-colors"
                  title="Numbered List"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => insertFormatting('\n> ')}
                  className="p-1.5 rounded-[4px] hover:text-[var(--text)] hover:bg-[var(--elev-2)] transition-colors"
                  title="Blockquote"
                >
                  <Quote className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => insertFormatting('\n| Feature | Option A | Option B |\n| :--- | :--- | :--- |\n| Latency | Sub-10ms | 50ms |\n')}
                  className="p-1.5 rounded-[4px] hover:text-[var(--text)] hover:bg-[var(--elev-2)] transition-colors"
                  title="Insert Comparison Table"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Stats & Clear Action */}
              <div className="flex items-center gap-3">
                <span>
                  {wordCount} words | {charCount} chars | ~{tokenEst} tok
                </span>
                {input.length > 0 && (
                  <button
                    onClick={() => setInput('')}
                    className="hover:text-[var(--text)] transition-colors"
                    title="Clear prompt"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Attachments preview row if present */}
          {attachments.length > 0 && (
            <div className="px-4 pt-3 flex flex-wrap gap-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[var(--elev-2)] text-[12px] font-mono text-[var(--text-2)] border border-[var(--line)]"
                >
                  <span className="truncate max-w-[140px]">{att.name}</span>
                  <span className="text-[10px] text-[var(--text-3)]">({Math.round(att.size / 1024)}kb)</span>
                  <button
                    onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                    className="hover:text-[var(--text)] ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea with clean focus */}
          <div className="px-4 pt-3 pb-2 flex items-start gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={isEmptyState ? 'State your hypothesis, architecture, or inquiry...' : 'Synthesize query...'}
              rows={1}
              className={`w-full bg-transparent text-[16px] text-[var(--text)] placeholder-[var(--text-3)] outline-none resize-none leading-relaxed transition-all ${
                isExpanded ? 'h-[240px]' : 'min-h-[42px] max-h-[38vh]'
              }`}
            />

            {/* Expand / Collapse composer toggle */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-[4px] text-[var(--text-3)] hover:text-[var(--text)] shrink-0 transition-colors mt-1"
              title={isExpanded ? 'Collapse composer' : 'Expand full height'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Bottom Controls Bar */}
          <div className="px-3 pb-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Attach File Button */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--elev-2)] transition-colors"
                title="Attach context file or code snippet"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Formatting Toolbar Toggle */}
              <button
                onClick={() => setShowToolbar(!showToolbar)}
                className={`px-2 py-1 rounded-[6px] text-[11px] font-mono transition-colors ${
                  showToolbar
                    ? 'bg-[var(--elev-3)] text-[var(--text)] font-semibold'
                    : 'text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--elev-2)]'
                }`}
                title="Formatting toolbar (Bold, Code, Lists, Tables)"
              >
                <span>Aa</span>
              </button>

              {/* Output Style Quick Switcher (Lists vs Paragraphs vs Code) */}
              <button
                onClick={() => {
                  const next = outputStyle === 'lists' ? 'paragraphs' : outputStyle === 'paragraphs' ? 'code_first' : 'lists';
                  setOutputStyle(next);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-[9999px] bg-[var(--elev-2)] hover:bg-[var(--elev-3)] border border-[var(--line)] text-[11px] font-mono text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
                title={`Click to switch format: currently ${outputStyle.toUpperCase()}`}
              >
                {outputStyle === 'lists' ? (
                  <List className="w-3 h-3 text-[var(--text-3)]" />
                ) : outputStyle === 'paragraphs' ? (
                  <AlignLeft className="w-3 h-3 text-[var(--text-3)]" />
                ) : (
                  <CodeIcon className="w-3 h-3 text-[var(--text-3)]" />
                )}
                <span className="uppercase text-[10px]">Format: {outputStyle.replace('_', '-')}</span>
              </button>

              {/* Presets Prompt Templates Dropdown */}
              <div className="relative" ref={presetsRef}>
                <button
                  onClick={() => setShowPresets(!showPresets)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-[9999px] bg-[var(--elev-2)] hover:bg-[var(--elev-3)] border border-[var(--line)] text-[11px] font-mono text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
                  title="Prompt templates"
                >
                  <Sparkles className="w-3 h-3" />
                  <span className="hidden sm:inline">Presets</span>
                </button>

                {showPresets && (
                  <div className="absolute left-0 bottom-full mb-2 w-72 sm:w-80 p-2 rounded-[16px] bg-[var(--elev-1)] border border-[var(--line-strong)] shadow-2xl backdrop-blur-xl z-50 animate-[wordReveal_140ms_ease-out]">
                    <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)]">
                      Architectural Invariants & Presets
                    </div>
                    <div className="space-y-1 mt-1">
                      {PRESETS.map((p, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setInput(p.text);
                            setShowPresets(false);
                            textareaRef.current?.focus();
                          }}
                          className="w-full text-left p-2 rounded-[8px] hover:bg-[var(--elev-2)] text-[12px] text-[var(--text-2)] hover:text-[var(--text)] transition-colors block"
                        >
                          <div className="font-medium text-[var(--text)]">{p.label}</div>
                          <span className="text-[10px] text-[var(--text-3)] uppercase font-mono">{p.category}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Lens Control Dropdown */}
              <div className="relative" ref={lensMenuRef}>
                <button
                  onClick={() => setLensMenuOpen(!isLensMenuOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-[9999px] bg-[var(--elev-2)] hover:bg-[var(--elev-3)] border border-[var(--line)] text-[11px] font-mono tracking-wider text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
                  title="Specialist Discipline Lens (⌘/)"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text)] opacity-70" />
                  <span>{currentLensLabel}</span>
                  <ChevronDown className="w-3 h-3 text-[var(--text-3)]" />
                </button>

                {/* Lens Menu Overlay */}
                {isLensMenuOpen && (
                  <div className="absolute left-0 bottom-full mb-2 w-72 p-2 rounded-[16px] bg-[var(--elev-1)] border border-[var(--line-strong)] shadow-2xl backdrop-blur-xl z-50 animate-[wordReveal_150ms_ease-out]">
                    <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)]">
                      Intelligence Lens Override
                    </div>
                    <div className="space-y-1 mt-1">
                      {LENSES.map((lens) => {
                        const isSelected = selectedLensOverride === lens.id;
                        return (
                          <button
                            key={lens.id}
                            onClick={() => {
                              setSelectedLens(lens.id);
                              setLensMenuOpen(false);
                            }}
                            className={`w-full flex items-start gap-2.5 p-2 rounded-[10px] text-left transition-colors ${
                              isSelected
                                ? 'bg-[var(--elev-3)] text-[var(--text)]'
                                : 'hover:bg-[var(--elev-2)] text-[var(--text-2)]'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[12px] font-medium">{lens.label}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-[var(--text)]" />}
                              </div>
                              <p className="text-[11px] text-[var(--text-3)] leading-tight mt-0.5">{lens.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Voice Dictation & Send Action */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Voice button */}
              <button
                onClick={handleToggleVoice}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isListening
                    ? 'bg-[var(--text)] text-[var(--bg)] animate-pulse'
                    : 'text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--elev-2)]'
                }`}
                title={isListening ? 'Listening (click to stop)...' : 'Voice Dictation'}
              >
                <Mic className="w-3.5 h-3.5" />
              </button>

              {/* Send or Stop */}
              {isStreaming ? (
                <button
                  onClick={stopStreaming}
                  className="w-8 h-8 rounded-full bg-[var(--elev-2)] border border-[var(--line-strong)] text-[var(--text)] flex items-center justify-center hover:bg-[var(--elev-3)] transition-colors"
                  title="Stop generating (Esc)"
                >
                  <div className="w-2.5 h-2.5 bg-[var(--text)] rounded-[2px]" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() && attachments.length === 0}
                  className="w-8 h-8 rounded-full bg-[var(--text)] text-[var(--bg)] flex items-center justify-center disabled:opacity-20 hover:opacity-90 active:scale-95 transition-all shadow-sm"
                  title="Send prompt (Enter or ⌘Enter)"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
