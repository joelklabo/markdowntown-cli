import { Container } from "@/components/ui/Container";
import { Stack } from "@/components/ui/Stack";

export default function CliLoading() {
  return (
    <Container className="py-mdt-10 md:py-mdt-12" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading CLI sync data…</span>
      <Stack gap={8}>
        {/* Header Skeleton */}
        <Stack gap={2} className="max-w-2xl">
          <div className="h-4 w-20 bg-mdt-border/50 animate-pulse motion-reduce:animate-none rounded" />
          <div className="h-10 w-64 bg-mdt-border/50 animate-pulse motion-reduce:animate-none rounded" />
          <div className="h-12 w-full bg-mdt-border/50 animate-pulse motion-reduce:animate-none rounded" />
        </Stack>

        {/* Status Card Skeleton */}
        <div className="h-48 w-full bg-mdt-border/30 animate-pulse motion-reduce:animate-none rounded-mdt-lg border border-mdt-border/50" />

        {/* Repo List Skeleton */}
        <Stack gap={4}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 w-full bg-mdt-border/20 animate-pulse motion-reduce:animate-none rounded-md border border-mdt-border/50"
            />
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}
