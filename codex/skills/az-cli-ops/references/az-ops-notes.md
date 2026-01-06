# Az ops notes (append-only)

Use this file to capture new patterns, gotchas, and team conventions discovered during real tasks.

## Conventions
- Default subscription: Visual Studio Enterprise Subscription (id 3491a059-2df4-426f-8982-cbcbd3dee6c9)
- markdowntown resource group: satoshis-stg-west-rg (westus2)
- markdowntown container app env: satoshis-env-stg-west; app: markdowntown-app
- markdowntown ACR: satoshiswestacr (satoshiswestacr.azurecr.io)
- nostrstack resource group: nostrstack-rg (westus3)
- nostrstack container app env: nostrstack-env; app: nostrstack-api
- nostrstack staging RG: nostrstack-stg-rg (westus3) created
- nostrstack staging container apps env: nostrstack-env-stg (auto-created log analytics workspace: workspace-nostrstackstgrgNU5U)
- nostrstack staging app: nostrstack-api-stg (fqdn: nostrstack-api-stg.nicebush-af8dc609.westus3.azurecontainerapps.io)
- klabo.world resource group: klabo-world-rg (westus)
- klabo.world app service: klabo-world-app (hostnames include klabo.world)
- klabo.world plan: klabo-world-plan upgraded to Standard (S1) to enable slots
- klabo.world slot: staging created (klabo-world-app-staging.azurewebsites.net)

## Patterns discovered
- Container Apps queries work via `az containerapp show ... --query properties.configuration.ingress.fqdn` to capture FQDNs.
- ACR metadata available via `az acr show --query {name:name, loginServer:loginServer, sku:sku.name}`.
- Container Apps env creation without explicit Log Analytics triggers auto-creation of a workspace (record name + customerId).
- Container Apps Log Analytics config requires `destination: log-analytics` in `appLogsConfiguration` or the deployment will fail validation.
- Container Apps environments require at least one workload profile; defaulting to `Consumption` avoids validation errors.
- Azure Key Vault secret names should be lowercase with hyphens (uppercase/underscores can trigger BadRequest).
- Key Vault secret names must be alphanumeric or hyphen; use `database-url` style for new secrets.

## Pitfalls to avoid
- Key Vault secrets list/get can be blocked by access policy; expect `Forbidden` and grant `get`/`list` if needed.
- `az deployment group create` failure details are best pulled with `az deployment operation group list -g <rg> -n <deployment>`.

## Follow-ups
- nostrstack staging deployment via Bicep failed due to workload profile validation; used manual az containerapp create instead.
