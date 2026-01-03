import Link from "next/link";

type Segment = { href?: string; label: string };

export function Breadcrumb({ segments }: { segments: Segment[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-mdt-2 text-body-sm text-mdt-muted">
        {segments.map((seg, idx) => {
          const isLast = idx === segments.length - 1;
          return (
            <li key={`${seg.label}-${idx}`} className="flex items-center gap-2">
              {seg.href && !isLast ? (
                <Link href={seg.href} className="hover:text-mdt-text hover:underline">
                  {seg.label}
                </Link>
              ) : (
                <span className="text-mdt-text" aria-current={isLast ? "page" : undefined}>
                  {seg.label}
                </span>
              )}
              {!isLast && <span aria-hidden>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
