import React, { useState, useEffect } from 'react';
import { useChatStore, LensType } from '../../lib/store.ts';
import {
  ArrowRight,
  Check,
  Sparkles,
  Code,
  Layout,
  BookOpen,
  Brain,
  Terminal,
  List,
  AlignLeft,
  Sliders,
  ChevronRight,
  MessageSquare,
  Command,
} from 'lucide-react';

const LENSES_INFO = [
  {
    id: 'engineering',
    label: 'Engineering',
    icon: Code,
    desc: 'Zero-allocation algorithms & high-concurrency systems in Rust and TypeScript',
    example: 'FastRingBuffer<T> { push(item: T): boolean ... }',
  },
  {
    id: 'reasoning',
    label: 'Reasoning',
    icon: Brain,
    desc: 'Formal invariant proofs, trade-off matrices, and mathematical verification',
    example: 'Theorem: A causally precedes B iff V_A[k] ≤ V_B[k] ∀k',
  },
  {
    id: 'research',
    label: 'Research',
    icon: BookOpen,
    desc: 'Empirical benchmark evaluations & causal literature synthesis',
    example: 'Synthesis: Raft vs Egalitarian Paxos under network skew',
  },
  {
    id: 'design',
    label: 'Design',
    icon: Layout,
    desc: 'Monochrome token architectures, typography ratios, and spatial hierarchy',
    example: 'Scale: --bg: #000000, --elev-1: #0A0A0A, --radius-md: 16px',
  },
  {
    id: 'writing',
    label: 'Writing',
    icon: Terminal,
    desc: 'High-density executive memos, technical RFCs, and decision records',
    example: 'RFC: Modular monolith consolidation (p99 latency <50ms)',
  },
];

