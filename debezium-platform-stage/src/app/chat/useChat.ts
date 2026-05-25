import { useState, useCallback } from "react";
import { useChatContext } from "./ChatContextProvider";
import type { ChatMessage, DocSource } from "./types";

const CHAT_SERVICE_URL =
  import.meta.env.VITE_CHAT_SERVICE_URL ?? "http://localhost:8100";

const STREAM_TIMEOUT_MS = 90000; // 90s – abort if no completion by then

interface SSEEvent {
  type: "context" | "delta" | "sources" | "done" | "error";
  label?: string;
  content?: string;
  docs?: DocSource[];
  message?: string;
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useChat() {
  const pageContext = useChatContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      setError(null);
      setIsLoading(true);

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
      };
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

      try {
        const response = await fetch(`${CHAT_SERVICE_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content.trim(),
            page_label: pageContext.label,
            page_hint: pageContext.hint,
            history,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Chat service error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        const finalizeStream = () => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant" && last.isStreaming) {
              next[next.length - 1] = { ...last, isStreaming: false };
            }
            return next;
          });
        };

        const processLine = (line: string) => {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as SSEEvent;
              switch (data.type) {
                case "delta":
                  if (data.content) {
                    setMessages((prev) => {
                      const next = [...prev];
                      const last = next[next.length - 1];
                      if (last?.role === "assistant") {
                        next[next.length - 1] = {
                          ...last,
                          content: last.content + data.content,
                        };
                      }
                      return next;
                    });
                  }
                  break;
                case "sources":
                  if (data.docs) {
                    setMessages((prev) => {
                      const next = [...prev];
                      const last = next[next.length - 1];
                      if (last?.role === "assistant") {
                        next[next.length - 1] = {
                          ...last,
                          sources: data.docs,
                        };
                      }
                      return next;
                    });
                  }
                  break;
                case "done":
                  setMessages((prev) => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last?.role === "assistant") {
                      next[next.length - 1] = {
                        ...last,
                        isStreaming: false,
                      };
                    }
                    return next;
                  });
                  break;
                case "error":
                  setMessages((prev) => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last?.role === "assistant") {
                      next[next.length - 1] = {
                        ...last,
                        content: last.content + (data.message ?? "An error occurred."),
                        isStreaming: false,
                      };
                    }
                    return next;
                  });
                  break;
                default:
                  break;
              }
            } catch {
              // Ignore non-JSON lines
            }
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              processLine(line.trim());
            }
          }

          if (buffer.trim()) {
            processLine(buffer.trim());
          }
        } finally {
          clearTimeout(timeoutId);
          finalizeStream();
        }
      } catch (err) {
        clearTimeout(timeoutId);
        const errMsg =
          err instanceof Error
            ? err.name === "AbortError"
              ? "Request timed out. The response may have been cut off."
              : err.message
            : "Chat assistant is unavailable. Check that the chat service is running.";
        setError(errMsg);
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: last.content || errMsg,
              isStreaming: false,
            };
          } else {
            next.push({
              id: generateId(),
              role: "assistant",
              content: errMsg,
              isStreaming: false,
            });
          }
          return next;
        });
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    },
    [pageContext.label, pageContext.hint, messages, isLoading]
  );

  return { messages, sendMessage, isLoading, error, setError, clearHistory };
}
