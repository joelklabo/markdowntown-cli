# Azure CLI command map (task -> command)

## Auth & account
- `scripts/azx <cmd>` (wrapper that logs outcomes; prefer for all az commands)
- `az login`
- `az account show`
- `az account list -o table`
- `az account set -s <subscription-id-or-name>`
- `az configure -d group=<rg> location=<region>`

## Resource groups & resources
- `az group list -o table`
- `az group create -n <rg> -l <region>`
- `az group delete -n <rg>`
- `az resource list -g <rg> -o table`
- `az resource show -g <rg> -n <name> --resource-type <type>`

## Deployments (ARM/Bicep)
- `az deployment group create -g <rg> -f <template.bicep> -p @params.json`
- `az deployment group what-if -g <rg> -f <template.bicep> -p @params.json`
- `az deployment group list -g <rg> -o table`
- `az deployment group show -g <rg> -n <deployment>`
- `az deployment operation group list -g <rg> -n <deployment>`
- `az deployment sub create -l <region> -f <template.bicep> -p @params.json`
- `az deployment sub what-if -l <region> -f <template.bicep> -p @params.json`

## App Service
- `az appservice plan list -g <rg> -o table`
- `az webapp list -g <rg> -o table`
- `az webapp show -g <rg> -n <app>`
- `az webapp config appsettings list -g <rg> -n <app>`
- `az webapp config appsettings set -g <rg> -n <app> --settings KEY=VALUE`
- `az webapp deployment list-publishing-profiles -g <rg> -n <app>`
- `az webapp deployment slot list -g <rg> -n <app> -o table`
- `az webapp deployment slot swap -g <rg> -n <app> --slot <staging> --target-slot production`

## Container Apps (extension)
- `az extension add -n containerapp`
- `az containerapp env list -g <rg> -o table`
- `az containerapp env show -g <rg> -n <env>`
- `az containerapp env create -g <rg> -n <env> -l <region>`
- `az containerapp list -g <rg> -o table`
- `az containerapp show -g <rg> -n <app>`
- `az containerapp revision list -g <rg> -n <app> -o table`
- `az containerapp update -g <rg> -n <app> --set-env-vars KEY=VALUE`
- `az containerapp secret set -g <rg> -n <app> --secrets KEY=VALUE`
- `az containerapp logs show -g <rg> -n <app>`

## ACR (container registry)
- `az acr list -o table`
- `az acr show -n <registry>`
- `az acr login -n <registry>`
- `az acr repository list -n <registry> -o table`

## Key Vault
- `az keyvault list -o table`
- `az keyvault secret list --vault-name <kv> -o table`
- `az keyvault secret show --vault-name <kv> -n <name>`
- `az keyvault secret set --vault-name <kv> -n <name> --value <value>`

## RBAC
- `az role assignment list --assignee <principal> -o table`
- `az role assignment create --assignee <principal> --role <role> --scope <scope>`
- `az role definition list --name <role>`

## Monitoring / logs
- `az monitor activity-log list --resource-group <rg> -o table`
- `az monitor log-analytics workspace list -o table`
- `az monitor log-analytics workspace list -g <rg> -o table`
- `az monitor log-analytics workspace get-shared-keys -g <rg> -n <workspace>`

## Output helpers
- `az <cmd> --query "<jmespath>" -o tsv|jsonc|table`
