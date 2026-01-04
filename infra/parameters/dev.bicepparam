using '../main.bicep'

param environmentName = 'dev'
param namePrefix = 'markdowntown'
param webImage = 'ghcr.io/markdowntown/markdowntown-web:dev'
param workerImage = 'ghcr.io/markdowntown/markdowntown-worker:dev'
param postgresAdminUser = 'markdowntown'
param postgresAdminPassword = 'ChangeMe-Dev-Password-01'
param postgresSkuName = 'Standard_B1ms'
param postgresSkuTier = 'Burstable'
param postgresStorageGb = 32
param acrCreate = false
param acrName = ''
param acrSkuName = 'Basic'
param containerAppCpu = 1
param containerAppMemory = '1Gi'
param containerAppMinReplicas = 1
param containerAppMaxReplicas = 2
