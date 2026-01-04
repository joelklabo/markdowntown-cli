# Azure setup runbook (IaC + local emulators)

## Prereqs
- Azure CLI installed and authenticated: `az login`
- Bicep CLI installed: `az bicep install`
- Container images published for web + worker

## Deploy IaC (dev)
1) Create or select a resource group:
   `az group create -n <rg> -l <location>`
2) Update dev parameters:
   - `infra/parameters/dev.bicepparam` (images + Postgres password)
3) Deploy:
   `az deployment group create -g <rg> -f infra/main.bicep -p infra/parameters/dev.bicepparam`
4) Capture outputs:
   `az deployment group show -g <rg> -n <deployment-name> --query properties.outputs`

## Post-deploy checklist
- Web app reachable at the Container App FQDN output.
- Key Vault created with RBAC enabled.
- Storage + Web PubSub created with unique names.
- Postgres server + database created.

## Secrets and configuration
- Container Apps use secrets injected by `infra/main.bicep`:
  - `DATABASE_URL`
  - `AZURE_STORAGE_CONNECTION_STRING`
  - `WEBPUBSUB_CONNECTION_STRING`
- To move secrets into Key Vault, add Key Vault references in `infra/modules/aca.bicep` and grant the managed identity `Key Vault Secrets User`.

## Local dev emulators
1) Start Postgres + Azurite:
   `docker compose up -d`
2) Postgres connection:
   `postgresql://markdowntown:markdowntown@localhost:5432/markdowntown`
3) Azurite connection string:
   `DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNoGVWRy6T6Z7lqTzJ2p1n2wCgS6h8Vh8b1yG1k5f0Kw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;`

## Common issues
- Bicep validation fails: run `az bicep build infra/main.bicep` and fix schema errors.
- Name collisions: bump `namePrefix` or redeploy in a new resource group.
- Container App not starting: check image tag + logs (`az containerapp logs show -g <rg> -n <app>`).
