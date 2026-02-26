import { useState, useCallback, useRef } from "react";
import type { ChatMessage, StreamToken } from "@/types/ai";

const API_BASE = "http://localhost:8008";

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  clearMessages: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading || isStreaming) return;

      setError(null);

      const userMessage: ChatMessage = { role: "user", content };
      const assistantMessage: ChatMessage = { role: "assistant", content: "" };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);

      try {
        abortRef.current = new AbortController();

        const allMessages = [...messages, userMessage];

        const response = await fetch(`${API_BASE}/api/assistant/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: allMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            stream: true,
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.detail ?? `Request failed with status ${response.status}`
          );
        }

        setIsLoading(false);
        setIsStreaming(true);

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            const jsonStr = trimmed.slice(6);
            try {
              const event: StreamToken = JSON.parse(jsonStr);

              if (event.error) {
                setError(event.error);
                break;
              }

              if (event.done) {
                break;
              }

              accumulated += event.token;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: accumulated,
                  };
                }
                return updated;
              });
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred";
        setError(message);
        // Remove the empty assistant message on error
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant" && !last.content) {
            updated.pop();
          }
          return updated;
        });
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, isLoading, isStreaming]
  );

  const clearMessages = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setMessages([]);
    setError(null);
    setIsLoading(false);
    setIsStreaming(false);
  }, []);

  return {
    messages,
    sendMessage,
    isLoading,
    isStreaming,
    error,
    clearMessages,
  };
}
