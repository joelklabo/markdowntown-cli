"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Pluggable } from "unified";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { normalizeTags, TAG_MAX_COUNT, TAG_MAX_LENGTH } from "@/lib/tags";

const ReactMarkdown = dynamic(() => import("react-markdown"), {
  loading: () => <p className="text-sm text-zinc-500">Loading preview…</p>,
});

type Section = {
  id: string;
  title: string;
  content: string;
  order: number;
  tags: string[];
};

const emptySelection: Section = {
  id: "",
  title: "",
  content: "",
  order: 0,
  tags: [],
};

export function SectionComposer() {
  const [sections, setSections] = useState<Section[]>([]);
  const [selected, setSelected] = useState<Section | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const [remarkGfm, setRemarkGfm] = useState<Pluggable | null>(null);
  const [rehypeSanitize, setRehypeSanitize] = useState<Pluggable | null>(null);
  const selectedRef = useRef<Section | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    void import("remark-gfm")
      .then((mod) => {
        const plugin =
          (mod as { default?: Pluggable }).default ?? (mod as unknown as Pluggable);
        setRemarkGfm(plugin);
      })
      .catch(() => setRemarkGfm(null));
    import("rehype-sanitize")
      .then((mod) => setRehypeSanitize((mod as { default?: Pluggable }).default ?? (mod as unknown as Pluggable)))
      .catch(() => setRehypeSanitize(null));
  }, []);

  const combinedMarkdown = useMemo(() => {
    return sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => s.content || `# ${s.title || "Untitled"}`)
      .join("\n\n");
  }, [sections]);

  useEffect(() => {
    loadSections();
  }, []);

  useEffect(() => {
    setTagInput((selected?.tags ?? []).join(", "));
    setTagError(null);
  }, [selected?.id, selected?.tags]);

  async function loadSections() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sections");
      if (!res.ok) {
        throw new Error(`Failed to load sections (${res.status})`);
      }
      const raw = (await res.json()) as Section[];
      const normalized = raw.map((section) => ({
        ...section,
        tags: normalizeTags((section as { tags?: unknown }).tags, { strict: false }).tags,
      }));
      setSections(normalized);
      selectedRef.current = normalized[0] ?? null;
      setSelected(normalized[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load sections");
    } finally {
      setLoading(false);
    }
  }

  async function createSection() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled section",
          content: "",
        }),
      });
      if (!res.ok) throw new Error("Could not create section");
      const created: Section = await res.json();
      const normalized = { ...created, tags: normalizeTags(created.tags, { strict: false }).tags };
      setSections((prev) => [...prev, normalized]);
      selectedRef.current = normalized;
      setSelected(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveSection(next: Section) {
    if (!next.id) return;
    setSaving(true);
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch(`/api/sections/${next.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: next.title,
          content: next.content,
          tags: next.tags ?? [],
        }),
      });
      if (!res.ok) throw new Error("Could not save section");
      const updated: Section = await res.json();
      const normalized = { ...updated, tags: normalizeTags(updated.tags, { strict: false }).tags };
      setSections((prev) => prev.map((s) => (s.id === normalized.id ? normalized : s)));
      selectedRef.current = normalized;
      setSelected(normalized);
      setTagInput(normalized.tags.join(", "));
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setStatus("idle");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSection(id: string) {
    if (!id) return;
    if (!window.confirm("Delete this section? This cannot be undone.")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sections/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete section");
      setSections((prev) => prev.filter((s) => s.id !== id));
      setSelected((prev) => (prev?.id === id ? null : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  function updateSelected(partial: Partial<Section>) {
    setSelected((prev) => {
      const next = { ...(prev ?? emptySelection), ...partial };
      selectedRef.current = next;
      setSections((existing) =>
        existing.map((s) => (s.id === next.id ? next : s))
      );
      return next;
    });
  }

  function handleTagsChange(value: string) {
    let tokens = value
      .split(/[,\n]/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    // If the user appended text without a comma, try to split using the existing first tag.
    if (tokens.length === 1 && selected?.tags?.[0]) {
      const first = selected.tags[0];
      const remainder = value.slice(first.length).trim();
      if (remainder) {
        tokens = [first, remainder];
      }
    }

    const { tags, error: tagsError } = normalizeTags(tokens);
    if (tagsError) {
      setTagError(tagsError);
      setTagInput(value);
      return;
    }

    setTagError(null);
    setTagInput(tags.join(", "));
    if (selected) {
      updateSelected({ tags });
    }
  }

const panelClass =
  "composer-panel rounded-2xl border border-mdt-border bg-mdt-surface shadow-mdt-sm transition duration-mdt-base ease-mdt-emphasized hover:shadow-mdt-md focus-within:border-mdt-primary-strong focus-within:shadow-mdt-md";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-mdt-lg border border-mdt-border bg-mdt-surface px-4 py-3 shadow-mdt-sm">
        <div className="flex items-center gap-2 text-sm text-mdt-muted">
          <Badge tone={status === "saving" ? "info" : status === "saved" ? "success" : "neutral"}>
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Idle"}
          </Badge>
          <Badge tone="info">Outline · Editor · Preview</Badge>
          <Badge tone="primary">Cmd/Ctrl+S saves</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={loadSections} disabled={isLoading || saving}>
            Refresh
          </Button>
          <Button size="sm" onClick={createSection} disabled={saving} aria-label="Add a new section">
            New section
          </Button>
        </div>
      </div>

      <div className="composer-grid grid grid-cols-1 gap-6 lg:grid-cols-[320px_1.1fr_1.1fr]">
        <div className={panelClass} aria-live="polite" aria-busy={isLoading}>
          <div className="flex items-center justify-between border-b border-mdt-border px-4 py-3">
            <h2 className="text-sm font-semibold text-mdt-text">Outline</h2>
            <Button onClick={createSection} disabled={saving} size="sm" aria-label="Add a new section">
              Add
            </Button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-2 py-2" role="list">
            {isLoading && (
              <p className="px-2 py-2 text-sm text-mdt-muted" role="status">
                Loading...
              </p>
            )}
            {!isLoading && sections.length === 0 && (
              <p className="px-2 py-2 text-sm text-mdt-muted">No sections yet. Create your first one.</p>
            )}
            {sections.map((section, idx) => (
              <div role="listitem" key={section.id}>
                <button
                  onClick={() => setSelected(section)}
                  style={{ transitionDelay: `${idx * 15}ms` }}
                  aria-current={selected?.id === section.id}
                  className={`group mb-2 flex w-full items-start justify-between rounded-xl px-3 py-2 text-left transition duration-mdt-fast ease-mdt-emphasized focus:outline-none focus-visible:ring-2 focus-visible:ring-mdt-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mdt-color-surface)] ${
                    selected?.id === section.id
                      ? "bg-mdt-primary-soft text-mdt-text"
                      : "hover:bg-mdt-surface-subtle"
                  }`}
                >
                  <span className="truncate text-sm font-medium">{section.title || "Untitled"}</span>
                  <span className="text-[11px] text-mdt-muted" aria-label={`Order ${section.order}`}>
                    #{section.order}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={panelClass} aria-busy={saving}>
          <div className="flex items-center justify-between border-b border-mdt-border px-4 py-3">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-mdt-text">Editor</span>
              <span className="text-xs text-mdt-muted">Live markdown saves to your Section</span>
            </div>
            {selected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteSection(selected.id)}
                disabled={saving}
                aria-label={`Delete section ${selected.title || selected.id}`}
                className="text-mdt-text"
              >
                Delete
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-3 px-4 py-4">
            <input
              type="text"
              placeholder="Section title"
              value={selected?.title ?? ""}
              onChange={(e) => updateSelected({ title: e.target.value ?? "Untitled section" })}
              onBlur={() => selectedRef.current && saveSection(selectedRef.current)}
              disabled={!selected}
              className="w-full rounded-lg border border-mdt-border bg-mdt-surface-subtle px-3 py-2 text-sm focus:border-mdt-ring focus:outline-none focus:ring-2 focus:ring-mdt-ring disabled:cursor-not-allowed disabled:bg-mdt-surface"
            />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-mdt-text" htmlFor="section-tags">
                Tags (comma separated)
              </label>
              <input
                id="section-tags"
                type="text"
                placeholder="system, tools, style"
                value={tagInput}
                onChange={(e) => handleTagsChange(e.target.value)}
                onBlur={() => selectedRef.current && !tagError && saveSection(selectedRef.current)}
                disabled={!selected}
                className="w-full rounded-lg border border-mdt-border bg-mdt-surface-subtle px-3 py-2 text-sm focus:border-mdt-ring focus:outline-none focus:ring-2 focus:ring-mdt-ring disabled:cursor-not-allowed disabled:bg-mdt-surface"
              />
              <div className="flex items-center justify-between text-[11px] text-mdt-muted">
                <span>
                  Lowercase & kebab-case enforced. Max {TAG_MAX_COUNT} tags, {TAG_MAX_LENGTH} chars each.
                </span>
                <span>
                  {selected?.tags?.length ?? 0}/{TAG_MAX_COUNT}
                </span>
              </div>
              {tagError && (
                <p className="text-xs font-semibold text-mdt-danger" role="alert">
                  {tagError}
                </p>
              )}
            </div>
            <textarea
              placeholder="Write markdown here..."
              value={selected?.content ?? ""}
              onChange={(e) => updateSelected({ content: e.target.value })}
              onBlur={() => selected && saveSection(selected)}
              disabled={!selected}
              rows={18}
              className="w-full rounded-lg border border-mdt-border bg-mdt-surface-subtle px-3 py-2 text-sm font-mono focus:border-mdt-ring focus:outline-none focus:ring-2 focus:ring-mdt-ring disabled:cursor-not-allowed disabled:bg-mdt-surface"
            />
            {error && (
              <p className="text-sm font-medium text-mdt-danger" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className={panelClass}>
          <div className="flex items-center justify-between border-b border-mdt-border px-4 py-3">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-mdt-text">Preview</span>
              <span className="text-xs text-mdt-muted">Rendered Markdown</span>
            </div>
          </div>
          <div className="markdown-preview px-4 py-4 max-h-[70vh] overflow-y-auto">
            {combinedMarkdown ? (
              <ReactMarkdown
                remarkPlugins={remarkGfm ? [remarkGfm] : undefined}
                rehypePlugins={rehypeSanitize ? [rehypeSanitize] : undefined}
              >
                {combinedMarkdown}
              </ReactMarkdown>
            ) : (
              <p className="text-sm text-mdt-muted">Start typing to see a preview.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
