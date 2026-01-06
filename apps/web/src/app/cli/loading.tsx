import { Container } from "@/components/ui/Container";
import { Stack } from "@/components/ui/Stack";

export default function CliLoading() {
  return (
    <Container className="py-mdt-10 md:py-mdt-12">
      <Stack gap={8}>
        {/* Header Skeleton */}
        <Stack gap={2} className="max-w-2xl">
          <div className="h-4 w-20 bg-mdt-border/50 animate-pulse rounded" />
          <div className="h-10 w-64 bg-mdt-border/50 animate-pulse rounded" />
          <div className="h-12 w-full bg-mdt-border/50 animate-pulse rounded" />
        </Stack>

        {/* Status Card Skeleton */}
        <div className="h-48 w-full bg-mdt-border/30 animate-pulse rounded-mdt-lg border border-mdt-border/50" />

        {/* Repo List Skeleton */}
        <Stack gap={4}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 w-full bg-mdt-border/20 animate-pulse rounded-md border border-mdt-border/50" />
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}