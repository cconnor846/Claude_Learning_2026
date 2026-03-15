"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GLOSSARY } from "@/lib/glossary";

interface GlossaryTooltipProps {
  term: string;
  children: React.ReactNode;
}

/**
 * Wraps any inline text node with a tooltip showing the glossary definition.
 * If the term is not in the GLOSSARY map, renders children with no tooltip.
 */
export function GlossaryTooltip({ term, children }: GlossaryTooltipProps) {
  const definition = GLOSSARY[term];
  if (!definition) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-sm leading-snug">
        <p>{definition}</p>
      </TooltipContent>
    </Tooltip>
  );
}
