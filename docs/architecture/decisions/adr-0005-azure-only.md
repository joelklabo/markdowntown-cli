# ADR-0005: Azure-only infrastructure

Status: Accepted
Date: 2026-01-03

## Context

The system must use Azure for all compute, storage, and real-time services, with Cloudflare used only for DNS/TLS. This simplifies operations and security posture.

## Decision

All cloud services are Azure-native:

- **Compute:** Azure Container Apps for web/API and worker services
- **Jobs:** ACA Jobs for scheduled tasks (doc refresh, migrations)
- **Real-time:** Azure Web PubSub for live status updates
- **Storage:** Azure Blob Storage for snapshot file content
- **Database:** Azure Postgres Flexible Server
- **Secrets/Identity:** Managed Identity + Azure Key Vault

Cloudflare is limited to DNS/TLS termination.

## Exceptions (Break-glass)

- Non-Azure services require written approval from Infra + Security.
- Any exception must include a rollback plan and cost estimate.
- Azure regional outages trigger a temporary exception process if no Azure-native alternative exists.

## Consequences

- Infrastructure-as-code must target Azure (Bicep).
- Local dev uses emulators (Azurite) and docker-compose for Postgres.
- Deployment and runbooks must align with Azure Monitor and ACA patterns.

## Links

- docs/architecture/monorepo-layout.md
