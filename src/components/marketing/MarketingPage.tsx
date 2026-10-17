import React, { useState, useEffect, useRef } from 'react';
import { useChatStore, LensType } from '../../lib/store.ts';
import { MARKETING_COPY } from '../../content/marketing.ts';
import { toggleTheme } from '../../lib/theme.ts';
import { Aura } from '../aura/Aura.tsx';
import {
  ArrowRight,
  ChevronDown,
  Check,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Code,
  Layout,
  BookOpen,
  Brain,
  Terminal,
  MessageSquare,
  Plus,
  Sun,
  Moon,
} from 'lucide-react';

const DEMO_LENSES: Array<{
  id: LensType;
  label: string;
  badge: string;
  time: string;
  prompt: string;
  response: string;
}> = [
  {
    id: 'engineering',
    label: 'Engineering',
    badge: 'LENS: ENGINEERING',
    time: '180MS',
    prompt: 'Synthesize a zero-copy lock-free ring buffer for low-latency streaming telemetry in TypeScript.',
    response: `export class FastRingBuffer<T> {
  private readonly buffer: (T | undefined)[];
  private readonly mask: number;
  private head = 0;
  private tail = 0;

  constructor(capacity = 1024) {
    this.buffer = new Array(capacity);
    this.mask = capacity - 1;
  }

  push(item: T): boolean {
    if (this.head - this.tail >= this.buffer.length) return false;
    this.buffer[this.head++ & this.mask] = item;
    return true;
  }

  pop(): T | undefined {
    if (this.tail === this.head) return undefined;
    return this.buffer[this.tail++ & this.mask];
  }
}

// Bitwise mask wrap ensures O(1) CPU cache locality without heap reallocations.`,
  },
  {
    id: 'reasoning',
    label: 'Reasoning',
    badge: 'LENS: REASONING',
    time: '240MS',
    prompt: 'Provide a formal invariant proof for vector clock dominance in distributed stores.',
    response: `Invariant Proof: Partial Order over Distributed Events

Theorem: An event A causally precedes event B (A -> B) if and only if:
1. ∀ k ∈ [1..N], V_A[k] ≤ V_B[k]
2. ∃ j ∈ [1..N], V_A[j] < V_B[j]

Proof by Monotonic Counter Invariant:
- Local state progression: Node i increments V_i[i] monotonically on each local event.
- Network message propagation: Every send bundles V_msg; recipient merges V_recv = max(V_local, V_msg).
- Since max() is idempotent, commutative, and monotonic, V_B dominates V_A along every causal chain.
- Q.E.D. If neither vector dominates, events A and B are mathematically concurrent.`,
  },
  {
    id: 'research',
    label: 'Research',
    badge: 'LENS: RESEARCH',
    time: '310MS',
    prompt: 'Synthesize the core trade-offs between Raft, Paxos, and EPaxos under high write contention.',
    response: `Comparative Consensus Synthesis:

1. Leader Bottleneck:
   - Multi-Paxos & Raft route all writes through an elected leader; under 100k+ writes/sec, leader network I/O saturates first.
   - Egalitarian Paxos (EPaxos) distributes proposals across all replicas with zero single-leader serialization.

2. Quorum Phase Latency:
   - Raft requires 2 RTTs for uncommitted log replication.
   - EPaxos commits fast-path writes in 1 RTT if there are no conflicting concurrent operations on identical keys.

3. Failure Recovery Complexity:
   - Raft prioritizes comprehensible leader failover with simple term elections.
   - EPaxos requires topological sorting of dependency graphs during view change.`,
  },
  {
    id: 'design',
    label: 'Design',
    badge: 'LENS: DESIGN',
    time: '190MS',
    prompt: 'Define a spatial typography scale and monochrome elevation token architecture.',
    response: `Monochrome Token Architecture:

Elevation Scale:
- Ground: --bg: #000000 (0% light, pure dark canvas)
- Level 1: --elev-1: #0A0A0A (surface cards, dock)
- Level 2: --elev-2: #111111 (active inputs, elevated controls)
- Level 3: --elev-3: #1A1A1A (flyouts, modals)

Typography Ratio (Major Third 1.25):
- Display (Instrument Serif): 72px / line-height 1.02 / tracking -0.025em
- Title: 32px / line-height 1.15 / tracking -0.015em
- Body: 17px / line-height 1.7 / tracking -0.011em
- Metadata (Geist Mono): 11px uppercase / tracking 0.08em`,
  },
  {
    id: 'writing',
    label: 'Writing',
    badge: 'LENS: WRITING',
    time: '160MS',
    prompt: 'Draft an architectural decision memo migrating from microservices to modular monolith.',
    response: `RFC: Consolidation to Modular Monolith Fabric

Context:
Distributed latency overhead across 28 microservices has increased p99 API response from 40ms to 420ms. Inter-service gRPC serialization consumes 34% of cluster CPU.

Decision:
1. Consolidate domain boundaries into a single Rust binary with internal workspace crates.
2. In-memory asynchronous channels replace network hops for cross-boundary events.
3. Preserve strict compilation visibility barriers to prevent architectural entanglement.

Impact:
- Latency: p99 projected reduction of 88% (<50ms).
- Infrastructure: Fleet reduction from 110 pods to 12 multi-threaded instances.`,
  },
];

