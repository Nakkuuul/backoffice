"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PaletteItem } from "@/lib/nav/use-nav";

/** Mounted only while open (the parent conditionally renders it), so state
 *  starts fresh each time — no reset effects needed. */
export function CommandPalette({ onClose, items }: { onClose: () => void; items: PaletteItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 8);
    return items.filter((i) => `${i.section} ${i.label}`.toLowerCase().includes(q)).slice(0, 10);
  }, [query, items]);

  // Focus the input on mount (DOM side-effect only — no setState).
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, []);

  const go = (item?: PaletteItem) => {
    if (!item || item.soon) return;
    onClose();
    router.push(item.href);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="absolute inset-0 bg-ink/25 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-[560px] overflow-hidden rounded-[10px] border border-rule-strong bg-paper-raised shadow-[0_24px_60px_rgba(28,26,23,0.28)]">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] bg-oxblood" />
        <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-oxblood">Go to</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(results[active]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="Search the registry…"
            className="flex-1 bg-transparent font-mono text-[14px] text-ink outline-none placeholder:text-ink-muted/60"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="rounded-[4px] border border-rule-strong px-1.5 py-px font-mono text-[10px] text-ink-muted">
            ESC
          </kbd>
        </div>

        <ul className="max-h-[44vh] overflow-y-auto py-1.5">
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center font-mono text-[12px] uppercase tracking-[0.14em] text-ink-muted">
              No matches
            </li>
          ) : (
            results.map((item, i) => (
              <li key={item.href}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(item)}
                  disabled={item.soon}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors ${
                    i === active ? "bg-oxblood-tint" : ""
                  } ${item.soon ? "cursor-not-allowed opacity-55" : ""}`}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                      {item.section}
                    </span>
                    <span className="text-gold/70" aria-hidden="true">
                      ›
                    </span>
                    <span className="text-[14px] text-ink">{item.label}</span>
                  </span>
                  {item.soon ? (
                    <span className="rounded-[3px] border border-gold/50 px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.12em] text-gold">
                      Soon
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted/60">↵</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
