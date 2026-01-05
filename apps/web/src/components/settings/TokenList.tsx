"use client";

import { useState } from "react";
import { TokenRow } from "./TokenRow";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { Heading } from "@/components/ui/Heading";
import { CodeText } from "@/components/ui/Text";

interface Token {
  id: string;
  label: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
  scopes: string[];
}

interface TokenListProps {
  initialTokens: Token[];
}

export function TokenList({ initialTokens }: TokenListProps) {
  const [tokens, setTokens] = useState(initialTokens);
  const [label, setLabel] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (res.ok) {
        const result = await res.json();
        setNewToken(result.token);
        setTokens([
          {
            id: result.tokenId,
            label: label || "New Token",
            createdAt: new Date(),
            lastUsedAt: null,
            expiresAt: result.expiresAt,
            scopes: result.scopes,
          },
          ...tokens,
        ]);
        setLabel("");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    const res = await fetch(`/api/tokens/${tokenId}`, { method: "DELETE" });
    if (res.ok) {
      setTokens(tokens.filter((t) => t.id !== tokenId));
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <Card padding="lg">
        <Heading level="h3" className="mb-4">
          Create a new CLI token
        </Heading>
        <form onSubmit={handleCreate} className="flex gap-4">
          <Input
            placeholder="Token label (e.g. My MacBook)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={isCreating}
            className="flex-1"
          />
          <Button type="submit" disabled={isCreating || !label.trim()}>
            {isCreating ? "Creating..." : "Create Token"}
          </Button>
        </form>
      </Card>

      {newToken && (
        <Card padding="lg" tone="raised" className="bg-mdt-success-soft/10 border-mdt-success-soft">
          <Heading level="h3" className="mb-2">
            New token created!
          </Heading>
          <Text className="mb-4">
            Copy this token now. For your security, it won&apos;t be shown again.
          </Text>
          <div className="flex items-center gap-4 bg-mdt-surface-raised p-4 rounded-mdt-md border border-mdt-success-soft">
            <CodeText className="flex-1 break-all select-all">
              {newToken}
            </CodeText>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(newToken);
              }}
            >
              Copy
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-4"
            onClick={() => setNewToken(null)}
          >
            Dismiss
          </Button>
        </Card>
      )}

      <Card padding="none">
        <div className="px-6 py-4 border-b border-mdt-border">
          <Heading level="h3">Active Tokens</Heading>
        </div>
        <div className="px-6">
          {tokens.length === 0 ? (
            <div className="py-8 text-center">
              <Text tone="muted">No active tokens.</Text>
            </div>
          ) : (
            tokens.map((token) => (
              <TokenRow key={token.id} token={token} onRevoke={handleRevoke} />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
