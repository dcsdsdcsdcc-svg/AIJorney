import React, { useState } from 'react';
import { useChatStore } from '../../lib/store.ts';
import {
  Copy,
  Check,
  FileCode,
  Maximize2,
  WrapText,
  ChevronRight,
  Terminal,
} from 'lucide-react';

interface CodeEditorBlockProps {
  code: string;
  language?: string;
  title?: string;
}

// Tokenizer to render real code editor themes (keywords, strings, comments, types, numbers)
function highlightCodeLine(line: string, language: string) {
  // If line is a comment
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return <span className="text-[var(--text-3)] italic font-mono">{line}</span>;
  }

  // Tokenization regex for common editor syntax
  // Keywords, strings, numbers, operators
  const tokenRegex = /(".*?"|'.*?'|`.*?`|\/\/.*$|\b(?:const|let|var|function|return|import|export|from|default|class|interface|type|async|await|if|else|switch|case|break|for|while|try|catch|finally|throw|new|typeof|instanceof|void|fn|pub|struct|impl|enum|mut|match|where|use|crate|self|def|elif|lambda|yield|select|from|where|insert|into|values|update|delete|table|create)\b|\b(?:true|false|null|undefined|None|Some|Ok|Err)\b|\b\d+\b|[{}()[\];,])/g;

  const parts = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={lastIndex} className="text-[var(--text-2)]">
          {line.slice(lastIndex, match.index)}
        </span>
      );
    }

    const token = match[0];
    if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) {
      // String token
      parts.push(
        <span key={match.index} className="text-[var(--text)] opacity-85 underline-offset-2">
          {token}
        </span>
      );
    } else if (token.startsWith('//')) {
      // Comment
      parts.push(
        <span key={match.index} className="text-[var(--text-3)] italic">
          {token}
        </span>
      );
    } else if (/^(true|false|null|undefined|None|Some|Ok|Err|\d+)$/.test(token)) {
      // Literal / Number / Boolean
      parts.push(
        <span key={match.index} className="text-[var(--text)] font-semibold opacity-90">
          {token}
        </span>
      );
    } else if (/^[{}()[\];,]$/.test(token)) {
      // Bracket / punctuation
      parts.push(
        <span key={match.index} className="text-[var(--text-3)]">
          {token}
        </span>
      );
    } else {
      // Keyword
      parts.push(
        <span key={match.index} className="text-[var(--text)] font-bold tracking-tight">
          {token}
        </span>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) {
    parts.push(
      <span key={lastIndex} className="text-[var(--text-2)]">
        {line.slice(lastIndex)}
      </span>
    );
  }

  return parts.length > 0 ? parts : <span>{line || ' '}</span>;
}

