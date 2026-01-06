param name string
param location string
param tags object = {}
@allowed([
  'Basic'
  'Standard'
  'Premium'
])
param skuName string = 'Basic'
param adminEnabled bool = false
param workspaceId string = ''

resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: skuName
  }
  properties: {
    adminUserEnabled: adminEnabled
  }
}

resource diagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (!empty(workspaceId)) {
  name: '${acr.name}-diagnostics'
  scope: acr
  properties: {
    workspaceId: workspaceId
    logs: [
      {
        category: 'ContainerRegistryRepositoryEvents'
        enabled: true
      }
      {
        category: 'ContainerRegistryLoginEvents'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

output name string = acr.name
output id string = acr.id
output loginServer string = acr.properties.loginServer
