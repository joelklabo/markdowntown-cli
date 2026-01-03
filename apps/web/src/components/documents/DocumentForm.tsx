"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { Surface } from "@/components/ui/Surface";
import { Stack, Row } from "@/components/ui/Stack";
import { Text } from "@/components/ui/Text";

type Doc = {
  id?: string;
  title: string;
  description?: string | null;
  renderedContent?: string | null;
  tags: string[];
};

type Props = {
  initial?: Doc;
};

export function DocumentForm({ initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [content, setContent] = useState(initial?.renderedContent ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snippets, setSnippets] = useState<Array<{ id: string; title: string; preview: string }>>([]);
  const [loadingSnippets, setLoadingSnippets] = useState(false);
  const [snippetError, setSnippetError] = useState<string | null>(null);
  const [selectedSnippet, setSelectedSnippet] = useState<string>("");

  useEffect(() => {
    async function loadSnippets() {
      setLoadingSnippets(true);
      try {
        // Prefer the signed-in user's sections so they can re-use their own snippets
        const res = await fetch("/api/sections");
        if (!res.ok) throw new Error(`Failed to load sections (${res.status})`);
        const data = (await res.json()) as Array<{ id: string; title: string; content: string }>;
        const mapped =
          data?.map((item) => ({
            id: item.id,
            title: item.title || "Untitled section",
            preview: (item.content ?? "").trim(),
          })) ?? [];
        setSnippets(mapped);
        if (mapped[0]) setSelectedSnippet(mapped[0].id);
      } catch (err) {
        setSnippetError(err instanceof Error ? err.message : "Unable to load snippets");
      } finally {
        setLoadingSnippets(false);
      }
    }
    loadSnippets();
  }, []);

  function insertSelectedSnippet() {
    const snip = snippets.find((s) => s.id === selectedSnippet);
    if (!snip) return;
    setContent((prev) => `${prev.trim()}\n\n## ${snip.title}\n\n${snip.preview}`.trim());
  }

  async function copyContent() {
    if (!content.trim()) return;
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.warn("copy failed", err);
    }
  }

  function downloadContent() {
    if (!content.trim()) return;
    try {
      const blob = new Blob([content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "agents"}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("download failed", err);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      title,
      description,
      renderedContent: content,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    const url = initial?.id ? `/api/documents/${initial.id}` : "/api/documents";
    const method = initial?.id ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Save failed");
      setSaving(false);
      return;
    }
    const data = await res.json();
    router.push(`/documents/${data.id}`);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <Surface padding="lg" className="space-y-mdt-4">
        <Stack gap={3}>
          <Stack gap={1}>
            <Text as="label" htmlFor="doc-title" size="bodySm" weight="semibold">
              Title
            </Text>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              aria-label="Document title"
            />
          </Stack>

          <Stack gap={1}>
            <Text as="label" htmlFor="doc-description" size="bodySm" weight="semibold">
              Description
            </Text>
            <TextArea
              id="doc-description"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              aria-label="Document description"
            />
          </Stack>

          <Stack gap={1}>
            <Text as="label" htmlFor="agents-md-content" size="bodySm" weight="semibold">
              agents.md content
            </Text>
            <TextArea
              id="agents-md-content"
              className="font-mono"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              aria-label="agents.md content"
            />
          </Stack>

          <Stack gap={1}>
            <Text as="label" htmlFor="doc-tags" size="bodySm" weight="semibold">
              Tags (comma separated)
            </Text>
            <Input
              id="doc-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              aria-label="Document tags"
            />
          </Stack>
        </Stack>

        {error && <Text size="bodySm" className="text-red-600">{error}</Text>}

        <Row gap={2}>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : initial?.id ? "Save changes" : "Create document"}
          </Button>
          <Button variant="secondary" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
        </Row>

        <Surface tone="subtle" padding="md" className="space-y-mdt-3">
          <Row wrap align="center" gap={2}>
            <Text as="span" size="bodySm" weight="semibold">Insert snippet</Text>
            <Select
              value={selectedSnippet}
              onChange={(e) => setSelectedSnippet(e.target.value)}
              disabled={loadingSnippets || snippets.length === 0}
              className="w-auto min-w-[180px]"
              aria-label="Choose snippet to insert"
            >
              {snippets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              size="xs"
              disabled={loadingSnippets || snippets.length === 0}
              onClick={insertSelectedSnippet}
              aria-label="Insert selected snippet into document"
            >
              Insert into document
            </Button>
            {loadingSnippets && <Text as="span" size="caption" tone="muted">Loading snippets…</Text>}
            {snippetError && <Text as="span" size="caption" className="text-red-600">{snippetError}</Text>}
          </Row>
          <Row wrap gap={2}>
            <Button type="button" variant="secondary" size="xs" onClick={copyContent} disabled={!content.trim()} aria-label="Copy document markdown">
              Copy markdown
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={downloadContent} disabled={!content.trim()} aria-label="Download document markdown">
              Download .md
            </Button>
          </Row>
        </Surface>
      </Surface>
    </form>
  );
}
