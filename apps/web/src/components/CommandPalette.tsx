"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogOverlay, DialogTitle } from "@radix-ui/react-dialog";
import { Input } from "@/components/ui/Input";
import { Kbd } from "@/components/ui/Kbd";
import { searchAtlasPaletteHits } from "@/lib/atlas/searchIndex";
import { cn, interactiveBase } from "@/lib/cn";
import { track } from "@/lib/analytics";
import { useTheme } from "@/providers/ThemeProvider";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";
import { emitCityWordmarkEvent } from "@/components/wordmark/sim/bridge";

export const COMMAND_PALETTE_OPEN_EVENT = "mdt:command-palette-open";

type CommandItem = {
  label: string;
  hint?: string;
  action: () => void;
  group: "Go to" | "Templates" | "Snippets" | "Files" | "Actions" | "Workbench";
  closeOnRun?: boolean;
};

type PaletteProps = {
  suggestions?: CommandItem[];
};

function isShortcutHint(value: string): boolean {
  const hint = value.trim();
  if (!hint) return false;
  const lower = hint.toLowerCase();
  if (lower === "esc" || lower === "enter" || lower === "tab") return true;
  if (hint === "/") return true;
  if (hint.includes("⌘") || hint.includes("⇧") || hint.toLowerCase().includes("ctrl") || hint.toLowerCase().includes("alt")) return true;
  return false;
}

