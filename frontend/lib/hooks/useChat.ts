"use client";

import { useCallback, useRef, useState } from "react";
import { chatStream } from "@/lib/api";
import type { ChatRequest, RetrievedChunk, SSEEvent } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatStatus =
  | "idle"
  | "sending"
  | "streaming_sources"
  | "streaming_tokens"
  | "done"
  | "error";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: RetrievedChunk[];
  error?: string;
}

interface UseChatResult {
  messages: ChatMessage[];
  status: ChatStatus;
  send: (config: ChatRequest) => Promise<void>;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// SSE line parser
// ---------------------------------------------------------------------------

function parseSSELine(line: string): SSEEvent | null {
  if (!line.startsWith("data: ")) return null;
  try {
    return JSON.parse(line.slice(6)) as SSEEvent;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * SSE state machine for the chat endpoint.
 *
 * States: idle → sending → streaming_sources → streaming_tokens → done
 *                                                                → error
 */
export function useChat(): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  // Accumulate the current assistant message text
  const currentTextRef = useRef<string>("");

  const send = useCallback(async (config: ChatRequest) => {
    setStatus("sending");
    currentTextRef.current = "";

    // Append the user message immediately
    setMessages((prev) => [
      ...prev,
      { role: "user", content: config.query },
    ]);

    // Placeholder for the assistant message — will be updated as tokens arrive
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", sources: [] },
    ]);

    try {
      const stream = await chatStream(config);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      setStatus("streaming_sources");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // Last element may be incomplete

        for (const line of lines) {
          const event = parseSSELine(line.trim());
          if (!event) continue;

          if (event.type === "sources") {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = {
                ...last,
                sources: event.chunks,
              };
              return updated;
            });
            setStatus("streaming_tokens");
          } else if (event.type === "token") {
            currentTextRef.current += event.text;
            const text = currentTextRef.current;
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = { ...last, content: text };
              return updated;
            });
          } else if (event.type === "done") {
            setStatus("done");
          } else if (event.type === "error") {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = {
                ...last,
                error: event.detail,
              };
              return updated;
            });
            setStatus("error");
          }
        }
      }

      // Ensure we land in done if stream closed without a done event
      setStatus((s) => (s === "streaming_tokens" ? "done" : s));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        updated[updated.length - 1] = { ...last, error: message };
        return updated;
      });
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setStatus("idle");
    currentTextRef.current = "";
  }, []);

  return { messages, status, send, reset };
}
