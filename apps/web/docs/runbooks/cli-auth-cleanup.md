# CLI Auth Cleanup Runbook

## Overview

This runbook documents the automated cleanup process for expired CLI authentication records, including device codes and tokens.

## Background

The CLI authentication system generates device codes and tokens for user authentication. Over time, expired and revoked records accumulate in the database. This cleanup mechanism removes old records while maintaining an audit trail.

## Retention Policy

### Device Codes

- **Retention Period**: 7 days after expiration
- **Scope**: Applies to device codes in terminal states (EXPIRED, DENIED, APPROVED)
- **Rationale**: Short retention for troubleshooting recent auth flows

Device codes are cleaned up when they meet ANY of these criteria:

- Status is EXPIRED and `expiresAt` is more than 7 days ago
- Status is DENIED and `updatedAt` is more than 7 days ago
- Status is APPROVED and `expiresAt` is more than 7 days ago

### CLI Tokens

- **Retention Period**: 30 days after revocation or expiration
- **Scope**: Applies to revoked or expired tokens only
- **Rationale**: Longer retention for security audit trails

Tokens are cleaned up when they meet ANY of these criteria:

- `revokedAt` is not null and more than 30 days ago
- `expiresAt` is not null and more than 30 days ago (and not revoked)

**Active tokens are never cleaned up.**

## Cleanup Functions

### cleanupExpiredDeviceCodes

Removes expired device codes past the retention period.

```typescript
import { cleanupExpiredDeviceCodes } from "@/lib/cli/cleanup";

const result = await cleanupExpiredDeviceCodes({
  retentionDays: 7,    // Optional, defaults to 7
  batchSize: 1000,     // Optional, defaults to 1000
});

console.log(`Deleted ${result.deletedCount} device codes`);
console.log(`More records to process: ${result.hasMore}`);
```

### cleanupExpiredCliTokens

Removes revoked or expired CLI tokens past the retention period.

```typescript
import { cleanupExpiredCliTokens } from "@/lib/cli/cleanup";

const result = await cleanupExpiredCliTokens({
  retentionDays: 30,   // Optional, defaults to 30
  batchSize: 1000,     // Optional, defaults to 1000
});

console.log(`Deleted ${result.deletedCount} tokens`);
console.log(`More records to process: ${result.hasMore}`);
```

### cleanupAllCliAuth

Runs both cleanup operations concurrently.

```typescript
import { cleanupAllCliAuth } from "@/lib/cli/cleanup";

const result = await cleanupAllCliAuth({
  deviceCodeRetentionDays: 7,   // Optional
  tokenRetentionDays: 30,        // Optional
  batchSize: 1000,               // Optional
});

console.log(`Device codes deleted: ${result.deviceCodes.deletedCount}`);
console.log(`Tokens deleted: ${result.tokens.deletedCount}`);
```

## Batch Processing

All cleanup functions use batch processing to avoid long-running transactions:

- **Default Batch Size**: 1000 records per execution
- **Incremental Processing**: If `hasMore: true`, more records remain
- **Safe for Production**: Each batch is a separate transaction

### Running Multiple Batches

```typescript
let totalDeleted = 0;
let result;

do {
  result = await cleanupExpiredDeviceCodes({ batchSize: 1000 });
  totalDeleted += result.deletedCount;
  console.log(`Processed batch: ${result.deletedCount} deleted`);
} while (result.hasMore);

console.log(`Total deleted: ${totalDeleted}`);
```

## Scheduling

### Recommended Schedule

- **Frequency**: Daily or weekly
- **Timing**: Off-peak hours to minimize database load
- **Method**: Cron job, scheduled task, or serverless function

### Example Cron Schedule

```bash
# Daily at 2 AM UTC
0 2 * * * node -e "require('./dist/scripts/cleanup-cli-auth.js').run()"
```

### Example Serverless (Vercel Cron)

```typescript
// app/api/cron/cli-auth-cleanup/route.ts
import { cleanupAllCliAuth } from "@/lib/cli/cleanup";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await cleanupAllCliAuth();
  return NextResponse.json(result);
}
```

## Monitoring

### Audit Events

Cleanup operations emit audit events via `logAuditEvent`:

- `cli_device_code_cleanup`: Device code cleanup stats
- `cli_token_cleanup`: Token cleanup stats

### Metrics to Track

