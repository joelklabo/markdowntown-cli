# Azure setup runbook (IaC + local emulators)

## Prereqs
- Azure CLI installed and authenticated: `az login`
- Bicep CLI installed: `az bicep install`
- Container images published for web + worker
- If using private images, enable ACR in `infra/parameters/dev.bicepparam` (`acrCreate` or `acrName`).

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
- If ACR enabled, confirm `acrLoginServer` output and push images before updating tags.

## Secrets and configuration
- Key Vault secrets are created by `infra/main.bicep`:
  - `database-url`
  - `storage-conn`
  - `pubsub-conn`
- Container Apps reference Key Vault secrets via the managed identity.
- Provide secret values via secure deployment inputs (pipeline secrets or local env), not committed parameter files.

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

## Network isolation (optional)

Enable VNet + private endpoints by setting `enableNetworkIsolation = true` in your parameter file.

### What gets created
- VNet with two subnets:
  - `aca` (delegated to Container Apps environment)
  - `endpoints` (for private endpoints)
- Private endpoints for Postgres, Storage Blob, and Key Vault
- Private DNS zones for each service:
  - `privatelink.postgres.database.azure.com`
  - `privatelink.blob.core.windows.net`
  - `privatelink.vaultcore.azure.net`

### DNS resolution
Private DNS zones are automatically linked to the VNet. Services within the VNet resolve the private endpoint IPs. External clients continue using public endpoints (if enabled).

To verify DNS resolution from within the VNet:
```bash
# From a VM or container in the VNet
nslookup <postgres-server>.postgres.database.azure.com
# Should return the private IP (10.0.2.x)
```

### Customizing address spaces
Override defaults in your parameter file:
```bicep
param vnetAddressPrefix = '10.1.0.0/16'
param acaSubnetAddressPrefix = '10.1.0.0/23'
param endpointsSubnetAddressPrefix = '10.1.2.0/24'
```

### Post-deploy verification
1. Check private endpoints created: `az network private-endpoint list -g <rg>`
2. Check DNS zones linked: `az network private-dns zone list -g <rg>`
3. Verify Container App uses VNet: `az containerapp env show -g <rg> -n <env> --query properties.vnetConfiguration`
