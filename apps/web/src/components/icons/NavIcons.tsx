import type { SVGProps } from "react";

export type NavIconProps = SVGProps<SVGSVGElement>;

function baseProps(props: NavIconProps): NavIconProps {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
    ...props,
  };
}

export function LibraryIcon(props: NavIconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M2 4h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 4h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

export function WorkbenchIcon(props: NavIconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M14.7 6.3a5 5 0 0 0-6.6 6.6L3 18.1a2 2 0 0 0 2.8 2.8l5.2-5.2a5 5 0 0 0 6.6-6.6l-3.2 3.2-2.8-2.8z" />
    </svg>
  );
}

export function TranslateIcon(props: NavIconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15 15 0 0 1 0 20" />
      <path d="M12 2a15 15 0 0 0 0 20" />
    </svg>
  );
}

export function AtlasIcon(props: NavIconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M14.5 9.5 9 15l6-1.5z" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
    </svg>
  );
}

export function SearchIcon(props: NavIconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function MenuIcon(props: NavIconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}
