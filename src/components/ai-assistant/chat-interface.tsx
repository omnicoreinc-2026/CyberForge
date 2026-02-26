import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChat } from "@/hooks/use-chat";
import { MessageBubble } from "./message-bubble";
import { SuggestionChips } from "./suggestion-chips";

export function ChatInterface() {
  const { messages, sendMessage, isLoading, isStreaming, error, clearMessages } =
    useChat();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading || isStreaming) return;
    const content = input.trim();
    setInput("");
    void sendMessage(content);
  }, [input, isLoading, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleSuggestionSelect = useCallback(
    (text: string) => {
      setInput("");
      void sendMessage(text);
    },
    [sendMessage]
  );

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        <AnimatePresence mode="popLayout">
          {isEmpty ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full flex-col items-center justify-center gap-6"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-bg-card">
                <Bot className="h-10 w-10 text-accent" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-text-primary">
                  CyberForge AI Assistant
                </h2>
                <p className="mt-1 max-w-md text-sm text-text-muted">
                  Ask me about security vulnerabilities, analyze logs, generate
                  reports, or get remediation guidance.
                </p>
              </div>
              <div className="w-full max-w-2xl">
                <SuggestionChips onSelect={handleSuggestionSelect} />
              </div>
            </motion.div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((message, index) => (
                <MessageBubble
                  key={index}
                  message={message}
                  isStreaming={
                    isStreaming &&
                    index === messages.length - 1 &&
                    message.role === "assistant"
                  }
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-danger/20 bg-danger/5 px-4 py-2"
          >
            <p className="text-xs text-danger">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suggestion chips (when there are messages) */}
      {!isEmpty && !isLoading && !isStreaming && (
        <div className="border-t border-border px-4 pt-3">
          <SuggestionChips onSelect={handleSuggestionSelect} />
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border bg-bg-secondary/50 px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-end gap-3">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:border-border-hover hover:text-text-secondary"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}

          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about security..."
              rows={1}
              disabled={isLoading}
              className={cn(
                "w-full resize-none rounded-xl border border-border bg-bg-card px-4 py-3 pr-12",
                "text-sm text-text-primary placeholder:text-text-muted",
                "focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors"
              )}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isStreaming}
              className={cn(
                "absolute bottom-2.5 right-2 flex h-7 w-7 items-center justify-center rounded-lg",
                "transition-all",
                input.trim() && !isLoading && !isStreaming
                  ? "bg-accent text-bg-primary hover:bg-accent/80"
                  : "text-text-muted"
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Loading indicator */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-2 flex items-center justify-center gap-2"
            >
              <Sparkles className="h-3 w-3 animate-pulse text-accent" />
              <span className="text-xs text-text-muted">Thinking...</span>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-accent"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
