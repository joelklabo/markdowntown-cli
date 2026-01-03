"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { cn, focusRing, interactiveBase } from "@/lib/cn";
import { searchAtlas, type AtlasSearchResult, type AtlasSearchResultKind } from "@/lib/atlas/searchIndex";

type BadgeConfig = {
  label: string;
  tone: React.ComponentProps<typeof Pill>["tone"];
};

function badgeForKind(kind: AtlasSearchResultKind): BadgeConfig {
  if (kind === "platform") return { label: "Platform", tone: "blue" };
  if (kind === "claim") return { label: "Claim", tone: "yellow" };
  if (kind === "path") return { label: "Path", tone: "gray" };
  if (kind === "recipe") return { label: "Recipe", tone: "primary" };
  return { label: "Guide", tone: "green" };
}

function safeIndex(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(Math.max(value, 0), max);
}

export function AtlasSearch({ className }: { className?: string }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const results = useMemo(() => searchAtlas(query), [query]);
  const trimmed = query.trim();

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (!(event.target instanceof Node)) return;
      if (root.contains(event.target)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function close() {
    setOpen(false);
    setHighlight(0);
  }

  function navigate(result: AtlasSearchResult) {
    close();
    setQuery("");
    inputRef.current?.blur();
    router.push(result.href);
  }

  const hasQuery = trimmed.length > 0;
  const showPanel = open;
  const activeIndex = safeIndex(highlight, results.length - 1);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Input
        ref={inputRef}
        type="search"
        aria-label="Search Atlas"
        placeholder="Search Atlas…"
        value={query}
        onFocus={() => {
          setOpen(true);
          setHighlight(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            setOpen(true);
            return;
          }
          if (!open) return;

          if (e.key === "Escape") {
            e.preventDefault();
            close();
            return;
          }

          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((value) => safeIndex(value + 1, results.length - 1));
            return;
          }

          if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((value) => safeIndex(value - 1, results.length - 1));
            return;
          }

          if (e.key === "Enter") {
            const result = results[activeIndex];
            if (!result) return;
            e.preventDefault();
            navigate(result);
          }
        }}
        size="lg"
        className="rounded-mdt-lg bg-mdt-surface shadow-mdt-sm focus:shadow-mdt-md motion-reduce:transition-none"
      />

      {showPanel ? (
        <div
          className={cn(
            "absolute left-0 right-0 top-full z-30 mt-mdt-3 overflow-hidden rounded-mdt-lg border border-mdt-border bg-mdt-surface-raised shadow-mdt-lg"
          )}
        >
          {!hasQuery ? (
            <div className="px-mdt-3 py-mdt-3 text-body-sm text-mdt-muted">Start typing to search Atlas.</div>
          ) : results.length === 0 ? (
            <div className="px-mdt-3 py-mdt-3 text-body-sm text-mdt-muted">No results.</div>
          ) : (
            <ul role="listbox" aria-label="Atlas search results" className="max-h-[360px] overflow-auto px-mdt-1 py-mdt-1">
              {results.map((result, idx) => {
                const active = idx === activeIndex;
                const badge = badgeForKind(result.kind);
                return (
                  <li key={result.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => navigate(result)}
                      className={cn(
                        "flex w-full items-center justify-between gap-mdt-3 rounded-mdt-md px-mdt-3 py-mdt-2 text-left motion-reduce:transition-none",
                        interactiveBase,
                        focusRing,
                        active
                          ? "bg-[color:var(--mdt-color-surface-strong)] text-mdt-text shadow-mdt-sm"
                          : "text-mdt-text hover:bg-[color:var(--mdt-color-surface-subtle)]"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-body-sm font-medium text-mdt-text">{result.title}</div>
                        {result.subtitle ? (
                          <div className="mt-[1px] truncate text-caption text-mdt-muted">{result.subtitle}</div>
                        ) : null}
                      </div>
                      <Pill tone={badge.tone} className="shrink-0">
                        {badge.label}
                      </Pill>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