export const CodeEditorBlock: React.FC<CodeEditorBlockProps> = ({ code, language, title }) => {
  const { showLineNumbers, codeFontSize, setCodeFontSize, openArtifact } = useChatStore();
  const [copied, setCopied] = useState(false);
  const [isWrap, setIsWrap] = useState(false);
  const [activeLine, setActiveLine] = useState<number | null>(null);

  const cleanCode = code.replace(/\n$/, '');
  const lines = cleanCode.split('\n');

  const lang = (language || 'typescript').toLowerCase();
  const fileExt =
    lang === 'rust' ? 'rs' :
    lang === 'python' ? 'py' :
    lang === 'go' ? 'go' :
    lang === 'json' ? 'json' :
    lang === 'sql' ? 'sql' :
    lang === 'html' ? 'html' :
    lang === 'css' ? 'css' :
    lang === 'bash' || lang === 'sh' ? 'sh' :
    'ts';

  const displayFilename = title || `solution.${fileExt}`;
  const breadcrumb = `src/${fileExt === 'rs' ? 'lib' : fileExt === 'py' ? 'core' : 'modules'}/${displayFilename}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenSheet = () => {
    openArtifact({
      id: 'art_' + Date.now(),
      title: displayFilename,
      language: lang,
      type: 'code',
      content: cleanCode,
    });
  };

  const fontSizeClass =
    codeFontSize === 'sm' ? 'text-[12px]' : codeFontSize === 'lg' ? 'text-[14.5px]' : 'text-[13px]';

  return (
    <div className="my-6 rounded-[14px] bg-[var(--elev-1)] border border-[var(--line-strong)] overflow-hidden shadow-2xl transition-all duration-150 group">
      {/* 1. Real Code Editor Window Chrome / Title Bar */}
      <div className="h-10 px-4 border-b border-[var(--line)] flex items-center justify-between bg-[var(--elev-2)] select-none">
        {/* Left: Window Dots & Active Tab */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Traffic Window Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--line-strong)] hover:opacity-80 transition-opacity" />
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--line-strong)] opacity-60 hover:opacity-80 transition-opacity" />
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--line-strong)] opacity-40 hover:opacity-80 transition-opacity" />
          </div>

          {/* Editor File Tab */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-[6px] bg-[var(--elev-1)] border border-[var(--line)] text-[12px] font-mono text-[var(--text)] shrink-0 shadow-xs">
            <FileCode className="w-3.5 h-3.5 text-[var(--text-3)]" />
            <span className="font-medium">{displayFilename}</span>
          </div>

          {/* Breadcrumb Path */}
          <div className="hidden md:flex items-center gap-1 text-[11px] font-mono text-[var(--text-3)] truncate">
            <ChevronRight className="w-3 h-3 opacity-40 shrink-0" />
            <span className="truncate">{breadcrumb}</span>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Word Wrap Toggle */}
          <button
            onClick={() => setIsWrap(!isWrap)}
            className={`p-1.5 rounded-[5px] text-[11px] font-mono transition-colors ${
              isWrap ? 'bg-[var(--elev-3)] text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--elev-2)]'
            }`}
            title={isWrap ? 'Word wrap active (click to disable)' : 'Enable word wrap'}
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>

          {/* Font Size Quick Toggle */}
          <button
            onClick={() => {
              const next = codeFontSize === 'sm' ? 'base' : codeFontSize === 'base' ? 'lg' : 'sm';
              setCodeFontSize(next);
            }}
            className="px-2 py-1 rounded-[5px] text-[10.5px] font-mono text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--elev-2)] transition-colors"
            title="Cycle font size (12px / 13px / 15px)"
          >
            {codeFontSize === 'sm' ? '12px' : codeFontSize === 'base' ? '13px' : '15px'}
          </button>

          {/* Language Tag */}
          <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] bg-[var(--elev-2)] text-[var(--text-3)] border border-[var(--line)]">
            {lang}
          </span>

          {/* Full Artifacts Sheet button */}
          <button
            onClick={handleOpenSheet}
            className="flex items-center gap-1 px-2 py-1 rounded-[5px] text-[11px] font-mono text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--elev-2)] transition-colors"
            title="Inspect in full code sheet"
          >
            <Maximize2 className="w-3 h-3" />
            <span className="hidden sm:inline">Sheet</span>
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-[11px] font-mono text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--elev-2)] transition-colors"
            title="Copy Code to Clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[var(--text)]" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="font-medium">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* 2. Editor Gutter & Code Body with Syntax Styling */}
      <div className="relative flex overflow-x-auto bg-[var(--code-bg)] text-[var(--text)] font-mono">
        {/* Line Numbers Gutter */}
        {showLineNumbers && (
          <div
            className="shrink-0 py-3.5 px-3 text-right select-none font-mono text-[11px] text-[var(--text-3)] border-r border-[var(--line)] bg-[var(--code-gutter)]"
            aria-hidden="true"
          >
            {lines.map((_, i) => (
              <div
                key={i}
                className={`leading-[1.7] transition-colors ${
                  activeLine === i ? 'text-[var(--text)] font-bold' : ''
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>
        )}

        {/* Code Lines with Token Syntax Highlighting */}
        <pre
          className={`p-3.5 flex-1 font-mono ${fontSizeClass} leading-[1.7] select-text overflow-x-auto ${
            isWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
          }`}
        >
          {lines.map((lineText, lineIdx) => (
            <div
              key={lineIdx}
              onMouseEnter={() => setActiveLine(lineIdx)}
              onMouseLeave={() => setActiveLine(null)}
              className={`hover:bg-[var(--elev-2)] transition-colors rounded-[2px] px-1 -mx-1`}
            >
              {highlightCodeLine(lineText, lang)}
            </div>
          ))}
        </pre>
      </div>

      {/* 3. Editor Status Bar at Bottom */}
      <div className="h-6 px-4 border-t border-[var(--line)] flex items-center justify-between bg-[var(--elev-2)] text-[10px] font-mono text-[var(--text-3)] select-none">
        <div className="flex items-center gap-3">
          <span>{lines.length} lines</span>
          <span>{cleanCode.length} chars</span>
          {activeLine !== null && <span>Ln {activeLine + 1}</span>}
        </div>
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span>Spaces: 2</span>
          <span className="uppercase">{lang}</span>
        </div>
      </div>
    </div>
  );
};
