import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const metadata = {
  title: "Not found · mark downtown",
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-mdt-bg-soft text-mdt-text">
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-4 py-mdt-12 text-center">
        <div className="mb-mdt-6 flex items-center justify-center">
          <BrandLogo />
        </div>
        <Card className="w-full max-w-xl space-y-5" padding="lg" tone="raised">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-mdt-lg bg-mdt-info-soft text-mdt-info text-2xl font-semibold">
              404
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-h1">Page not found</h1>
            <p className="text-body text-mdt-muted">
              That link doesn’t exist. Jump back to the town square, or scan a folder to get quick
              guidance.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/">Go home</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/atlas/simulator">Scan a folder</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/docs">Read docs</Link>
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