- Number of records deleted per run
- Execution time
- Error rates
- `hasMore` flag (indicates backlog)

### Example Query (PostgreSQL)

```sql
-- Check device codes eligible for cleanup
SELECT
  status,
  COUNT(*) as count,
  MIN(CASE
    WHEN status = 'EXPIRED' THEN "expiresAt"
    ELSE "updatedAt"
  END) as oldest
FROM "CliDeviceCode"
WHERE (
  (status = 'EXPIRED' AND "expiresAt" < NOW() - INTERVAL '7 days')
  OR (status = 'DENIED' AND "updatedAt" < NOW() - INTERVAL '7 days')
  OR (status = 'APPROVED' AND "expiresAt" < NOW() - INTERVAL '7 days')
)
GROUP BY status;

-- Check tokens eligible for cleanup
SELECT
  CASE
    WHEN "revokedAt" IS NOT NULL THEN 'revoked'
    WHEN "expiresAt" IS NOT NULL THEN 'expired'
  END as token_state,
  COUNT(*) as count,
  MIN(COALESCE("revokedAt", "expiresAt")) as oldest
FROM "CliToken"
WHERE (
  ("revokedAt" IS NOT NULL AND "revokedAt" < NOW() - INTERVAL '30 days')
  OR ("expiresAt" IS NOT NULL AND "expiresAt" < NOW() - INTERVAL '30 days' AND "revokedAt" IS NULL)
)
GROUP BY token_state;
```

## Troubleshooting

### High `deletedCount` Values

**Symptom**: Cleanup deletes thousands of records per run

**Cause**: Retention policy was not enforced previously, causing backlog

**Action**:

- Normal behavior when first enabling cleanup
- Run multiple batches until `hasMore: false`
- Monitor database load

### Cleanup Not Deleting Expected Records

**Symptom**: Query shows eligible records, but cleanup doesn't delete them

**Checklist**:

1. Verify retention period calculation (timezone issues)
2. Check database indexes on `expiresAt`, `revokedAt`, `status`
3. Review SQL query in cleanup function matches documented criteria
4. Check for concurrent cleanup processes

### Performance Issues

**Symptom**: Cleanup takes too long or times out

**Actions**:

1. Reduce `batchSize` (e.g., 500 or 250)
2. Add indexes if missing:
   - `CliDeviceCode`: `(status, expiresAt)`, `(status, updatedAt)`
   - `CliToken`: `(revokedAt)`, `(expiresAt)`
3. Run cleanup more frequently to reduce batch sizes

## Database Indexes

Required indexes for optimal performance:

```prisma
model CliDeviceCode {
  // ...
  @@index([status])
  @@index([expiresAt])
}

model CliToken {
  // ...
  @@index([revokedAt])
}
```

These indexes already exist in the schema.

## Edge Cases

### Concurrent Cleanup

- **Safe**: Each cleanup run is idempotent
- **Behavior**: Multiple runs may delete overlapping batches
- **Recommendation**: Use distributed locks if running concurrently

### Large Tables

- **Batch Size**: Default 1000 is suitable for tables up to millions of records
- **Incremental**: Run multiple batches with delays if needed
- **Database Load**: Monitor query performance during cleanup

### Timezone Considerations

- All timestamps are stored in UTC
- Retention calculations use `Date.now()` which is timezone-agnostic
- No special handling needed

## Manual Cleanup (Emergency)

If automated cleanup fails and immediate action is needed:

```sql
-- Emergency cleanup: Delete device codes expired >30 days ago
DELETE FROM "CliDeviceCode"
WHERE "expiresAt" < NOW() - INTERVAL '30 days'
  AND status IN ('EXPIRED', 'DENIED');

-- Emergency cleanup: Delete revoked tokens >90 days ago
DELETE FROM "CliToken"
WHERE "revokedAt" IS NOT NULL
  AND "revokedAt" < NOW() - INTERVAL '90 days';
```

**⚠️ Use with caution**: Manual SQL bypasses audit logging.

## References

- Source: `apps/web/src/lib/cli/cleanup.ts`
- Tests: `apps/web/__tests__/lib/cli/cleanup.test.ts`
- Schema: `apps/web/prisma/schema.prisma`
- Constants: `DEFAULT_DEVICE_CODE_RETENTION_DAYS`, `DEFAULT_CLI_TOKEN_RETENTION_DAYS`
