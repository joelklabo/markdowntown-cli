param name string
param location string
param tags object = {}
param managedEnvironmentId string
param identityId string
param image string
param containerName string = 'web'
param cpu int = 1
param memory string = '1Gi'
param minReplicas int = 1
param maxReplicas int = 3
param ingressExternal bool = true
param targetPort int = 3000
param secrets array = []
param environmentVariables array = []

resource app 'Microsoft.App/containerApps@2023-05-01' = {
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
    managedEnvironmentId: managedEnvironmentId
    configuration: {
      ingress: {
        external: ingressExternal
        targetPort: targetPort
        transport: 'auto'
      }
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
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}

output name string = app.name
output id string = app.id
output fqdn string = app.properties.configuration.ingress.fqdn
