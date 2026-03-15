"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { SourceCard } from "@/components/chat/SourceCard";
import { RetrievalExplainer } from "@/components/chat/RetrievalExplainer";
import type { ChatMessage } from "@/lib/hooks/useChat";
import type { ChatStatus } from "@/lib/hooks/useChat";
import type { RetrievalStrategy } from "@/lib/types";

interface MessageBubbleProps {
  message: ChatMessage;
  isLastAssistant: boolean;
  status: ChatStatus;
  strategy: RetrievalStrategy;
  topK: number;
}

export function MessageBubble({
  message,
  isLastAssistant,
  status,
  strategy,
  topK,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] rounded-2xl rounded-tr-sm bg-muted px-4 py-2.5 text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  const sources = message.sources ?? [];
  const maxScore = sources.length > 0 ? Math.max(...sources.map((c) => c.score)) : 1;
  const isStreaming = isLastAssistant && (status === "streaming_tokens" || status === "streaming_sources");
  const isDone = !isLastAssistant || status === "done" || status === "idle" || status === "error";

  async function handleCopy() {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        {sources.length > 0 && (
          <>
            <ScrollArea className="w-full">
              <div className="flex gap-3 pb-2">
                {sources.map((chunk) => (
                  <SourceCard key={chunk.chunk_id} chunk={chunk} maxScore={maxScore} />
                ))}
              </div>
            </ScrollArea>
            <RetrievalExplainer
              strategy={strategy}
              topK={topK}
              chunks={sources}
            />
          </>
        )}

        {message.error ? (
          <p className="text-sm text-destructive">{message.error}</p>
        ) : (
          <div className="rounded-2xl rounded-tl-sm border bg-card px-4 py-2.5">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
              {isStreaming && (
                <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-foreground align-text-bottom" />
              )}
            </p>
            {isDone && message.content && (
              <div className="mt-2 flex justify-end">
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 text-xs">
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
