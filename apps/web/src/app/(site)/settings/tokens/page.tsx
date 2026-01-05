import { requireSession } from "@/lib/requireSession";
import { getUserCliTokens } from "@/lib/auth/cliToken";
import { TokenList } from "@/components/settings/TokenList";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { redirect } from "next/navigation";

export default async function TokensPage() {
  const { session } = await requireSession();
  if (!session) {
    redirect("/signin?callbackUrl=/settings/tokens");
  }

  const tokens = await getUserCliTokens(session.user.id);

  return (
    <Container padding="lg">
      <div className="mb-8">
        <Heading level="h1" className="mb-2">
          CLI Tokens
        </Heading>
        <Text tone="muted">
          Manage personal access tokens for using the markdowntown CLI on your machine.
        </Text>
      </div>

      <TokenList initialTokens={tokens} />
    </Container>
  );
}
