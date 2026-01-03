import { useCallback, useEffect, useState } from "react";
import { track } from "@/lib/analytics";

type BuilderStoreArgs = {
  initialTemplateId: string | null;
  initialSnippetIds: string[];
};

export function useBuilderStore({ initialTemplateId, initialSnippetIds }: BuilderStoreArgs) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(initialTemplateId);
  const [selectedSnippets, setSelectedSnippets] = useState<string[]>(initialSnippetIds);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [rendered, setRendered] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPrivateContent, setHasPrivateContent] = useState(false);

  useEffect(() => {
    if (!selectedTemplate && selectedSnippets.length === 0) {
      setRendered("");
      setHasPrivateContent(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/builder/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: selectedTemplate,
            snippetIds: selectedSnippets,
            overrides,
          }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error ?? `Preview failed (${res.status})`);
        }
        setRendered(typeof data.rendered === "string" ? data.rendered : "");
        setHasPrivateContent(Boolean(data.hasPrivateContent));
        setError(null);
        track("builder_preview_success", {
          templateId: selectedTemplate,
          snippetCount: selectedSnippets.length,
          hasPrivateContent: Boolean(data.hasPrivateContent),
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Preview failed");
        track("builder_preview_error", {
          templateId: selectedTemplate,
          snippetCount: selectedSnippets.length,
          message: err instanceof Error ? err.message : "unknown",
        });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selectedTemplate, selectedSnippets, overrides]);

  const toggleSnippet = useCallback((id: string) => {
    setSelectedSnippets((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      track(prev.includes(id) ? "builder_snippet_removed" : "builder_snippet_added", {
        snippetId: id,
        position: next.indexOf(id),
        total: next.length,
      });
      setOverrides((curr) => {
        if (next.includes(id)) return curr;
        const copy = { ...curr };
        delete copy[id];
        return copy;
      });
      return next;
    });
  }, []);

  const moveSnippet = useCallback((id: string, dir: -1 | 1) => {
    setSelectedSnippets((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
       track("builder_snippet_reordered", { snippetId: id, from: idx, to: target });
      return next;
    });
  }, []);

  const setOverride = useCallback((id: string, value: string) => {
    setOverrides((prev) => ({ ...prev, [id]: value }));
    track("builder_override_changed", { snippetId: id, hasValue: Boolean(value.trim()) });
  }, []);

  const reorderSnippets = useCallback((from: number, to: number) => {
    setSelectedSnippets((prev) => {
      if (from < 0 || to < 0 || from >= prev.length || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      track("builder_snippet_reordered", { snippetId: moved, from, to });
      return next;
    });
  }, []);

  return {
    selectedTemplate,
    setSelectedTemplate,
    selectedSnippets,
    toggleSnippet,
    moveSnippet,
    reorderSnippets,
    overrides,
    setOverride,
    rendered,
    loading,
    error,
    hasPrivateContent,
  };
}
