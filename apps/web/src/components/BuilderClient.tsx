"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "./ui/Button";
import { Pill } from "./ui/Pill";
import { Container } from "./ui/Container";
import { Stack, Row } from "./ui/Stack";
import { Surface } from "./ui/Surface";
import { Heading } from "./ui/Heading";
import { Text } from "./ui/Text";
import { TextArea } from "./ui/TextArea";
import { cn } from "@/lib/cn";
import { BuilderStatus } from "./BuilderStatus";
import { useBuilderStore } from "@/hooks/useBuilderStore";
import { track } from "@/lib/analytics";
import { OnboardingChecklist } from "./onboarding/OnboardingChecklist";

type Template = { id: string; title: string; description?: string; body: string; tags: string[] };
type Snippet = { id: string; title: string; content: string; tags: string[] };

type Props = {
  templates: Template[];
  snippets: Snippet[];
  requireAuth?: boolean;
};

export function BuilderClient({ templates, snippets, requireAuth }: Props) {
  const search = useSearchParams();
  const preselectedTemplate = search?.get("template");
  const preselectedSnippets = (search?.get("add") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const initialTemplate =
    preselectedTemplate && templates.some((t) => t.id === preselectedTemplate)
      ? preselectedTemplate
      : templates[0]?.id ?? null;
  const initialSnippetIds = preselectedSnippets.filter((id) => snippets.some((s) => s.id === id));

  const {
    selectedTemplate,
    setSelectedTemplate,
    selectedSnippets,
    toggleSnippet,
    moveSnippet,
    reorderSnippets,
    overrides,
    setOverride,
    rendered,
    loading: previewLoading,
    error,
    hasPrivateContent,
  } = useBuilderStore({ initialTemplateId: initialTemplate, initialSnippetIds });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved">("idle");
  const [toast, setToast] = useState<{ message: string; tone?: "info" | "success" | "error" } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  function showToast(message: string, tone: "info" | "success" | "error" = "info") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  // Outline parsing
  type OutlineNode = { id: string; title: string; level: number; line: number };
  const lines = useMemo(() => rendered.split("\n"), [rendered]);
  const outline: OutlineNode[] = useMemo(() => {
    const nodes: OutlineNode[] = [];
    lines.forEach((line, idx) => {
      const match = /^(#{1,6})\s+(.*)/.exec(line.trim());
      if (!match) return;
      const level = match[1].length;
      const title = match[2].trim();
      nodes.push({ id: `${idx}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, title, level, line: idx });
    });
    return nodes;
  }, [lines]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [draggingOutline, setDraggingOutline] = useState(false);

  useEffect(() => {
    // reset collapse when content changes; defer to avoid synchronous state update warning
    const id = requestAnimationFrame(() => setCollapsed(new Set()));
    return () => cancelAnimationFrame(id);
  }, [rendered]);

  // autosave to localStorage
  useEffect(() => {
    if (!selectedTemplate && selectedSnippets.length === 0 && Object.keys(overrides).length === 0) return;
    setSaveState("dirty");
    const timer = setTimeout(() => {
      try {
        const payload = {
          selectedTemplate,
          selectedSnippets,
          overrides,
          rendered,
          ts: Date.now(),
        };
        localStorage.setItem("mdt_builder_autosave", JSON.stringify(payload));
        setSaveState("saved");
      } catch {
        /* ignore */
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [selectedTemplate, selectedSnippets, overrides, rendered]);

  // hydrate from autosave
  useEffect(() => {
    try {
      const stored = localStorage.getItem("mdt_builder_autosave");
      if (!stored) return;
      const parsed = JSON.parse(stored) as {
        selectedTemplate?: string | null;
        selectedSnippets?: string[];
        overrides?: Record<string, string>;
        ts?: number;
      };
      if (parsed.selectedTemplate) setSelectedTemplate(parsed.selectedTemplate);
      if (parsed.selectedSnippets) {
        parsed.selectedSnippets.forEach((id) => toggleSnippet(id));
      }
      if (parsed.overrides) {
        Object.entries(parsed.overrides).forEach(([id, value]) => setOverride(id, value));
      }
      setSaveState("saved");
      showToast("Restored builder draft", "success");
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lineOwner = useMemo(() => {
    const owner: (OutlineNode | null)[] = new Array(lines.length).fill(null);
    let current: OutlineNode | null = null;
    let nextIndex = 0;
    const sorted = [...outline].sort((a, b) => a.line - b.line);
    for (let i = 0; i < lines.length; i++) {
      if (nextIndex < sorted.length && sorted[nextIndex].line === i) {
        current = sorted[nextIndex];
        nextIndex += 1;
      }
      owner[i] = current;
    }
    return owner;
  }, [lines.length, outline]);

  const visibleLines = useMemo(() => {
    return lines.filter((_, idx) => {
      const owner = lineOwner[idx];
      if (!owner) return true;
      if (owner.line === idx) return true;
      return !collapsed.has(owner.id);
    });
  }, [lines, lineOwner, collapsed]);

  const previewRef = useRef<HTMLDivElement | null>(null);

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    track("builder_load", {
      templateId: selectedTemplate,
      snippetCount: selectedSnippets.length,
      preselected: Boolean(preselectedTemplate || preselectedSnippets.length),
    });
    // fire once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function jumpTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
      el.focus?.();
    }
  }

  function handleOutlineDragEnd(result: DropResult) {
    setDraggingOutline(false);
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    reorderSnippets(from, to);
  }

  async function copyMarkdown() {
    if (!rendered) return;
    await navigator.clipboard.writeText(rendered);
    track("builder_copy", { templateId: selectedTemplate, snippetCount: selectedSnippets.length });
    showToast("Copied markdown", "success");
  }

  function downloadMarkdown() {
    if (!rendered) return;
    const blob = new Blob([rendered], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(selectedTemplate && templates.find((t) => t.id === selectedTemplate)?.title) || "agents"}.md`;
    a.click();
    URL.revokeObjectURL(url);
    track("builder_download", { templateId: selectedTemplate, snippetCount: selectedSnippets.length });
    showToast("Downloaded agents.md", "success");
  }

  async function saveDocument() {
    if (requireAuth) {
      window.location.href = "/signin?callbackUrl=/builder";
      return;
    }
    const title = prompt("Name this agents.md", "My agents.md");
    if (!title) return;
    setSaving(true);
    setSaveError(null);
    setSaveState("saving");
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: `Built from ${selectedSnippets.length} snippets`,
        renderedContent: rendered,
        snippetIds: selectedSnippets,
        tags: ["agents", "builder"],
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaveError(data.error ?? "Save failed");
      setSaving(false);
      setSaveState("dirty");
      showToast("Save failed", "error");
      track("builder_save_failed", {
        status: res.status,
        templateId: selectedTemplate,
        snippetCount: selectedSnippets.length,
      });
      return;
    }
    const doc = await res.json();
    setSaving(false);
    setSaveState("saved");
    track("builder_save_success", {
      documentId: doc.id,
      templateId: selectedTemplate,
      snippetCount: selectedSnippets.length,
    });
    showToast("Saved to documents", "success");
    window.location.href = `/documents/${doc.id}`;
  }

  const steps = ["Template", "Snippets", "Arrange", "Preview", "Export"] as const;
  const [stepIndex, setStepIndex] = useState(0);

  function goStep(next: number) {
    const clamped = Math.max(0, Math.min(next, steps.length - 1));
    setStepIndex(clamped);
    const anchor = document.querySelector(`[data-step-anchor=\"${steps[clamped].toLowerCase()}\"]`) as HTMLElement | null;
    anchor?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  }

  return (
    <main id="main-content" className="py-mdt-10 pb-mdt-16 md:py-mdt-12 md:pb-mdt-12">
      <Container size="lg" padding="md">
        <Stack gap={8}>
          <OnboardingChecklist
            onLoadSample={() => {
              const sample = templates[0];
              const sampleSnips = snippets.slice(0, 3);
              if (sample) setSelectedTemplate(sample.id);
              sampleSnips.forEach((s) => toggleSnippet(s.id));
              showToast("Loaded sample project", "success");
              track("onboarding_sample_load", { templateId: sample?.id, snippetCount: sampleSnips.length });
            }}
          />
          {toast && (
            <div
              role="status"
              className={cn(
                "fixed right-4 top-20 z-40 min-w-[220px] rounded-mdt-md border px-mdt-3 py-mdt-2 text-body-sm shadow-mdt-lg",
                toast.tone === "success"
                  ? "border-[color:var(--mdt-color-success)]/30 bg-[color:var(--mdt-color-success)]/10 text-[color:var(--mdt-color-success)]"
                  : toast.tone === "error"
                    ? "border-[color:var(--mdt-color-danger)]/30 bg-[color:var(--mdt-color-danger)]/10 text-[color:var(--mdt-color-danger)]"
                    : "border-mdt-border bg-mdt-surface text-mdt-text"
              )}
            >
              {toast.message}
            </div>
          )}

          <Surface
            as="div"
            padding="sm"
            className="sticky top-16 z-10 rounded-mdt-md border border-mdt-border bg-[color:var(--mdt-color-surface)]/95 shadow-mdt-sm backdrop-blur-md"
          >
            <div className="flex flex-wrap items-center justify-between gap-mdt-3">
              <div className="flex flex-wrap items-center gap-mdt-2 text-body-sm font-semibold text-mdt-muted dark:text-mdt-muted-dark">
                {steps.map((label, idx) => {
                  const active = idx === stepIndex;
                  const done = idx < stepIndex;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => goStep(idx)}
                      className={cn(
                        "flex items-center gap-mdt-2 rounded-mdt-sm px-mdt-2 py-mdt-1 text-body-sm font-semibold transition duration-mdt-fast ease-mdt-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mdt-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mdt-color-surface)] motion-reduce:transition-none",
                        active
                          ? "bg-mdt-blue text-white shadow-mdt-sm"
                          : done
                            ? "bg-mdt-surface-subtle text-mdt-text dark:bg-mdt-surface-strong dark:text-mdt-text-dark"
                            : "text-mdt-muted hover:text-mdt-text dark:text-mdt-muted-dark dark:hover:text-mdt-text-dark"
                      )}
                      aria-current={active ? "step" : undefined}
                      aria-pressed={active}
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs">
                        {idx + 1}
                      </span>
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-mdt-2">
                <div className="h-2 w-24 rounded-full bg-mdt-bg dark:bg-mdt-bg-dark sm:w-32">
                  <div
                    className="h-2 rounded-full bg-mdt-blue transition-all motion-reduce:transition-none"
                    style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
                    aria-hidden
                  />
                </div>
                <span className="text-caption text-mdt-muted dark:text-mdt-muted-dark">
                  Step {stepIndex + 1} of {steps.length}
                </span>
              </div>
            </div>
          </Surface>

          <Surface tone="raised" padding="lg" className="flex flex-col gap-mdt-4 lg:flex-row lg:items-center lg:justify-between">
            <Stack gap={2}>
              <Text size="caption" tone="muted" weight="semibold" tracking="wide" className="uppercase">
                Builder
              </Text>
              <Heading level="display" leading="tight">Assemble your agents.md</Heading>
              <Text tone="muted" leading="relaxed" className="max-w-2xl">
                Pick a template, add snippets, reorder, then copy, download, or save as a document.
              </Text>
            </Stack>
            <Row gap={2} wrap className="w-full lg:w-auto">
              <Button variant="secondary" size="sm" asChild>
                <Link href="/browse">Browse library</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={requireAuth ? "/signin?callbackUrl=/builder" : "/documents"}>Your documents</Link>
              </Button>
            </Row>
          </Surface>

          <div className="grid gap-mdt-5 lg:grid-cols-[320px_320px_minmax(0,1fr)] xl:grid-cols-[320px_320px_minmax(0,1fr)_280px]">
            <Surface padding="md" className="space-y-mdt-4" data-step-anchor="template">
              <div className="flex flex-col gap-mdt-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-h3">Templates</h3>
                <Pill tone="yellow">Pick one</Pill>
              </div>
              <div className="max-h-[55vh] space-y-mdt-2 overflow-y-auto pr-1">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    data-testid="builder-template"
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={cn(
                      "w-full rounded-mdt-md border px-mdt-3 py-mdt-2 text-left text-body-sm transition duration-mdt-fast ease-mdt-standard focus:outline-none focus-visible:ring-2 focus-visible:ring-mdt-ring focus-visible:ring-offset-2 focus-visible:ring-offset-mdt-surface motion-reduce:transition-none",
                      selectedTemplate === tpl.id
                        ? "border-mdt-info bg-mdt-primary-soft shadow-mdt-sm dark:bg-mdt-surface-strong"
                        : "border-transparent hover:bg-mdt-surface-subtle hover:shadow-mdt-sm dark:hover:bg-mdt-surface-subtle"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{tpl.title}</span>
                      <Pill tone="gray">{tpl.tags[0]}</Pill>
                    </div>
                    <p className="line-clamp-2 text-caption text-mdt-muted dark:text-mdt-muted-dark">{tpl.description}</p>
                  </button>
                ))}
              </div>
            </Surface>

            <Surface padding="md" className="space-y-mdt-4" data-step-anchor="snippets">
              <div className="flex flex-col gap-mdt-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-h3">Snippets</h3>
                <Pill tone="blue">Add</Pill>
              </div>
              <div className="max-h-[55vh] space-y-mdt-2 overflow-y-auto pr-1">
                {snippets.map((snip) => {
                  const active = selectedSnippets.includes(snip.id);
                  return (
                    <div key={snip.id} className="flex flex-col gap-mdt-2 rounded-mdt-md border border-transparent p-mdt-2">
                      <div className="flex items-start gap-mdt-2">
                        <button
                          data-testid="builder-snippet"
                          onClick={() => toggleSnippet(snip.id)}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowUp") {
                              e.preventDefault();
                              moveSnippet(snip.id, -1);
                            }
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              moveSnippet(snip.id, 1);
                            }
                          }}
                          className={cn(
                            "flex-1 rounded-mdt-md border px-mdt-3 py-mdt-2 text-left text-body-sm transition duration-mdt-fast ease-mdt-standard focus:outline-none focus-visible:ring-2 focus-visible:ring-mdt-ring focus-visible:ring-offset-2 focus-visible:ring-offset-mdt-surface motion-reduce:transition-none",
                            active
                              ? "border-mdt-info bg-mdt-primary-soft shadow-mdt-sm dark:bg-mdt-surface-strong"
                              : "border-transparent hover:bg-mdt-surface-subtle hover:shadow-mdt-sm dark:hover:bg-mdt-surface-subtle"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{snip.title}</span>
                            <Pill tone="gray">{snip.tags[0]}</Pill>
                          </div>
                          <p className="line-clamp-2 text-caption text-mdt-muted dark:text-mdt-muted-dark">{snip.content}</p>
                        </button>
                        {active && (
                          <div className="flex flex-col gap-mdt-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveSnippet(snip.id, -1)}
                              aria-label="Move up"
                              disabled={selectedSnippets.indexOf(snip.id) === 0}
                            >
                              ↑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveSnippet(snip.id, 1)}
                              aria-label="Move down"
                              disabled={selectedSnippets.indexOf(snip.id) === selectedSnippets.length - 1}
                            >
                              ↓
                            </Button>
                          </div>
                        )}
                      </div>
                      {active && (
                        <TextArea
                          value={overrides[snip.id] ?? ""}
                          onChange={(e) => setOverride(snip.id, e.target.value)}
                          placeholder="Override this snippet (optional)"
                          className="font-mono text-caption"
                          rows={2}
                          aria-label={`Override content for ${snip.title}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </Surface>

            <Surface padding="md" className="flex flex-col gap-mdt-4" data-step-anchor="preview">
              <div className="flex flex-col gap-mdt-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-h3">Preview</h3>
                <div className="flex flex-wrap gap-mdt-2">
                  <Button variant="secondary" size="sm" onClick={copyMarkdown} disabled={!rendered}>
                    Copy
                  </Button>
                  <Button variant="secondary" size="sm" onClick={downloadMarkdown} disabled={!rendered}>
                    Download
                  </Button>
                  <Button size="sm" onClick={saveDocument} disabled={!rendered || saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
              {requireAuth && (
                <div className="flex flex-wrap items-center gap-mdt-2 text-caption text-mdt-muted">
                  <span>Sign in to save this document</span>
                  <Button variant="ghost" size="xs" asChild>
                    <Link href="/signin?callbackUrl=/builder">Sign in</Link>
                  </Button>
                </div>
              )}
              {error && <p className="text-body-sm text-[color:var(--mdt-color-danger)]">Preview error: {error}</p>}
              {saveError && <p className="text-body-sm text-[color:var(--mdt-color-danger)]">Save error: {saveError}</p>}
              {hasPrivateContent && (
                <p className="rounded-mdt-sm border border-[color:var(--mdt-color-warning)]/30 bg-[color:var(--mdt-color-warning)]/10 px-mdt-2 py-mdt-1 text-caption text-[color:var(--mdt-color-warning)]">
                  Private or unlisted snippets detected — export is fine but sharing may leak non-public content.
                </p>
              )}
              {previewLoading && <p className="text-caption text-mdt-muted">Refreshing preview…</p>}
              <div
                ref={previewRef}
                className="min-h-[300px] space-y-mdt-2 rounded-mdt-md border border-mdt-border bg-mdt-surface p-mdt-4 font-mono text-body-sm shadow-mdt-sm"
              >
                {visibleLines.length === 0 && (
                  <p className="text-mdt-muted">Select a template and add snippets to see your agents.md.</p>
                )}
                {lines.map((line, idx) => {
                  const owner = lineOwner[idx];
                  const hidden = owner && owner.line !== idx && collapsed.has(owner.id);
                  if (hidden) return null;
                  const match = /^(#{1,6})\s+(.*)/.exec(line.trim());
                  if (match) {
                    const level = match[1].length;
                    const title = match[2];
                    const id = outline.find((n) => n.line === idx)?.id ?? `h-${idx}`;
                    return (
                      <div
                        key={id}
                        id={id}
                        tabIndex={-1}
                        className="font-semibold text-mdt-text"
                        style={{ marginLeft: `${(level - 1) * 8}px` }}
                      >
                        {match[1]} {title}
                      </div>
                    );
                  }
                  return (
                    <p key={`line-${idx}`} className="leading-6 text-mdt-muted">
                      {line || "\u00a0"}
                    </p>
                  );
                })}
              </div>
            </Surface>

            <Surface padding="md" className="space-y-mdt-4" data-step-anchor="outline">
              <div className="flex flex-col gap-mdt-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-h3">Outline</h3>
                <div className="flex flex-wrap gap-mdt-2">
                  <Button size="sm" variant="secondary" onClick={() => setCollapsed(new Set())}>
                    Expand all
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setCollapsed(new Set(outline.map((o) => o.id)))}>
                    Collapse all
                  </Button>
                </div>
              </div>
              {outline.length === 0 ? (
                <p className="text-body-sm text-mdt-muted">Headings will appear here once you add a template/snippet.</p>
              ) : (
                <DragDropContext onDragStart={() => setDraggingOutline(true)} onDragEnd={handleOutlineDragEnd}>
                  <Droppable droppableId="outline">
                    {(provided) => (
                      <div
                        role="tree"
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="space-y-mdt-1"
                      >
                        {outline.map((node, idx) => {
                          const isCollapsed = collapsed.has(node.id);
                          return (
                            <Draggable draggableId={node.id} index={idx} key={node.id} isDragDisabled={node.level === 1}>
                              {(drag) => (
                                <button
                                  key={node.id}
                                  role="treeitem"
                                  aria-level={node.level}
                                  aria-expanded={!isCollapsed}
                                  aria-selected="false"
                                  ref={drag.innerRef}
                                  {...drag.draggableProps}
                                  {...drag.dragHandleProps}
                                  onClick={() => {
                                    jumpTo(node.id);
                                  }}
                                  onDoubleClick={() => toggleCollapse(node.id)}
                                  className={cn(
                                    "flex w-full items-center justify-between rounded-mdt-sm px-mdt-2 py-mdt-2 text-left text-body-sm transition duration-mdt-fast ease-mdt-standard motion-reduce:transition-none",
                                    "hover:bg-[color:var(--mdt-color-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--mdt-color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mdt-color-surface)]",
                                    draggingOutline && node.level === 1 ? "opacity-80" : ""
                                  )}
                                  style={{ paddingLeft: `${(node.level - 1) * 12 + 8}px` }}
                                >
                                  <span className="flex items-center gap-mdt-2">
                                    <span
                                      aria-hidden
                                      className={cn(
                                        "inline-flex h-5 w-5 items-center justify-center rounded-mdt-sm border border-mdt-border text-[11px]",
                                        isCollapsed ? "bg-mdt-surface-subtle" : "bg-mdt-surface-strong"
                                      )}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        toggleCollapse(node.id);
                                      }}
                                    >
                                      {isCollapsed ? "+" : "–"}
                                    </span>
                                    <span className="font-medium text-mdt-text">{node.title}</span>
                                  </span>
                                  <span className="text-caption text-mdt-muted">#{node.line + 1}</span>
                                </button>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </Surface>
          </div>
          <BuilderStatus saveState={saveState} />
        </Stack>
      </Container>
    </main>
  );
}
