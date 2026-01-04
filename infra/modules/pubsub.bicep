param name string
param location string
param tags object = {}
param skuName string = 'Standard_S1'
param skuTier string = 'Standard'
param capacity int = 1

resource pubsub 'Microsoft.SignalRService/webPubSub@2021-10-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuTier
    capacity: capacity
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    disableAadAuth: false
  }
}

output name string = pubsub.name
output id string = pubsub.id
output hostName string = pubsub.properties.hostName
