param name string
param location string
param tags object = {}
param tenantId string = subscription().tenantId
param principalId string = ''
@secure()
param secrets object = {}
param skuName string = 'standard'

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    tenantId: tenantId
    sku: {
      name: skuName
      family: 'A'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enablePurgeProtection: false
    publicNetworkAccess: 'Enabled'
  }
}

resource vaultSecrets 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = [for secret in items(secrets): {
  name: secret.key
  parent: vault
  properties: {
    value: secret.value
  }
}]

resource vaultRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (principalId != '') {
  name: guid(vault.id, principalId, 'kv-secrets-user')
  scope: vault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

output name string = vault.name
output id string = vault.id
output vaultUri string = vault.properties.vaultUri
