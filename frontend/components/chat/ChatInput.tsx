"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatStatus } from "@/lib/hooks/useChat";

const MAX_CHARS = 2000;

interface ChatInputProps {
  status: ChatStatus;
  onSend: (query: string) => void;
}

export function ChatInput({ status, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDisabled = status !== "idle" && status !== "done" && status !== "error";

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || isDisabled || trimmed.length > MAX_CHARS) return;
    onSend(trimmed);
    setValue("");
    textareaRef.current?.focus();
  }

  return (
    <div className="border-t bg-background p-4">
      <div className="relative flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your documents… (Enter to send, Shift+Enter for newline)"
          className="min-h-[44px] max-h-[120px] resize-none pr-20"
          disabled={isDisabled}
          rows={1}
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {value.length}/{MAX_CHARS}
          </span>
          <Button
            size="sm"
            onClick={submit}
            disabled={isDisabled || !value.trim()}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
