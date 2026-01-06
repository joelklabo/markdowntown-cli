# Staging/prod + observability (summary)

## Docs to consult (do not copy secrets)
- `docs/staging-lightning.md`
- `docs/prod-lightning.md`
- `docs/lightning-observability.md`

## Notes
- Staging/prod use LNbits + Postgres + Azure Container Apps.
- Observability relies on Log Analytics workspace and diagnostic settings.
- Treat Key Vault values as secrets; do not paste into issues or logs.
