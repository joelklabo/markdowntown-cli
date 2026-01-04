@allowed([
  'dev'
  'stage'
  'prod'
])
param environmentName string = 'dev'

param location string = resourceGroup().location
param namePrefix string = 'markdowntown'
param tags object = {
  app: namePrefix
  env: environmentName
}

param webImage string
param workerImage string

param postgresAdminUser string
@secure()
param postgresAdminPassword string
param postgresSkuName string = 'Standard_D2s_v3'
param postgresSkuTier string = 'GeneralPurpose'
param postgresStorageGb int = 32
param postgresVersion string = '15'
param postgresDatabaseName string = 'markdowntown'

param storageSkuName string = 'Standard_LRS'

param pubsubSkuName string = 'Standard_S1'
param pubsubSkuTier string = 'Standard'
param pubsubCapacity int = 1

param containerAppCpu int = 1
param containerAppMemory string = '1Gi'
param containerAppMinReplicas int = 1
param containerAppMaxReplicas int = 3
param containerAppTargetPort int = 3000

param jobCpu int = 1
param jobMemory string = '1Gi'

var suffix = uniqueString(resourceGroup().id, namePrefix, environmentName)
var base = toLower(replace(namePrefix, '-', ''))
var storageName = toLower('${take(base, 11)}${environmentName}${substring(suffix, 0, 6)}')
var pubsubName = toLower('${namePrefix}-${environmentName}-pubsub-${substring(suffix, 0, 6)}')
var keyVaultName = toLower('${take(base, 10)}${environmentName}${substring(suffix, 0, 6)}')
var postgresName = toLower('${take(base, 12)}-${environmentName}-pg-${substring(suffix, 0, 6)}')
var identityName = toLower('${namePrefix}-${environmentName}-mi-${substring(suffix, 0, 6)}')
var managedEnvName = toLower('${namePrefix}-${environmentName}-env')
var containerAppName = toLower('${namePrefix}-${environmentName}-app')
var jobName = toLower('${namePrefix}-${environmentName}-worker')
var logAnalyticsName = toLower('${namePrefix}-${environmentName}-logs-${substring(suffix, 0, 6)}')

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource managedEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: managedEnvName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

module identity 'modules/identity.bicep' = {
  name: 'identity'
  params: {
    name: identityName
    location: location
    tags: tags
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    name: storageName
    location: location
    tags: tags
    skuName: storageSkuName
    principalId: identity.outputs.principalId
  }
}

module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    name: keyVaultName
    location: location
    tags: tags
    principalId: identity.outputs.principalId
  }
}

module pubsub 'modules/pubsub.bicep' = {
  name: 'pubsub'
  params: {
    name: pubsubName
    location: location
    tags: tags
    skuName: pubsubSkuName
    skuTier: pubsubSkuTier
    capacity: pubsubCapacity
  }
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    name: postgresName
    location: location
    tags: tags
    adminUser: postgresAdminUser
    adminPassword: postgresAdminPassword
    skuName: postgresSkuName
    skuTier: postgresSkuTier
    storageSizeGb: postgresStorageGb
    version: postgresVersion
    databaseName: postgresDatabaseName
  }
}

var databaseUrl = 'postgresql://${postgresAdminUser}:${postgresAdminPassword}@${postgres.outputs.fqdn}:5432/${postgres.outputs.databaseName}?sslmode=require'
var storageKey = listKeys(resourceId('Microsoft.Storage/storageAccounts', storageName), '2023-01-01').keys[0].value
var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storage.outputs.accountName};AccountKey=${storageKey};EndpointSuffix=${environment().suffixes.storage}'
var pubsubConnectionString = listKeys(resourceId('Microsoft.SignalRService/webPubSub', pubsubName), '2021-10-01').primaryConnectionString

var webSecrets = [
  {
    name: 'database-url'
    value: databaseUrl
  }
  {
    name: 'storage-conn'
    value: storageConnectionString
  }
  {
    name: 'pubsub-conn'
    value: pubsubConnectionString
  }
]

var webEnv = [
  {
    name: 'DATABASE_URL'
    secretRef: 'database-url'
  }
  {
    name: 'AZURE_STORAGE_CONNECTION_STRING'
    secretRef: 'storage-conn'
  }
  {
    name: 'WEBPUBSUB_CONNECTION_STRING'
    secretRef: 'pubsub-conn'
  }
  {
    name: 'NODE_ENV'
    value: environmentName
  }
]

module webApp 'modules/aca.bicep' = {
  name: 'webapp'
  params: {
    name: containerAppName
    location: location
    tags: tags
    managedEnvironmentId: managedEnv.id
    identityId: identity.outputs.id
    image: webImage
    cpu: containerAppCpu
    memory: containerAppMemory
    minReplicas: containerAppMinReplicas
    maxReplicas: containerAppMaxReplicas
    targetPort: containerAppTargetPort
    secrets: webSecrets
    environmentVariables: webEnv
  }
}

module workerJob 'modules/jobs.bicep' = {
  name: 'workerjob'
  params: {
    name: jobName
    location: location
    tags: tags
    managedEnvironmentId: managedEnv.id
    identityId: identity.outputs.id
    image: workerImage
    cpu: jobCpu
    memory: jobMemory
    secrets: webSecrets
    environmentVariables: webEnv
  }
}

output managedEnvironmentId string = managedEnv.id
output webAppName string = webApp.outputs.name
output webAppFqdn string = webApp.outputs.fqdn
output workerJobName string = workerJob.outputs.name
output storageAccountName string = storage.outputs.accountName
output pubsubName string = pubsub.outputs.name
output keyVaultName string = keyvault.outputs.name
output postgresServerName string = postgres.outputs.name
output postgresDatabaseName string = postgres.outputs.databaseName
