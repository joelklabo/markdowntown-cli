'use client';

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen bg-mdt-bg-soft text-mdt-text">
        <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-4 py-mdt-12 text-center">
          <div className="mb-mdt-6 flex items-center justify-center">
            <BrandLogo />
          </div>
          <Card className="w-full max-w-xl space-y-5" padding="lg" tone="raised">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-mdt-lg bg-mdt-danger-soft text-mdt-danger text-xl font-semibold">
                !
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-h1">Something went wrong</h1>
              <p className="text-body text-mdt-muted">
                We hit a snag while loading this page. Try again, or head back to the town square.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => reset()}>Try again</Button>
              <Button variant="secondary" asChild>
                <Link href="/">Back to home</Link>
              </Button>
            </div>
            <p className="text-caption text-mdt-muted">
              If the issue keeps happening, refresh the page or check your connection.
            </p>
          </Card>
        </main>
      </body>
    </html>
  );
}
