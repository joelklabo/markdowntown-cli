param name string
param location string
param tags object = {}
param addressPrefix string = '10.0.0.0/16'
param subnets array = [
  {
    name: 'aca'
    addressPrefix: '10.0.0.0/23'
    delegations: [
      {
        name: 'aca-delegation'
        properties: {
          serviceName: 'Microsoft.App/environments'
        }
      }
    ]
  }
  {
    name: 'endpoints'
    addressPrefix: '10.0.2.0/24'
    delegations: []
  }
]

resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [addressPrefix]
    }
    subnets: [for subnet in subnets: {
      name: subnet.name
      properties: {
        addressPrefix: subnet.addressPrefix
        delegations: subnet.delegations
        privateEndpointNetworkPolicies: 'Disabled'
      }
    }]
  }
}

output id string = vnet.id
output name string = vnet.name
output acaSubnetId string = vnet.properties.subnets[0].id
output endpointsSubnetId string = vnet.properties.subnets[1].id
