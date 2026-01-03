import type { Metadata } from "next";

const colors = [
  { name: "Primary", varName: "--mdt-color-primary" },
  { name: "Primary Strong", varName: "--mdt-color-primary-strong" },
  { name: "Primary Soft", varName: "--mdt-color-primary-soft" },
  { name: "Accent", varName: "--mdt-color-accent" },
  { name: "Accent Soft", varName: "--mdt-color-accent-soft" },
  { name: "Success", varName: "--mdt-color-success" },
  { name: "Success Soft", varName: "--mdt-color-success-soft" },
  { name: "Warning", varName: "--mdt-color-warning" },
  { name: "Warning Soft", varName: "--mdt-color-warning-soft" },
  { name: "Danger", varName: "--mdt-color-danger" },
  { name: "Danger Soft", varName: "--mdt-color-danger-soft" },
  { name: "Info", varName: "--mdt-color-info" },
  { name: "Info Soft", varName: "--mdt-color-info-soft" },
  { name: "Surface", varName: "--mdt-color-surface" },
  { name: "Surface Subtle", varName: "--mdt-color-surface-subtle" },
  { name: "Surface Strong", varName: "--mdt-color-surface-strong" },
  { name: "Surface Raised", varName: "--mdt-color-surface-raised" },
  { name: "Border", varName: "--mdt-color-border" },
  { name: "Border Strong", varName: "--mdt-color-border-strong" },
  { name: "Ring", varName: "--mdt-color-ring" },
  { name: "Text", varName: "--mdt-color-text" },
  { name: "Muted", varName: "--mdt-color-text-muted" },
  { name: "Text Subtle", varName: "--mdt-color-text-subtle" },
  { name: "Text on Strong", varName: "--mdt-color-text-on-strong" },
];

const shadows = [
  { name: "Shadow SM", varName: "--mdt-shadow-sm" },
  { name: "Shadow MD", varName: "--mdt-shadow-md" },
  { name: "Shadow LG", varName: "--mdt-shadow-lg" },
  { name: "Shadow Glow", varName: "--mdt-shadow-glow" },
  { name: "Shadow Focus", varName: "--mdt-shadow-focus" },
];

const radii = [
  { name: "Radius sm", token: "var(--radius-sm, 6px)" },
  { name: "Radius md", token: "var(--radius-md, 10px)" },
  { name: "Radius lg", token: "var(--radius-lg, 16px)" },
  { name: "Radius pill", token: "var(--radius-pill, 999px)" },
];

const typography = [
  {
    name: "Display",
    className: "text-display font-display",
    size: "--mdt-type-display-size",
    lineHeight: "--mdt-type-display-lh",
  },
  {
    name: "H1",
    className: "text-h1 font-display",
    size: "--mdt-type-h1-size",
    lineHeight: "--mdt-type-h1-lh",
  },
  {
    name: "H2",
    className: "text-h2 font-display",
    size: "--mdt-type-h2-size",
    lineHeight: "--mdt-type-h2-lh",
  },
  {
    name: "H3",
    className: "text-h3 font-display",
    size: "--mdt-type-h3-size",
    lineHeight: "--mdt-type-h3-lh",
  },
  {
    name: "Body",
    className: "text-body",
    size: "--mdt-type-body-size",
    lineHeight: "--mdt-type-body-lh",
  },
  {
    name: "Body Small",
    className: "text-body-sm",
    size: "--mdt-type-body-sm-size",
    lineHeight: "--mdt-type-body-sm-lh",
  },
  {
    name: "Caption",
    className: "text-caption uppercase tracking-wide",
    size: "--mdt-type-caption-size",
    lineHeight: "--mdt-type-caption-lh",
  },
];

const spacing = [
  { name: "Space 0", varName: "--mdt-space-0" },
  { name: "Space 1", varName: "--mdt-space-1" },
  { name: "Space 2", varName: "--mdt-space-2" },
  { name: "Space 3", varName: "--mdt-space-3" },
  { name: "Space 4", varName: "--mdt-space-4" },
  { name: "Space 5", varName: "--mdt-space-5" },
  { name: "Space 6", varName: "--mdt-space-6" },
  { name: "Space 8", varName: "--mdt-space-8" },
  { name: "Space 10", varName: "--mdt-space-10" },
  { name: "Space 12", varName: "--mdt-space-12" },
  { name: "Space 13", varName: "--mdt-space-13" },
  { name: "Space 14", varName: "--mdt-space-14" },
  { name: "Space 15", varName: "--mdt-space-15" },
  { name: "Space 16", varName: "--mdt-space-16" },
];

const motion = [
  { name: "Fast", varName: "--mdt-motion-fast", note: "Micro transitions" },
  { name: "Base", varName: "--mdt-motion-base", note: "Buttons + inputs" },
  { name: "Slow", varName: "--mdt-motion-slow", note: "Panels + overlays" },
  { name: "Enter", varName: "--mdt-motion-enter", note: "Entrance animations" },
  { name: "Exit", varName: "--mdt-motion-exit", note: "Exit animations" },
  { name: "Ease Standard", varName: "--mdt-motion-ease-standard", note: "Default easing" },
  { name: "Ease Emphasized", varName: "--mdt-motion-ease-emphasized", note: "Large motions" },
  { name: "Ease Snappy", varName: "--mdt-motion-ease-snappy", note: "Micro interactions" },
];

