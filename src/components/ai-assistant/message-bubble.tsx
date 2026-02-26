import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Bot, User, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/ai";

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [code]);

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-border bg-bg-primary">
      <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
        <span className="font-mono text-xs text-text-muted">
          {language ?? "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-text-muted transition-colors hover:bg-bg-card hover:text-text-secondary"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-success" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="font-mono text-sm leading-relaxed text-text-primary">
          {code}
        </code>
      </pre>
    </div>
  );
}

function renderMarkdown(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const language = line.slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <CodeBlock key={key++} code={codeLines.join("\n")} language={language} />
      );
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="mb-2 mt-4 text-sm font-bold text-accent">
          {formatInline(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={key++} className="mb-2 mt-4 text-base font-bold text-text-primary">
          {formatInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={key++} className="mb-3 mt-4 text-lg font-bold text-text-primary">
          {formatInline(line.slice(2))}
        </h1>
      );
      i++;
      continue;
    }

    // Bullet points
    if (line.match(/^[-*]\s/)) {
      elements.push(
        <div key={key++} className="flex gap-2 py-0.5 pl-2">
          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
          <span className="text-sm leading-relaxed text-text-secondary">
            {formatInline(line.slice(2))}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // Numbered list
    const numberedMatch = line.match(/^(\d+)\.\s(.+)/);
    if (numberedMatch) {
      elements.push(
        <div key={key++} className="flex gap-2 py-0.5 pl-2">
          <span className="flex-shrink-0 font-mono text-xs text-accent">
            {numberedMatch[1]}.
          </span>
          <span className="text-sm leading-relaxed text-text-secondary">
            {formatInline(numberedMatch[2])}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={key++} className="h-2" />);
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={key++} className="text-sm leading-relaxed text-text-secondary">
        {formatInline(line)}
      </p>
    );
    i++;
  }

  return elements;
}

function formatInline(text: string): React.ReactNode {
  // Bold
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-semibold text-text-primary">
          {formatCode(part.slice(2, -2))}
        </strong>
      );
    }
    return <span key={idx}>{formatCode(part)}</span>;
  });
}

function formatCode(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={idx}
          className="rounded bg-bg-primary px-1.5 py-0.5 font-mono text-xs text-accent"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
          isUser
            ? "bg-accent/10 text-accent"
            : "bg-bg-card text-accent border border-border"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message content */}
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-4 py-3",
          isUser
            ? "bg-accent/10 text-text-primary"
            : "glass-card"
        )}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="space-y-1">
            {renderMarkdown(message.content)}
            {isStreaming && (
              <span className="inline-block h-4 w-0.5 animate-pulse bg-accent" />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
