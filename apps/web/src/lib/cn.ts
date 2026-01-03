export function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mdt-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mdt-color-surface)]";

export const interactiveBase =
  "transition duration-mdt-fast ease-mdt-emphasized disabled:opacity-60 disabled:cursor-not-allowed";
