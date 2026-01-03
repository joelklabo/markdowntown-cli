# Command Palette & Shortcuts

## Shortcut
- `Cmd/Ctrl + K`: open palette globally (registered in `CommandPalette`).
- `Cmd/Ctrl + L`: toggle theme (handled inside palette as an action).
- `/` (while not in an input): opens search (nav search sheet) and is listed as an action in palette.

## Default commands (computed in `src/components/CommandPalette.tsx`)
- Go to home `/`
- Browse library `/browse` (hint: ⌘B)
- Open builder `/builder` (hint: ⌘⇧B)
- View templates `/templates`
- Docs `/docs`
- Toggle theme (light/dark)
- Open search (routes to browse)
- Consumer-provided suggestions via `suggestions` prop merged in by group.

## UX notes
- Overlay uses `mdt-overlay` token; surface/strong tokens provide contrast in both themes.
- Keyboard: Up/Down to navigate, Enter to run, Esc to close; focus remains in input for fast filtering.
- Groups are rendered with dividers for scanability; active row has elevated shadow and uses strong surface color.

## Future enhancements
- Inject contextual actions (copy link, share, export) based on current page.
- Add fuzzy matching and keyboard shortcut hints per command.
- Add analytics dashboard for palette usage (currently emits `command_palette_open` and `command_palette_run`).
