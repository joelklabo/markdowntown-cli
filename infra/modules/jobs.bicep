param name string
param location string
param tags object = {}
param managedEnvironmentId string
param identityId string
param image string
param containerName string = 'worker'
param cpu int = 1
param memory string = '1Gi'
param secrets array = []
param environmentVariables array = []
param replicaTimeout int = 1800
param replicaRetryLimit int = 1

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
      triggerType: 'Manual'
      manualTriggerConfig: {
        replicaCompletionCount: 1
        parallelism: 1
      }
      replicaRetryLimit: replicaRetryLimit
      replicaTimeout: replicaTimeout
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