export const MarketingPage: React.FC = () => {
  const { setCurrentView, setAuthModalOpen, newChat, setActiveConversation } = useChatStore();
  const [headlineWords, setHeadlineWords] = useState<string[]>([]);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Scripted Demo State - Strictly stabilized to prevent homepage moving
  const [activeLensIndex, setActiveLensIndex] = useState(0);
  const [demoStreamedText, setDemoStreamedText] = useState('');
  const [demoIsTyping, setDemoIsTyping] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const activeLensData = DEMO_LENSES[activeLensIndex];

  useEffect(() => {
    const words = MARKETING_COPY.hero.headline.split(' ');
    setHeadlineWords(words);
  }, []);

  // Demo streaming loop with strict containment so no page height shifting occurs
  useEffect(() => {
    if (isPaused) return;

    let timeout: any;
    const fullResponse = activeLensData.response;
    const words = fullResponse.split(' ');

    let currentWordIndex = 0;
    setDemoStreamedText('');
    setDemoIsTyping(true);

    const interval = setInterval(() => {
      if (currentWordIndex < words.length) {
        currentWordIndex++;
        setDemoStreamedText(words.slice(0, currentWordIndex).join(' '));
      } else {
        clearInterval(interval);
        setDemoIsTyping(false);
        // Pause 7 seconds then cycle to next lens demo
        timeout = setTimeout(() => {
          setActiveLensIndex((prev) => (prev + 1) % DEMO_LENSES.length);
        }, 7000);
      }
    }, 55);

    return () => {
      clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [activeLensIndex, isPaused]);

  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>('dark');

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

  const handleLaunchNewChat = () => {
    const id = newChat('Untitled Space');
    setActiveConversation(id);
    setCurrentView('app');
  };

  return (
    <div className="relative min-h-screen bg-[var(--bg)] text-[var(--text)] overflow-x-hidden select-none">
      {/* Pure monochrome Aura */}
      <Aura />

      {/* Top Floating Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 h-14 px-6 md:px-12 flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg)]/85 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="font-serif-display text-2xl tracking-tight font-normal">Noevix</span>
          <span className="font-mono-label hidden sm:inline px-2 py-0.5 rounded-[4px] bg-[var(--elev-1)]">
            Orchestrated Intelligence
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => setCurrentView('lab')}
            className="text-[13px] text-[var(--text-2)] hover:text-[var(--text)] transition-colors px-2 py-1 font-mono text-[11px]"
          >
            Aura Lab
          </button>
          <button
            onClick={() => setAuthModalOpen(true, 'login')}
            className="text-[13px] text-[var(--text-2)] hover:text-[var(--text)] transition-colors px-2 py-1 font-mono text-[11px]"
          >
            Sign In
          </button>
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-full border border-[var(--line)] flex items-center justify-center text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--elev-1)] transition-colors"
            title={currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {currentTheme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 transition-transform hover:rotate-45" />
            ) : (
              <Moon className="w-3.5 h-3.5 transition-transform hover:-rotate-12" />
            )}
          </button>
          <button
            onClick={handleLaunchNewChat}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-[9999px] bg-[var(--text)] text-[var(--bg)] text-[13px] font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Launch Space</span>
          </button>
        </div>
      </nav>

      {/* ----------------- 1. HERO SECTION ----------------- */}
      <section className="relative min-h-[85vh] flex flex-col items-center justify-center pt-28 px-6 text-center">
        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          <span className="font-mono-label mb-6 px-3 py-1 rounded-[9999px] border border-[var(--line-strong)] tracking-wider">
            PURE OBSIDIAN INSTRUMENT
          </span>

          {/* Instrument Serif Headline */}
          <h1 className="font-serif-display text-5xl sm:text-7xl md:text-[92px] leading-[1.02] tracking-[-0.025em] font-normal mb-8 max-w-4xl">
            {headlineWords.map((word, i) => (
              <span
                key={i}
                className="inline-block opacity-0 animate-[wordReveal_500ms_cubic-bezier(0.16,1,0.3,1)_forwards] mr-3"
                style={{ animationDelay: `${i * 110}ms` }}
              >
                {word}
              </span>
            ))}
          </h1>

          <p className="text-[17px] sm:text-[19px] text-[var(--text-2)] max-w-2xl font-normal leading-relaxed mb-10">
            {MARKETING_COPY.hero.subhead}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={handleLaunchNewChat}
              className="w-full sm:w-auto px-8 py-3.5 rounded-[9999px] bg-[var(--text)] text-[var(--bg)] text-[15px] font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{MARKETING_COPY.hero.ctaPrimary}</span>
            </button>

            <a
              href="#demo"
              className="w-full sm:w-auto px-7 py-3.5 rounded-[9999px] border border-[var(--line)] text-[15px] text-[var(--text)] hover:bg-[var(--elev-1)] transition-colors flex items-center justify-center"
            >
              {MARKETING_COPY.hero.ctaSecondary}
            </a>
          </div>
        </div>
      </section>

      {/* ----------------- 2. LIVE PRODUCT DEMO (Strictly Zero Layout Shift) ----------------- */}
      <section
        id="demo"
        className="relative z-10 py-16 px-6 max-w-5xl mx-auto"
        style={{ contain: 'paint', overflowAnchor: 'none' }}
      >
        <div className="text-center mb-8">
          <span className="font-mono-label block mb-2">LIVE INTERACTIVE STAGE</span>
          <h2 className="font-serif-display text-3xl sm:text-4xl">The Unified Synthesis Engine</h2>
        </div>

        {/* Browser Mock Shell with Locked Rigid Dimensions to eliminate all homepage shaking */}
        <div
          className="rounded-[20px] bg-[var(--elev-1)] border border-[var(--line)] overflow-hidden shadow-2xl flex flex-col"
          style={{ height: '580px', maxHeight: '580px', minHeight: '580px', contain: 'strict' }}
        >
          {/* Top Bar Replica with Lens Switcher Tabs */}
          <div className="h-12 px-4 border-b border-[var(--line)] flex items-center justify-between bg-[var(--elev-2)] shrink-0 select-none">
            {/* Window Controls & Title */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--line-strong)]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--line)]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--line)]" />
              </div>
              <span className="font-serif-display text-base font-medium ml-1">Noevix</span>
            </div>

            {/* Lens Switcher Buttons */}
            <div className="hidden sm:flex items-center gap-1 bg-[var(--elev-1)] p-0.5 rounded-[8px] border border-[var(--line)]">
              {DEMO_LENSES.map((l, idx) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setActiveLensIndex(idx);
                    setDemoStreamedText('');
                  }}
                  className={`px-2.5 py-1 rounded-[6px] text-[10.5px] font-mono uppercase tracking-wider transition-colors ${
                    activeLensIndex === idx
                      ? 'bg-[var(--text)] text-[var(--bg)] font-semibold'
                      : 'text-[var(--text-3)] hover:text-[var(--text)]'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Controls: Pause/Play & Active Badge */}
            <div className="flex items-center gap-2">
              <span className="font-mono-label text-[10px] px-2 py-0.5 rounded-[4px] bg-[var(--elev-3)] text-[var(--text)] border border-[var(--line)]">
                {activeLensData.badge}
              </span>
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="p-1 rounded-[4px] hover:bg-[var(--elev-3)] text-[var(--text-3)] hover:text-[var(--text)]"
                title={isPaused ? 'Resume auto-play' : 'Pause'}
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Locked Stage Area - Exactly 532px to fill the 580px shell without shifting the page */}
          <div
            className="p-6 flex flex-col justify-between bg-[var(--elev-1)] shrink-0 overflow-hidden"
            style={{ height: '532px', maxHeight: '532px', contain: 'strict' }}
          >
            {/* Prompt Box with Rigid Fixed Height */}
            <div className="shrink-0" style={{ height: '78px', maxHeight: '78px', overflow: 'hidden' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono-label">PROMPT INQUIRY</span>
                <span className="font-mono-label text-[10px] text-[var(--text-3)]">LATENCY: {activeLensData.time}</span>
              </div>
              <h3 className="font-serif-display text-lg sm:text-xl text-[var(--text)] leading-snug line-clamp-2">
                &ldquo;{activeLensData.prompt}&rdquo;
              </h3>
            </div>

            {/* Separator */}
            <div className="w-full h-[1px] bg-[var(--line)] shrink-0 my-2" />

            {/* Synthesis Reply Area with Rigid Fixed Height and Isolated Scrollbar */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1.5 shrink-0">
                <span className="font-mono-label">SYNTHESIS OUTPUT</span>
                <span className="font-mono text-[10px] text-[var(--text-3)]">
                  {demoIsTyping ? 'Streaming 60 tok/s' : 'Complete'}
                </span>
              </div>

              {/* Fixed 280px scrolling window with scroll anchoring disabled */}
              <div
                className="font-mono text-[12.5px] leading-relaxed text-[var(--text-2)] whitespace-pre-wrap p-3.5 rounded-[10px] border border-[var(--line)] bg-[#070707] overflow-y-auto"
                style={{ height: '280px', maxHeight: '280px', overflowAnchor: 'none', overscrollBehavior: 'contain' }}
              >
                {demoStreamedText}
                {demoIsTyping && <span className="inline-block w-2 h-3.5 bg-[var(--text)] ml-1 animate-pulse" />}
              </div>
            </div>

            {/* Simulated Composer Dock Replica */}
            <div className="mt-3 shrink-0 mx-auto w-full max-w-xl p-2.5 rounded-[9999px] bg-[var(--elev-1)] border border-[var(--line)] flex items-center justify-between text-[12.5px] text-[var(--text-3)] select-none">
              <div className="flex items-center gap-2 pl-3">
                <span className="font-serif-display text-sm text-[var(--text-2)]">Ready for prompt...</span>
              </div>
              <button
                onClick={handleLaunchNewChat}
                className="px-3 py-1 rounded-[9999px] bg-[var(--text)] text-[var(--bg)] text-[11px] font-medium hover:opacity-90 flex items-center gap-1"
              >
                <span>Launch</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- 3. CAPABILITIES BENTO GRID ----------------- */}
      <section className="relative z-10 py-20 px-6 max-w-5xl mx-auto border-t border-[var(--line)]">
        <div className="text-center mb-16">
          <span className="font-mono-label block mb-2">INTELLIGENCE CAPABILITIES</span>
          <h2 className="font-serif-display text-4xl sm:text-5xl">Five Specialized Roles</h2>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {MARKETING_COPY.capabilities.map((item) => (
            <div
              key={item.id}
              className={`${item.colSpan} p-6 sm:p-8 rounded-[20px] bg-[var(--elev-1)] border border-[var(--line)] flex flex-col justify-between hover:border-[var(--line-strong)] transition-all`}
            >
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono-label px-2 py-0.5 rounded-[4px] bg-[var(--elev-2)] text-[var(--text-3)] border border-[var(--line)]">
                  {item.badge}
                </span>
                <span className="text-xs text-[var(--text-3)]">01</span>
              </div>
              <div>
                <h3 className="font-serif-display text-2xl sm:text-3xl mb-2 text-[var(--text)]">{item.title}</h3>
                <p className="text-[14px] text-[var(--text-2)] leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------- 4. HOW IT WORKS ----------------- */}
      <section className="relative z-10 py-24 px-6 max-w-5xl mx-auto border-t border-[var(--line)]">
        <div className="text-center mb-16">
          <span className="font-mono-label block mb-2">SYSTEM ARCHITECTURE</span>
          <h2 className="font-serif-display text-4xl sm:text-5xl">Zero Friction Synthesis</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {MARKETING_COPY.howItWorks.map((step) => (
            <div key={step.step} className="p-6 rounded-[16px] bg-[var(--elev-1)] border border-[var(--line)] space-y-4">
              <span className="font-mono text-2xl font-bold text-[var(--text-3)] block">{step.step}</span>
              <h3 className="font-serif-display text-2xl text-[var(--text)]">{step.title}</h3>
              <p className="text-[14px] text-[var(--text-2)] leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------- 5. PRINCIPLES ----------------- */}
      <section className="relative z-10 py-24 px-6 max-w-4xl mx-auto text-center border-t border-[var(--line)]">
        <span className="font-mono-label block mb-6">OUR CONSTITUTION</span>
        <div className="space-y-14">
          {MARKETING_COPY.principles.map((pr, idx) => (
            <div key={idx} className="space-y-3">
              <h3 className="font-serif-display text-3xl sm:text-4xl text-[var(--text)] leading-snug">
                &ldquo;{pr.statement}&rdquo;
              </h3>
              <p className="text-[15px] text-[var(--text-2)] max-w-xl mx-auto">{pr.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------- 6. PRICING ----------------- */}
      <section className="relative z-10 py-24 px-6 max-w-5xl mx-auto border-t border-[var(--line)]">
        <div className="text-center mb-16">
          <span className="font-mono-label block mb-2">TRANSPARENT VALUE</span>
          <h2 className="font-serif-display text-4xl sm:text-5xl">Predictable Plans</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {MARKETING_COPY.pricing.map((plan) => (
            <div
              key={plan.tier}
              className={`p-8 rounded-[20px] bg-[var(--elev-1)] border flex flex-col justify-between transition-all ${
                plan.popular ? 'border-[var(--text)] shadow-xl' : 'border-[var(--line)]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-serif-display text-2xl">{plan.tier}</span>
                  {plan.popular && (
                    <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded-[4px] bg-[var(--text)] text-[var(--bg)] font-bold">
                      RECOMMENDED
                    </span>
                  )}
                </div>
                <div className="mb-4">
                  <span className="font-serif-display text-4xl">{plan.price}</span>
                  <span className="font-mono text-[11px] text-[var(--text-3)] ml-2">/ {plan.period}</span>
                </div>
                <p className="text-[13px] text-[var(--text-2)] mb-6 leading-relaxed">{plan.desc}</p>
                <div className="space-y-2.5 mb-8">
                  {plan.features.map((feat, i) => (
                    <div key={i} className="flex items-center gap-2 text-[13px] text-[var(--text-2)]">
                      <Check className="w-3.5 h-3.5 text-[var(--text)] shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleLaunchNewChat}
                className={`w-full py-3 rounded-[9999px] text-[13px] font-medium transition-all ${
                  plan.popular
                    ? 'bg-[var(--text)] text-[var(--bg)] hover:opacity-90'
                    : 'border border-[var(--line)] text-[var(--text)] hover:bg-[var(--elev-2)]'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------- 7. FAQ ----------------- */}
      <section className="relative z-10 py-24 px-6 max-w-3xl mx-auto border-t border-[var(--line)]">
        <div className="text-center mb-12">
          <span className="font-mono-label block mb-2">COMMON QUESTIONS</span>
          <h2 className="font-serif-display text-3xl sm:text-4xl">Architecture Details</h2>
        </div>

        <div className="space-y-3">
          {MARKETING_COPY.faq.map((item, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div key={idx} className="rounded-[14px] bg-[var(--elev-1)] border border-[var(--line)] overflow-hidden">
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between text-[16px] font-medium text-[var(--text)] hover:text-[var(--text)]"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-[14px] text-[var(--text-2)] leading-relaxed border-t border-[var(--line)] pt-3 animate-[wordReveal_150ms_ease-out]">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ----------------- 8. FOOTER ----------------- */}
      <footer className="relative z-10 py-12 px-6 border-t border-[var(--line)] bg-[var(--bg)] text-center">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-serif-display text-xl">Noevix</span>
            <span className="font-mono text-[10px] text-[var(--text-3)]">© 2026</span>
          </div>

          <div className="flex items-center gap-6 text-[12px] font-mono text-[var(--text-3)]">
            <button onClick={() => setCurrentView('lab')} className="hover:text-[var(--text)]">
              Aura Lab
            </button>
            <button onClick={handleLaunchNewChat} className="hover:text-[var(--text)]">
              App Shell
            </button>
            <button onClick={() => setAuthModalOpen(true, 'login')} className="hover:text-[var(--text)]">
              Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
