"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfigPanel } from "@/components/chat/ConfigPanel";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { useChat } from "@/lib/hooks/useChat";
import { useDocuments } from "@/lib/hooks/useDocuments";
import type { RetrievalStrategy } from "@/lib/types";

export default function ChatPage() {
  const [strategy, setStrategy] = useState<RetrievalStrategy>("hybrid");
  const [topK, setTopK] = useState(5);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  const { messages, status, send } = useChat();
  const { documents } = useDocuments();
  const readyDocs = documents?.filter((d) => d.status === "ready") ?? [];

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function toggleDoc(id: string) {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  }

  const handleSend = useCallback(
    (query: string) => {
      send({
        query,
        strategy,
        top_k: topK,
        document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
      });
    },
    [send, strategy, topK, selectedDocIds],
  );

  return (
    <div className="flex h-[calc(100vh-57px)]">
      <ConfigPanel
        strategy={strategy}
        topK={topK}
        selectedDocIds={selectedDocIds}
        readyDocs={readyDocs}
        onStrategyChange={setStrategy}
        onTopKChange={setTopK}
        onDocToggle={toggleDoc}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Ask a question about your documents.
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((msg, i) => {
                const isLastAssistant =
                  msg.role === "assistant" && i === messages.length - 1;
                return (
                  <MessageBubble
                    key={i}
                    message={msg}
                    isLastAssistant={isLastAssistant}
                    status={status}
                    strategy={strategy}
                    topK={topK}
                  />
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        <ChatInput status={status} onSend={handleSend} />
      </div>
    </div>
  );
}
