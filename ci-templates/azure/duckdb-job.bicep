// The Azure Container Apps job that runs a project's DuckDB SQL after each
// load. It pulls the public runner image with no registry or credentials,
// signs in to storage with its own managed identity, and lets Data Factory's
// managed identity start and stop it. Deploy it into a resource group that
// holds a Container Apps environment on the consumption plan.

@description('The job name, such as sales-dev-duckdb.')
param name string

@description('Where the job runs.')
param location string = resourceGroup().location

@description('Resource ID of the Container Apps environment the job runs in.')
param environmentId string

@description('Where your deploy step copies run.sql, such as abfss://deploy@<account>.dfs.core.windows.net/sales/dev/run.sql.')
param sqlUrl string

@description('The storage account the job reads landed files and run.sql from, and publishes tables to.')
param storageAccountName string

@description('Principal ID of the data factory\'s managed identity, which starts and stops the job.')
param factoryPrincipalId string

@description('The runner image. The default is public: no registry or credentials needed.')
param image string = 'ghcr.io/ingestron/duckdb-runner:1'

@description('How long one run may take, in seconds: half of after_copy.timeout, so a retried run ends within it.')
param timeoutSeconds int = 1800

@description('CPU cores for each run.')
param cpu string = '0.5'

@description('Memory for each run.')
param memory string = '1Gi'

resource job 'Microsoft.App/jobs@2025-01-01' = {
  name: name
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: environmentId
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: timeoutSeconds
      replicaRetryLimit: 1
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      // A private copy of the image needs a registry here:
      // registries: [ { server: '<registry>.azurecr.io', identity: 'system' } ]
    }
    template: {
      containers: [
        {
          name: 'duckdb'
          image: image
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: [
            {
              name: 'INGESTRON_SQL'
              value: sqlUrl
            }
          ]
        }
      ]
    }
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

// Storage Blob Data Contributor: read landed files and run.sql, write published tables.
resource jobStorage 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, job.id, 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: job.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Container Apps Jobs Operator: Data Factory starts the job, reads its runs and stops them.
// The job holds no secrets, so the role's wildcard actions expose none.
resource factoryJob 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(job.id, factoryPrincipalId, 'b9a307c4-5aa3-4b52-ba60-2b17c136cd7b')
  scope: job
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b9a307c4-5aa3-4b52-ba60-2b17c136cd7b')
    principalId: factoryPrincipalId
    principalType: 'ServicePrincipal'
  }
}

@description('The job\'s resource ID, for after_copy.job.')
output jobId string = job.id
