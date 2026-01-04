param name string
param location string
param tags object = {}
param principalId string = ''
param skuName string = 'Standard_LRS'
param containers array = [
  'snapshots'
  'blobs'
]

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: skuName
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  name: 'default'
  parent: storage
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource blobContainers 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = [for containerName in containers: {
  name: containerName
  parent: blobService
  properties: {
    publicAccess: 'None'
  }
}]

resource storageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (principalId != '') {
  name: guid(storage.id, principalId, 'storage-blob')
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

output accountName string = storage.name
output accountId string = storage.id
output blobEndpoint string = storage.properties.primaryEndpoints.blob
