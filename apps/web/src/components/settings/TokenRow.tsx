"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";

interface TokenRowProps {
  token: {
    id: string;
    label: string | null;
    lastUsedAt: Date | null;
    createdAt: Date;
    expiresAt: Date | null;
    scopes: string[];
  };
  onRevoke: (tokenId: string) => Promise<void>;
}

export function TokenRow({ token, onRevoke }: TokenRowProps) {
  const [isRevoking, setIsRevoking] = useState(false);

  const handleRevoke = async () => {
    if (!confirm("Are you sure you want to revoke this token?")) return;
    setIsRevoking(true);
    try {
      await onRevoke(token.id);
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-4 border-b border-mdt-border last:border-0">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Text weight="semibold">
            {token.label || "Untitled Token"}
          </Text>
          <div className="flex gap-1">
            {token.scopes.map((scope) => (
              <Badge key={scope} tone="info">
                {scope}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-4">
          <Text tone="muted" size="caption">
            Created on {new Date(token.createdAt).toLocaleDateString()}
          </Text>
          {token.lastUsedAt && (
            <Text tone="muted" size="caption">
              Last used {new Date(token.lastUsedAt).toLocaleDateString()}
            </Text>
          )}
          {token.expiresAt && (
            <Text tone="muted" size="caption">
              Expires on {new Date(token.expiresAt).toLocaleDateString()}
            </Text>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        className="text-mdt-danger hover:text-mdt-danger-strong hover:bg-mdt-danger-soft/10"
        size="sm"
        onClick={handleRevoke}
        disabled={isRevoking}
      >
        Revoke
      </Button>
    </div>
  );
}
