import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/Button";
import { DemoLoginButton } from "@/components/auth/DemoLoginButton";
import { GithubLoginButton } from "@/components/auth/GithubLoginButton";
import { Container } from "@/components/ui/Container";
import { Stack } from "@/components/ui/Stack";
import { Surface } from "@/components/ui/Surface";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";

export const metadata = {
  title: "Sign in · mark downtown",
};

const githubConfigured = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
const demoLoginEnabled = process.env.DEMO_LOGIN_DISABLED !== "true";
const demoPassword = process.env.DEMO_LOGIN_PASSWORD ?? "demo-login";

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const callbackUrl = params.callbackUrl || "/";
  const error = params.error;

  return (
    <div className="min-h-screen bg-mdt-bg-soft text-mdt-text">
      <main id="main-content" className="py-mdt-10 md:py-mdt-12">
        <Container size="md" padding="md">
          <Stack gap={10}>
            <div className="flex items-center justify-between">
              <BrandLogo />
              <Button variant="ghost" asChild size="sm">
                <Link href="/">Back home</Link>
              </Button>
            </div>

            <div className="grid gap-mdt-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <Stack gap={5} className="max-w-xl">
                <Text size="caption" tone="muted">Sign in</Text>
                <Heading level="display" leading="tight">Welcome back to your town</Heading>
                <Text tone="muted" leading="relaxed">
                  Sign in with GitHub to save private sections, publish artifacts, and keep drafts in sync across devices.
                </Text>
                <Surface tone="subtle" padding="md" className="space-y-mdt-3">
                  <Heading level="h3" as="h2">What you get</Heading>
                  <ul className="list-disc space-y-mdt-2 pl-mdt-5">
                    <Text as="li" size="bodySm" tone="muted">Secure OAuth via GitHub.</Text>
                    <Text as="li" size="bodySm" tone="muted">Session-backed API access to saved sections.</Text>
                    <Text as="li" size="bodySm" tone="muted">Live preview, exports, and artifact history.</Text>
                  </ul>
                </Surface>
                <Text size="bodySm" tone="muted" leading="relaxed">
                  You can revoke access at any time in your GitHub settings.
                </Text>
              </Stack>

              <Surface padding="lg" className="space-y-mdt-4">
                <div className="space-y-mdt-2">
                  <Text size="caption" tone="muted">Sign-in options</Text>
                  <Heading level="h3" as="h2">Continue with GitHub</Heading>
                  <Text tone="muted" leading="relaxed">
                    Use your GitHub account to access private markdown sections and sync saved exports.
                  </Text>
                </div>
                <GithubLoginButton
                  callbackUrl={callbackUrl}
                  disabled={!githubConfigured}
                  className="w-full"
                  size="lg"
                  wordmarkMethod="oauth"
                >
                  {githubConfigured ? "Sign in with GitHub" : "GitHub not configured"}
                </GithubLoginButton>
                {!githubConfigured && (
                  <div className="rounded-mdt-md border border-[color:var(--mdt-color-warning)]/30 bg-[color:var(--mdt-color-warning)]/10 px-mdt-3 py-mdt-2">
                    <Text size="bodySm" className="text-[color:var(--mdt-color-warning)]">
                      GitHub OAuth is not configured here. Add GITHUB_CLIENT_ID/SECRET or use the demo login below.
                    </Text>
                  </div>
                )}
                {error && (
                  <Text size="bodySm" className="text-[color:var(--mdt-color-danger)]">
                    Sign-in failed: {error.replaceAll("_", " ")}
                  </Text>
                )}
                {demoLoginEnabled && (
                  <div className="space-y-mdt-3 rounded-mdt-lg border border-mdt-border bg-mdt-surface-subtle p-mdt-4">
                    <div className="flex items-center justify-between text-caption text-mdt-muted">
                      <span>Demo login (local dev)</span>
                      <span className="rounded-mdt-sm border border-mdt-border bg-mdt-surface px-mdt-2 py-mdt-1 font-mono">
                        {demoPassword}
                      </span>
                    </div>
                    <DemoLoginButton
                      password={demoPassword}
                      callbackUrl={callbackUrl}
                      wordmarkMethod="password"
                      variant="secondary"
                    />
                  </div>
                )}
                <Text size="caption" tone="muted">
                  By continuing, you agree to keep your credentials safe and follow acceptable use.
                </Text>
              </Surface>
            </div>
          </Stack>
        </Container>
      </main>
    </div>
  );
}