export const metadata: Metadata = {
  title: "Design tokens · mark downtown",
  description: "Audit view for MDT design tokens (colors, shadows, radii, typography, spacing, motion).",
};

const themeRefreshFlag = process.env.NEXT_PUBLIC_THEME_REFRESH_V1 ?? "";
const themeRefreshEnabled = themeRefreshFlag === "1" || themeRefreshFlag.toLowerCase() === "true";
const themeRefreshLabel = themeRefreshEnabled ? "Theme refresh: ON" : "Theme refresh: OFF";

function ColorSwatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface p-3 shadow-mdt-sm flex items-center gap-3">
      <div
        className="h-10 w-14 rounded-mdt-md border border-mdt-border"
        style={{ backgroundColor: `var(${varName})` }}
      />
      <div className="text-body">
        <div className="font-semibold text-mdt-text">{name}</div>
        <div className="text-caption text-mdt-muted">{varName}</div>
      </div>
    </div>
  );
}

function ShadowSwatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface p-4 shadow-mdt-sm">
      <div
        className="h-12 w-full rounded-mdt-md bg-mdt-surface-subtle"
        style={{ boxShadow: `var(${varName})` }}
      />
      <div className="mt-3 font-semibold text-mdt-text">{name}</div>
      <div className="text-caption text-mdt-muted">{varName}</div>
    </div>
  );
}

function RadiusSwatch({ name, token }: { name: string; token: string }) {
  return (
    <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface p-4 shadow-mdt-sm">
      <div className="h-12 w-full bg-mdt-surface-subtle border border-mdt-border" style={{ borderRadius: token }} />
      <div className="mt-3 font-semibold text-mdt-text">{name}</div>
      <div className="text-caption text-mdt-muted">{token}</div>
    </div>
  );
}

function TypeSample({
  name,
  className,
  size,
  lineHeight,
}: {
  name: string;
  className: string;
  size: string;
  lineHeight: string;
}) {
  return (
    <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface p-4 shadow-mdt-sm space-y-2">
      <div className="text-caption text-mdt-muted">{name}</div>
      <div className={className}>The quick brown fox jumps.</div>
      <div className="text-caption text-mdt-muted">
        {size} · {lineHeight}
      </div>
    </div>
  );
}

function SpacingSwatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface p-4 shadow-mdt-sm space-y-2">
      <div className="text-caption text-mdt-muted">{name}</div>
      <div className="h-2 rounded-mdt-pill bg-mdt-surface-strong" style={{ width: `var(${varName})` }} />
      <div className="text-caption text-mdt-muted">{varName}</div>
    </div>
  );
}

function MotionSwatch({ name, varName, note }: { name: string; varName: string; note: string }) {
  return (
    <div className="rounded-mdt-md border border-mdt-border bg-mdt-surface p-4 shadow-mdt-sm space-y-2">
      <div className="font-semibold text-mdt-text">{name}</div>
      <div className="text-caption text-mdt-muted">{note}</div>
      <div className="text-caption text-mdt-muted">{varName}</div>
    </div>
  );
}

export default function TokensPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-10">
      <header className="space-y-2">
        <p className="text-caption text-mdt-muted">Design System</p>
        <h1 className="text-h1 font-display text-mdt-text">Core design tokens</h1>
        <p className="text-body text-mdt-muted max-w-3xl">
          Single source of truth for color, shadow, radius, typography, spacing, and motion tokens. Values are sourced
          from CSS custom properties so updates cascade across Tailwind and components.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-caption">
          <span className="inline-flex items-center rounded-mdt-pill border border-mdt-border bg-mdt-surface-subtle px-mdt-3 py-1 text-mdt-text">
            {themeRefreshLabel}
          </span>
          <span className="text-mdt-muted">Toggle with `NEXT_PUBLIC_THEME_REFRESH_V1=1` and restart dev.</span>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="text-h2 font-display text-mdt-text">Typography</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {typography.map((item) => (
            <TypeSample
              key={item.name}
              name={item.name}
              className={item.className}
              size={item.size}
              lineHeight={item.lineHeight}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-h2 font-display text-mdt-text">Colors</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {colors.map((c) => (
            <ColorSwatch key={c.varName} name={c.name} varName={c.varName} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-h2 font-display text-mdt-text">Spacing</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {spacing.map((s) => (
            <SpacingSwatch key={s.varName} name={s.name} varName={s.varName} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-h2 font-display text-mdt-text">Shadows</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {shadows.map((s) => (
            <ShadowSwatch key={s.varName} name={s.name} varName={s.varName} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-h2 font-display text-mdt-text">Radii</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {radii.map((r) => (
            <RadiusSwatch key={r.name} name={r.name} token={r.token} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-h2 font-display text-mdt-text">Motion</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {motion.map((m) => (
            <MotionSwatch key={m.varName} name={m.name} varName={m.varName} note={m.note} />
          ))}
        </div>
      </section>
    </div>
  );
}
