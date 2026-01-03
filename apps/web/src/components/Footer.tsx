import Link from "next/link";
import { Container } from "./ui/Container";
import { Text } from "./ui/Text";

export function Footer() {
  return (
    <footer className="mt-mdt-16 border-t border-mdt-border-strong bg-mdt-surface-raised py-mdt-12 text-body-sm text-mdt-muted">
      <Container as="div" padding="lg" className="grid gap-mdt-10 md:grid-cols-[minmax(0,1.1fr),minmax(0,2fr)]">
        <div className="space-y-mdt-3">
          <Text as="p" weight="semibold" tone="default">
            mark downtown
          </Text>
          <Text as="p" tone="muted" className="max-w-xl leading-relaxed">
            Compose, remix, and preview reusable markdown sections for your AI agents.
          </Text>
          <Text as="p" size="caption" tone="muted">
            Built for clear, consistent instruction workflows.
          </Text>
        </div>
        <nav className="grid gap-mdt-8 sm:grid-cols-2 lg:grid-cols-3" aria-label="Footer">
          <div className="space-y-mdt-2">
            <Text as="p" size="caption" weight="semibold" tone="muted" className="uppercase tracking-[0.24em]">
              Product
            </Text>
            <div className="flex flex-col gap-mdt-2 text-body-sm text-mdt-muted">
              <Link className="transition-colors duration-mdt-fast ease-mdt-standard hover:text-mdt-text" href="/atlas/simulator">
                Scan
              </Link>
              <Link className="transition-colors duration-mdt-fast ease-mdt-standard hover:text-mdt-text" href="/workbench">
                Workbench
              </Link>
              <Link className="transition-colors duration-mdt-fast ease-mdt-standard hover:text-mdt-text" href="/library">
                Library
              </Link>
              <Link className="transition-colors duration-mdt-fast ease-mdt-standard hover:text-mdt-text" href="/translate">
                Translate
              </Link>
            </div>
          </div>
          <div className="space-y-mdt-2">
            <Text as="p" size="caption" weight="semibold" tone="muted" className="uppercase tracking-[0.24em]">
              Resources
            </Text>
            <div className="flex flex-col gap-mdt-2 text-body-sm text-mdt-muted">
              <Link className="transition-colors duration-mdt-fast ease-mdt-standard hover:text-mdt-text" href="/docs">
                Docs
              </Link>
            </div>
          </div>
          <div className="space-y-mdt-2">
            <Text as="p" size="caption" weight="semibold" tone="muted" className="uppercase tracking-[0.24em]">
              Legal
            </Text>
            <div className="flex flex-col gap-mdt-2 text-body-sm text-mdt-muted">
              <Link className="transition-colors duration-mdt-fast ease-mdt-standard hover:text-mdt-text" href="/privacy">
                Privacy
              </Link>
              <Link className="transition-colors duration-mdt-fast ease-mdt-standard hover:text-mdt-text" href="/terms">
                Terms
              </Link>
            </div>
          </div>
        </nav>
        <div className="md:col-span-2 border-t border-mdt-border pt-mdt-4 text-caption text-mdt-muted">
          © 2025 mark downtown. All rights reserved.
        </div>
      </Container>
    </footer>
  );
}
