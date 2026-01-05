param name string
param location string
param tags object = {}
param managedEnvironmentId string
param identityId string
param image string
param containerName string = 'docs-refresh'
param cpu int = 1
param memory string = '1Gi'
param cronExpression string = '0 */6 * * *'
param secrets array = []
param environmentVariables array = []
param replicaTimeout int = 1200
param replicaRetryLimit int = 2
param registryServer string = ''
param registryIdentityId string = ''

resource job 'Microsoft.App/jobs@2023-05-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    environmentId: managedEnvironmentId
    configuration: {
      triggerType: 'Schedule'
      scheduleTriggerConfig: {
        cronExpression: cronExpression
        parallelism: 1
        retryLimit: replicaRetryLimit
      }
      replicaTimeout: replicaTimeout
      registries: registryServer == '' ? [] : [
        {
          server: registryServer
          identity: registryIdentityId
        }
      ]
      secrets: secrets
    }
    template: {
      containers: [
        {
          name: containerName
          image: image
          resources: {
            cpu: cpu
            memory: memory
          }
          env: environmentVariables
        }
      ]
    }
  }
}

output name string = job.name
output id string = job.id