export const OnboardingModal: React.FC = () => {
  const {
    hasCompletedOnboarding,
    completeOnboarding,
    outputStyle,
    setOutputStyle,
    setSelectedLens,
  } = useChatStore();

  const [step, setStep] = useState(1);
  const [selectedLensDemo, setSelectedLensDemo] = useState('engineering');
  const [typingText, setTypingText] = useState('');

  // Typing effect on Step 1
  useEffect(() => {
    if (step === 1) {
      const fullText = "One intelligence. Every discipline. No distractions.";
      let idx = 0;
      setTypingText('');
      const interval = setInterval(() => {
        if (idx < fullText.length) {
          setTypingText(fullText.slice(0, idx + 1));
          idx++;
        } else {
          clearInterval(interval);
        }
      }, 30);
      return () => clearInterval(interval);
    }
  }, [step]);

  if (hasCompletedOnboarding) return null;

  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      completeOnboarding();
    }
  };

  const activeLensItem = LENSES_INFO.find((l) => l.id === selectedLensDemo) || LENSES_INFO[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 dark:bg-black/85 backdrop-blur-2xl select-none animate-[wordReveal_200ms_ease-out]">
      <div className="relative w-full max-w-2xl rounded-[24px] bg-[var(--elev-1)] border border-[var(--line-strong)] shadow-2xl overflow-hidden flex flex-col justify-between min-h-[540px]">
        {/* Top Progress Bar */}
        <div className="p-5 px-6 border-b border-[var(--line)] bg-[var(--elev-2)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-serif-display text-2xl text-[var(--text)] tracking-tight">
              Noevix
            </span>
            <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded-[4px] bg-[var(--elev-3)] text-[var(--text-3)] border border-[var(--line)]">
              ONBOARDING {step} OF {totalSteps}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <button
                key={s}
                onClick={() => setStep(s)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-7 bg-[var(--text)]'
                    : s < step
                    ? 'w-3.5 bg-[var(--text-3)]'
                    : 'w-2 bg-[var(--line-strong)]'
                }`}
                title={`Go to step ${s}`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-8 sm:p-10 flex-1 flex flex-col justify-center">
          {/* STEP 1: Introduction */}
          {step === 1 && (
            <div className="space-y-6 animate-[wordReveal_250ms_ease-out]">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-3)] block">
                01 / PHILOSOPHY
              </span>

              <h2 className="font-serif-display text-4xl sm:text-5xl text-[var(--text)] font-normal leading-[1.06]">
                Light in a dark room.
              </h2>

              <div className="p-4 rounded-[12px] bg-[var(--elev-2)] border border-[var(--line)] font-mono text-[14px] text-[var(--text)] min-h-[54px] flex items-center">
                <span>{typingText}</span>
                <span className="inline-block w-2 h-4 bg-[var(--text)] ml-1 animate-pulse" />
              </div>

              <p className="text-[15px] text-[var(--text-2)] leading-relaxed max-w-xl">
                Noevix eliminates decorative color and distracting chat bubbles completely. Pure obsidian dark mode
                concentrates 100% of your cognitive bandwidth on systems engineering, rigorous proofs, and synthesis.
              </p>
            </div>
          )}

          {/* STEP 2: Response Preference (Lists vs Paragraphs vs Code) */}
          {step === 2 && (
            <div className="space-y-6 animate-[wordReveal_250ms_ease-out]">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-3)] block">
                  02 / STRUCTURE PREFERENCE
                </span>
                <h2 className="font-serif-display text-3xl sm:text-4xl text-[var(--text)] font-normal mt-1">
                  How do you prefer answers?
                </h2>
                <p className="text-[13.5px] text-[var(--text-2)] mt-1.5">
                  Choose your default synthesis format. You can switch this at any moment in the composer or Settings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setOutputStyle('lists')}
                  className={`p-5 rounded-[16px] border text-left transition-all flex flex-col justify-between min-h-[140px] ${
                    outputStyle === 'lists'
                      ? 'bg-[var(--elev-3)] border-[var(--text)] text-[var(--text)] shadow-sm'
                      : 'bg-[var(--elev-2)] border-[var(--line)] text-[var(--text-2)] hover:border-[var(--line-strong)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <List className="w-5 h-5 text-[var(--text)]" />
                    {outputStyle === 'lists' && (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-[4px] bg-[var(--text)] text-[var(--bg)] font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-[var(--text)]">Lists & Outlines</h3>
                    <p className="text-[12px] text-[var(--text-3)] mt-1 leading-snug">
                      High-density bullet points, numbered invariants, and rapid scanning.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setOutputStyle('paragraphs')}
                  className={`p-5 rounded-[16px] border text-left transition-all flex flex-col justify-between min-h-[140px] ${
                    outputStyle === 'paragraphs'
                      ? 'bg-[var(--elev-3)] border-[var(--text)] text-[var(--text)] shadow-sm'
                      : 'bg-[var(--elev-2)] border-[var(--line)] text-[var(--text-2)] hover:border-[var(--line-strong)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <AlignLeft className="w-5 h-5 text-[var(--text)]" />
                    {outputStyle === 'paragraphs' && (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-[4px] bg-[var(--text)] text-[var(--bg)] font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-[var(--text)]">Paragraphs & Prose</h3>
                    <p className="text-[12px] text-[var(--text-3)] mt-1 leading-snug">
                      Editorial narrative, thorough explanations, and comprehensive context.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Five Specialized Disciplines */}
          {step === 3 && (
            <div className="space-y-5 animate-[wordReveal_250ms_ease-out]">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-3)] block">
                  03 / ADAPTIVE ROUTING
                </span>
                <h2 className="font-serif-display text-3xl sm:text-4xl text-[var(--text)] font-normal mt-1">
                  Five disciplines. One calm voice.
                </h2>
                <p className="text-[13.5px] text-[var(--text-2)] mt-1">
                  A high-speed non-conversational router evaluates your prompt and executes with domain precision.
                </p>
              </div>

              <div className="space-y-1.5">
                {LENSES_INFO.map((lens) => {
                  const Icon = lens.icon;
                  const isSelected = selectedLensDemo === lens.id;
                  return (
                    <button
                      key={lens.id}
                      onClick={() => {
                        setSelectedLensDemo(lens.id);
                        setSelectedLens(lens.id as LensType);
                      }}
                      className={`w-full p-2.5 px-3 rounded-[10px] border flex items-center justify-between transition-all text-left ${
                        isSelected
                          ? 'bg-[var(--elev-3)] border-[var(--text)] text-[var(--text)]'
                          : 'bg-[var(--elev-2)] border-[var(--line)] text-[var(--text-2)] hover:bg-[var(--elev-3)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-[var(--text)] shrink-0" />
                        <div>
                          <span className="font-mono text-[12px] font-semibold uppercase">{lens.label}</span>
                          <span className="text-[11px] text-[var(--text-3)] ml-2 hidden sm:inline">{lens.desc}</span>
                        </div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[var(--text)]" />}
                    </button>
                  );
                })}
              </div>

              {/* Sample Output Preview Box */}
              <div className="p-3 rounded-[8px] bg-[var(--elev-2)] border border-[var(--line)] font-mono text-[11px] text-[var(--text-2)]">
                <span className="text-[var(--text-3)] uppercase block mb-1">Preview Protocol Signature:</span>
                <code>{activeLensItem.example}</code>
              </div>
            </div>
          )}

          {/* STEP 4: Features & Ready to Begin */}
          {step === 4 && (
            <div className="space-y-5 animate-[wordReveal_250ms_ease-out]">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-3)] block">
                  04 / INSTRUMENT READY
                </span>
                <h2 className="font-serif-display text-4xl sm:text-5xl text-[var(--text)] font-normal mt-1">
                  You are ready to build.
                </h2>
                <p className="text-[14px] text-[var(--text-2)] mt-1.5">
                  Essential tools and keyboard shortcuts at your fingertips:
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[12px] font-mono text-[var(--text-2)]">
                <div className="p-3 rounded-[12px] bg-[var(--elev-2)] border border-[var(--line)]">
                  <span className="text-[var(--text)] font-semibold block mb-0.5 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>New Chat & Chats Menu</span>
                  </span>
                  <p className="text-[11px] text-[var(--text-3)]">
                    Use the Top Bar "+ New Chat" and "Chats" menu to create and switch conversations.
                  </p>
                </div>
                <div className="p-3 rounded-[12px] bg-[var(--elev-2)] border border-[var(--line)]">
                  <span className="text-[var(--text)] font-semibold block mb-0.5 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5" />
                    <span>Code Editor Blocks</span>
                  </span>
                  <p className="text-[11px] text-[var(--text-3)]">
                    Code displays in real editor windows with line numbers, syntax weights, and full sheets.
                  </p>
                </div>
                <div className="p-3 rounded-[12px] bg-[var(--elev-2)] border border-[var(--line)]">
                  <span className="text-[var(--text)] font-semibold block mb-0.5 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Settings & Formatting</span>
                  </span>
                  <p className="text-[11px] text-[var(--text-3)]">
                    Toggle Lists vs Paragraphs, font size, and detail level anytime in Settings.
                  </p>
                </div>
                <div className="p-3 rounded-[12px] bg-[var(--elev-2)] border border-[var(--line)]">
                  <span className="text-[var(--text)] font-semibold block mb-0.5 flex items-center gap-1.5">
                    <Command className="w-3.5 h-3.5" />
                    <span>Index & Lens Keys</span>
                  </span>
                  <p className="text-[11px] text-[var(--text-3)]">
                    Press ⌘K to open the spaces index; press ⌘/ to toggle specialist lens overrides.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-5 px-6 border-t border-[var(--line)] bg-[var(--elev-2)] flex items-center justify-between">
          <button
            onClick={completeOnboarding}
            className="text-[12px] font-mono text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
          >
            Skip to Workspace
          </button>

          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-[9999px] border border-[var(--line)] text-[12px] font-mono text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--elev-3)]"
              >
                Back
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-[9999px] bg-[var(--text)] text-[var(--bg)] text-[13px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm"
            >
              <span>{step === totalSteps ? 'Launch Workspace' : 'Continue'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