export function CommandPalette({ suggestions = [] }: PaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const uam = useWorkbenchStore((s) => s.uam);
  const resetDraft = useWorkbenchStore((s) => s.resetDraft);
  const selectScope = useWorkbenchStore((s) => s.selectScope);
  const selectBlock = useWorkbenchStore((s) => s.selectBlock);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    function handleOpen(event: Event) {
      const detail = (event as CustomEvent<{ origin?: string }>).detail;
      const origin = detail?.origin ?? "entry_point";
      setOpen(true);
      setHighlight(0);
      setQuery("");
      track("command_palette_open", { origin });
      emitCityWordmarkEvent({ type: "command_palette_open", origin });
    }

    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, handleOpen as EventListener);
    return () => window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, handleOpen as EventListener);
  }, []);

  const commands = useMemo(() => {
    const inWorkbench = pathname.startsWith("/workbench");
    const rawQuery = query.trim();
    const lowerQuery = rawQuery.toLowerCase();
    const atlasPrefix = lowerQuery.startsWith("atlas:") ? "atlas:" : lowerQuery.startsWith("atlas ") ? "atlas " : null;

    if (atlasPrefix) {
      const atlasQuery = rawQuery.slice(atlasPrefix.length).trim();
      const hits = atlasQuery ? searchAtlasPaletteHits(atlasQuery) : [];

      const atlasCommands: CommandItem[] = [
        {
          label: "Back to commands",
          hint: "Esc",
          group: "Go to",
          closeOnRun: false,
          action: () => {
            setQuery("");
            setHighlight(0);
          },
        },
        ...hits.map(
          (hit): CommandItem => ({
            label: hit.label,
            hint: hit.hint,
            group: "Go to",
            action: () => router.push(hit.href),
          })
        ),
      ];

      return atlasCommands;
    }

    const blockCommands: CommandItem[] = inWorkbench
      ? uam.blocks.map((block) => {
          const title = block.title?.trim();
          const preview = title && title.length > 0 ? title : (block.body.trim().split("\n")[0] ?? "(empty)");
          const label = `Open block: ${preview.length > 80 ? `${preview.slice(0, 77)}…` : preview}`;
          return {
            label,
            group: "Workbench",
            hint: "⌘P",
            action: () => {
              selectScope(block.scopeId);
              selectBlock(block.id);
              router.push("/workbench");
            },
          };
        })
      : [];

    const baseCommands: CommandItem[] = [
      { label: "Go to home", action: () => router.push("/"), group: "Go to" },
      { label: "Browse library", action: () => router.push("/library"), group: "Go to", hint: "⌘B" },
      { label: "Browse skills", action: () => router.push("/skills"), group: "Go to" },
      { label: "Skills: Codex CLI", action: () => router.push("/skills?target=agents-md"), group: "Go to" },
      { label: "Skills: Copilot CLI", action: () => router.push("/skills?target=github-copilot"), group: "Go to" },
      { label: "Skills: Claude Code", action: () => router.push("/skills?target=claude-code"), group: "Go to" },
      { label: "Open workbench", action: () => router.push("/workbench"), group: "Go to", hint: "⌘Shift+B" },
      {
        label: "Search Atlas…",
        hint: "Atlas",
        group: "Go to",
        closeOnRun: false,
        action: () => {
          setHighlight(0);
          setQuery("atlas ");
        },
      },
      { label: "Translate (paste)", action: () => router.push("/translate"), group: "Go to" },
      { label: "View templates", action: () => router.push("/library?type=template"), group: "Templates" },
      { label: "Docs", action: () => router.push("/docs"), group: "Go to" },
      {
        label: "Create new artifact",
        action: () => {
          emitCityWordmarkEvent({ type: "publish", kind: "artifact" });
          resetDraft();
          router.push("/workbench");
        },
        group: "Actions",
      },
      {
        label: "Export zip",
        action: () => {
          emitCityWordmarkEvent({ type: "publish", kind: "file" });
          router.push("/workbench");
        },
        group: "Actions",
        hint: "⌘⇧E",
      },
      {
        label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        action: toggle,
        group: "Actions",
        hint: "⌘L",
      },
      { label: "Open search", action: () => router.push("/library"), group: "Actions", hint: "/" },
    ];
    const q = lowerQuery;
    const merged = [...suggestions, ...blockCommands, ...baseCommands];
    if (!q) return merged;
    return merged.filter((cmd) => cmd.label.toLowerCase().includes(q));
  }, [pathname, query, resetDraft, router, selectBlock, selectScope, suggestions, theme, toggle, uam.blocks]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = /mac/i.test(navigator.userAgent);
      const key = e.key.toLowerCase();
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      const cmdK = modKey && key === "k";
      const cmdP = modKey && key === "p";
      const cmdShiftE = modKey && e.shiftKey && key === "e";
      const cmdS = modKey && key === "s";

      if (cmdK) {
        e.preventDefault();
        setOpen(true);
        setHighlight(0);
        setQuery("");
        track("command_palette_open", { origin: "keyboard" });
        emitCityWordmarkEvent({ type: "command_palette_open", origin: "keyboard" });
        return;
      }

      if (cmdP && pathname.startsWith("/workbench")) {
        e.preventDefault();
        setOpen(true);
        setHighlight(0);
        setQuery("open block");
        track("workbench_shortcut", { shortcut: "cmd_p", action: "open_block" });
        emitCityWordmarkEvent({ type: "command_palette_open", origin: "cmd_p" });
        return;
      }

      if (cmdShiftE) {
        e.preventDefault();
        setOpen(true);
        setHighlight(0);
        setQuery("export");
        track("workbench_shortcut", { shortcut: "cmd_shift_e", action: "export" });
        emitCityWordmarkEvent({ type: "command_palette_open", origin: "cmd_shift_e" });
        return;
      }

      if (cmdS && pathname.startsWith("/workbench")) {
        e.preventDefault();
        useWorkbenchStore.setState({ autosaveStatus: "saved", lastSavedAt: Date.now() });
        track("workbench_shortcut", { shortcut: "cmd_s", action: "save_draft" });
        return;
      }

      if (!open) return;
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, commands.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const safeIndex = Math.min(highlight, Math.max(commands.length - 1, 0));
        const cmd = commands[safeIndex];
        if (cmd) {
          cmd.action();
          track("command_palette_run", { label: cmd.label });
          if (cmd.closeOnRun !== false) setOpen(false);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, commands, highlight, pathname]);

  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    commands.forEach((cmd) => {
      groups[cmd.group] = groups[cmd.group] ? [...groups[cmd.group], cmd] : [cmd];
    });
    return groups;
  }, [commands]);

  return (
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogOverlay className="mdt-radix-overlay fixed inset-0 z-50 bg-[color:var(--mdt-color-overlay)] backdrop-blur-sm" />
      <DialogContent
        className="mdt-radix-panel-scale fixed left-1/2 top-24 z-50 w-[90vw] max-w-2xl -translate-x-1/2 rounded-mdt-lg border border-mdt-border-strong bg-mdt-surface-raised p-mdt-4 shadow-mdt-lg"
        aria-label="Command palette"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">Search commands and run actions.</DialogDescription>
        <Input
          data-cmd-input
          autoFocus
          placeholder="Type a command or search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-mdt-3 max-h-[60vh] overflow-auto rounded-mdt-md border border-mdt-border bg-mdt-surface">
          {commands.length === 0 && (
            <div className="p-mdt-4 text-body-sm text-mdt-muted">No matches.</div>
          )}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="border-b border-mdt-border last:border-none">
              <div className="px-mdt-3 py-mdt-2 text-caption text-mdt-muted">{group}</div>
              {items.map((item, idx) => {
                const absoluteIndex = commands.indexOf(item);
                const currentHighlight = Math.min(highlight, Math.max(commands.length - 1, 0));
                const active = absoluteIndex === currentHighlight;
                return (
                  <button
                    key={item.label + idx}
                    type="button"
                    onMouseEnter={() => setHighlight(absoluteIndex)}
                    onClick={() => {
                      item.action();
                      track("command_palette_run", { label: item.label });
                      if (item.closeOnRun !== false) setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-mdt-3 py-mdt-2 text-left text-body-sm",
                      interactiveBase,
                      active
                        ? "bg-[color:var(--mdt-color-surface-strong)] text-mdt-text shadow-mdt-sm"
                        : "text-mdt-text hover:bg-mdt-surface-subtle"
                    )}
                  >
                    <span>{item.label}</span>
                    {item.hint ? (
                      isShortcutHint(item.hint) ? (
                        <Kbd className="text-mdt-muted shadow-none">{item.hint}</Kbd>
                      ) : (
                        <span className="text-caption text-mdt-muted">{item.hint}</span>
                      )
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-mdt-3 flex justify-between text-caption text-mdt-muted">
          <span>Use ↑ ↓ to navigate, Enter to run</span>
          <span>Esc to close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
