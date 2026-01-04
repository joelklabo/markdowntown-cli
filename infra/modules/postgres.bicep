param name string
param location string
param tags object = {}
param adminUser string
@secure()
param adminPassword string
param skuName string = 'Standard_D2s_v3'
param skuTier string = 'GeneralPurpose'
param storageSizeGb int = 32
param version string = '15'
param databaseName string = 'markdowntown'

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    version: version
    administratorLogin: adminUser
    administratorLoginPassword: adminPassword
    storage: {
      storageSizeGB: storageSizeGb
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2022-12-01' = {
  name: databaseName
  parent: postgres
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

output name string = postgres.name
output id string = postgres.id
output databaseName string = databaseName
output fqdn string = postgres.properties.fullyQualifiedDomainName
