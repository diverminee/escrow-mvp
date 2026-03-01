"use client";

import { useState, ReactNode } from "react";

interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  defaultOpenId?: string;
}

export function Accordion({ items, defaultOpenId }: AccordionProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId || null);

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="overflow-hidden rounded-lg border border-[#154A99]/30"
        >
          {/* Header */}
          <button
            onClick={() => toggle(item.id)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-[#154A99]/20"
          >
            <span className="text-sm font-medium text-[#D9AA90]">{item.title}</span>
            <svg
              className={`h-4 w-4 text-[#A68A7A] transition-transform ${
                openId === item.id ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Content */}
          <div
            className={`overflow-hidden transition-all duration-200 ${
              openId === item.id ? "max-h-96" : "max-h-0"
            }`}
          >
            <div className="border-t border-[#154A99]/30 bg-[#0A2A52]/50 px-4 py-3">
              {item.content}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Simple expandable section
interface ExpandableSectionProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export function ExpandableSection({
  title,
  children,
  defaultExpanded = false,
}: ExpandableSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-lg border border-[#154A99]/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-[#154A99]/20"
      >
        <span className="text-sm font-medium text-[#D9AA90]">{title}</span>
        <svg
          className={`h-4 w-4 text-[#A68A7A] transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {expanded && (
        <div className="border-t border-[#154A99]/30 bg-[#0A2A52]/50 px-4 py-3">
          {children}
        </div>
      )}
    </div>
  );
}
