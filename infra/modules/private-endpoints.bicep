param location string
param tags object = {}
param subnetId string
param vnetId string

// Postgres private endpoint params
param postgresServerId string = ''
param postgresServerName string = ''

// Storage private endpoint params
param storageAccountId string = ''
param storageAccountName string = ''

// Key Vault private endpoint params
param keyVaultId string = ''
param keyVaultName string = ''

var dnsZoneSuffix = environment().suffixes.storage

// Private DNS zones
resource postgresPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = if (postgresServerId != '') {
  name: 'privatelink.postgres.database.azure.com'
  location: 'global'
  tags: tags
}

resource storagePrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = if (storageAccountId != '') {
  name: 'privatelink.blob.${dnsZoneSuffix}'
  location: 'global'
  tags: tags
}

resource keyVaultPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = if (keyVaultId != '') {
  name: 'privatelink.vaultcore.azure.net'
  location: 'global'
  tags: tags
}

// VNet links for DNS zones
resource postgresVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = if (postgresServerId != '') {
  name: 'postgres-vnet-link'
  parent: postgresPrivateDnsZone
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnetId
    }
  }
}

resource storageVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = if (storageAccountId != '') {
  name: 'storage-vnet-link'
  parent: storagePrivateDnsZone
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnetId
    }
  }
}

resource keyVaultVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = if (keyVaultId != '') {
  name: 'keyvault-vnet-link'
  parent: keyVaultPrivateDnsZone
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnetId
    }
  }
}

// Private endpoints
resource postgresPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = if (postgresServerId != '') {
  name: '${postgresServerName}-pe'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: subnetId
    }
    privateLinkServiceConnections: [
      {
        name: '${postgresServerName}-psc'
        properties: {
          privateLinkServiceId: postgresServerId
          groupIds: ['postgresqlServer']
        }
      }
    ]
  }
}

resource postgresPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = if (postgresServerId != '') {
  name: 'postgres-dns-group'
  parent: postgresPrivateEndpoint
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'postgres-config'
        properties: {
          privateDnsZoneId: postgresPrivateDnsZone.id
        }
      }
    ]
  }
}

resource storagePrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = if (storageAccountId != '') {
  name: '${storageAccountName}-pe'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: subnetId
    }
    privateLinkServiceConnections: [
      {
        name: '${storageAccountName}-psc'
        properties: {
          privateLinkServiceId: storageAccountId
          groupIds: ['blob']
        }
      }
    ]
  }
}

resource storagePrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = if (storageAccountId != '') {
  name: 'storage-dns-group'
  parent: storagePrivateEndpoint
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'storage-config'
        properties: {
          privateDnsZoneId: storagePrivateDnsZone.id
        }
      }
    ]
  }
}

resource keyVaultPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = if (keyVaultId != '') {
  name: '${keyVaultName}-pe'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: subnetId
    }
    privateLinkServiceConnections: [
      {
        name: '${keyVaultName}-psc'
        properties: {
          privateLinkServiceId: keyVaultId
          groupIds: ['vault']
        }
      }
    ]
  }
}

resource keyVaultPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = if (keyVaultId != '') {
  name: 'keyvault-dns-group'
  parent: keyVaultPrivateEndpoint
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'keyvault-config'
        properties: {
          privateDnsZoneId: keyVaultPrivateDnsZone.id
        }
      }
    ]
  }
}

output postgresPrivateEndpointId string = postgresServerId != '' ? postgresPrivateEndpoint.id : ''
output storagePrivateEndpointId string = storageAccountId != '' ? storagePrivateEndpoint.id : ''
output keyVaultPrivateEndpointId string = keyVaultId != '' ? keyVaultPrivateEndpoint.id : ''
