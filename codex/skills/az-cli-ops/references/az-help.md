# Azure CLI help snapshot

- Updated: 2026-01-02T20:31:03Z
- Version: {

## az

Group
    az

Subgroups:
    account                 : Manage Azure subscription information.
    acr                     : Manage private registries with Azure Container Registries.
    ad                      : Manage Microsoft Entra ID (formerly known as Azure Active Directory,
                              Azure AD, AAD) entities needed for Azure role-based access control
                              (Azure RBAC) through Microsoft Graph API.
    advisor                 : Manage Azure Advisor.
    afd                     : Manage Azure Front Door Standard/Premium.
    aks                     : Azure Kubernetes Service.
    ams                     : Manage Azure Media Services resources.
    apim                    : Manage Azure API Management services.
    appconfig               : Manage App Configurations.
    appservice              : Manage Appservice.
    aro                     : Manage Azure Red Hat OpenShift clusters.
    artifacts               : Manage Azure Artifacts.
    backup                  : Manage Azure Backups.
    batch                   : Manage Azure Batch.
    bicep                   : Bicep CLI command group.
    billing                 : Manage Azure Billing.
    boards                  : Manage Azure Boards.
    bot                     : Manage Microsoft Azure Bot Service.
    cache                   : Commands to manage CLI objects cached using the `--defer` argument.
    capacity                : Manage capacity.
    cdn                     : Manage Azure Content Delivery Networks (CDNs).
    cloud                   : Manage registered Azure clouds.
    cognitiveservices       : Manage Azure Cognitive Services accounts.
    compute-fleet [Preview] : Manage for Azure Compute Fleet.
    compute-recommender     : Manage sku/zone/region recommender info for compute resources.
    config   [Experimental] : Manage Azure CLI configuration.
    connection              : Commands to manage Service Connector local connections which allow
                              local environment to connect Azure Resource. If you want to manage
                              connection for compute service, please run 'az
                              webapp/containerapp/spring connection'.
    consumption   [Preview] : Manage consumption of Azure resources.
    container               : Manage Azure Container Instances.
    containerapp            : Manage Azure Container Apps.
    cosmosdb                : Manage Azure Cosmos DB database accounts.
    data-boundary           : Data boundary operations.
    databoxedge             : Manage device with databoxedge.
    deployment              : Manage Azure Resource Manager template deployment at subscription
                              scope.
    deployment-scripts      : Manage deployment scripts at subscription or resource group scope.
    devops                  : Manage Azure DevOps organization level operations.
    disk                    : Manage Azure Managed Disks.
    disk-access             : Manage disk access resources.
    disk-encryption-set     : Disk Encryption Set resource.
    dls           [Preview] : Manage Data Lake Store accounts and filesystems.
    dms                     : Manage Azure Data Migration Service (classic) instances.
    eventgrid               : Manage Azure Event Grid topics, domains, domain topics, system topics
                              partner topics, event subscriptions, system topic event subscriptions
                              and partner topic event subscriptions.
    eventhubs               : Eventhubs.
    extension               : Manage and update CLI extensions.
    feature                 : Manage resource provider features.
    functionapp             : Manage function apps. To install the Azure Functions Core tools see
                              https://github.com/Azure/azure-functions-core-tools.
    group                   : Manage resource groups and template deployments.
    hdinsight               : Manage HDInsight resources.
    identity                : Manage Managed Identity.
    image                   : Manage custom virtual machine images.
    iot                     : Manage Internet of Things (IoT) assets.
    keyvault                : Manage KeyVault keys, secrets, and certificates.
    lab           [Preview] : Manage azure devtest labs.
    lock                    : Manage Azure locks.
    logicapp                : Manage logic apps.
    managed-cassandra       : Azure Managed Cassandra.
    managedapp              : Manage template solutions provided and maintained by Independent
                              Software Vendors (ISVs).
    managedservices         : Manage the registration assignments and definitions in Azure.
    maps                    : Manage Azure Maps.
    mariadb                 : Manage Azure Database for MariaDB servers.
    monitor                 : Manage the Azure Monitor Service.
    mysql                   : Manage Azure Database for MySQL servers.
    netappfiles             : Manage Azure NetApp Files (ANF) Resources.
    network                 : Manage Azure Network resources.
    pipelines               : Manage Azure Pipelines.
    policy                  : Manage resources defined and used by the Azure Policy service.
    postgres                : Manage Azure Database for PostgreSQL.
    ppg                     : Manage Proximity Placement Groups.
    private-link            : Private-link association CLI command group.
    provider                : Manage resource providers.
    quota                   : Manag quota for Azure resource providers.
    redis                   : Manage dedicated Redis caches for your Azure applications.
    relay                   : Manage Azure Relay Service namespaces, WCF relays, hybrid connections,
                              and rules.
    repos                   : Manage Azure Repos.
    resource                : Manage Azure resources.
    resourcemanagement      : Resourcemanagement CLI command group.
    restore-point           : Manage restore point with res.
    role                    : Manage Azure role-based access control (Azure RBAC).
    search                  : Manage Search.
    security                : Manage your security posture with Microsoft Defender for Cloud.
    servicebus              : Servicebus.
    sf                      : Manage and administer Azure Service Fabric clusters.
    sig                     : Manage shared image gallery.
    signalr                 : Manage Azure SignalR Service.
    snapshot                : Manage point-in-time copies of managed disks, native blobs, or other
                              snapshots.
    sql                     : Manage Azure SQL Databases and Data Warehouses.
    sshkey                  : Manage ssh public key with vm.
    stack                   : A deployment stack is a native Azure resource type that enables you to
                              perform operations on a resource collection as an atomic unit.
    staticwebapp            : Manage static apps.
    storage                 : Manage Azure Cloud Storage resources.
    synapse                 : Manage and operate Synapse Workspace, Spark Pool, SQL Pool.
    tag                     : Tag Management on a resource.
    term     [Experimental] : Manage marketplace agreement with marketplaceordering.
    ts                      : Manage template specs at subscription or resource group scope.
    vm                      : Manage Linux or Windows virtual machines.
    vmss                    : Manage groupings of virtual machines in an Azure Virtual Machine Scale
                              Set (VMSS).
    webapp                  : Manage web apps.

Commands:
    configure               : Manage Azure CLI configuration. This command is interactive.
    feedback                : Send feedback to the Azure CLI Team.
    find                    : I'm an AI robot, my advice is based on our Azure documentation as well
                              as the usage patterns of Azure CLI and Azure ARM users. Using me
                              improves Azure products and documentation.
    interactive   [Preview] : Start interactive mode. Installs the Interactive extension if not
                              installed already.
    login                   : Log in to Azure.
    logout                  : Log out to remove access to Azure subscriptions.
    rest                    : Invoke a custom request.
    survey                  : Take Azure CLI survey.
    upgrade       [Preview] : Upgrade Azure CLI and extensions.
    version                 : Show the versions of Azure CLI modules and extensions in JSON format
                              by default or format configured by --output.

To search AI knowledge base for examples, use: az find "az "


## az account

Group
    az account : Manage Azure subscription information.

Subgroups:
    lock             : Manage Azure subscription level locks.
    management-group : Manage Azure Management Groups.

Commands:
    clear            : Clear all subscriptions from the CLI's local cache.
    get-access-token : Get a token for utilities to access Azure.
    list             : Get a list of subscriptions for the logged in account. By default, only
                       'Enabled' subscriptions from the current cloud is shown.
    list-locations   : List supported regions for the current subscription.
    set              : Set a subscription to be the current active subscription.
    show             : Get the details of a subscription.

To search AI knowledge base for examples, use: az find "az account"


## az group

Group
    az group : Manage resource groups and template deployments.

Subgroups:
    lock   : Manage Azure resource group locks.

Commands:
    create : Create a new resource group.
    delete : Delete a resource group.
    exists : Check if a resource group exists.
    export : Captures a resource group as a template.
    list   : List resource groups.
    show   : Gets a resource group.
    update : Update a resource group.
    wait   : Place the CLI in a waiting state until a condition of the resource group is met.

To search AI knowledge base for examples, use: az find "az group"


## az resource

Group
    az resource : Manage Azure resources.

Subgroups:
    link          : Manage links between resources.
    lock          : Manage Azure resource level locks.

Commands:
    create        : Create a resource.
    delete        : Delete a resource.
    invoke-action : Invoke an action on the resource.
    list          : List resources.
    move          : Move resources from one resource group to another (can be under different
                    subscription).
    patch         : Update a resource by PATCH request.
    show          : Get the details of a resource.
    tag           : Tag a resource.
    update        : Update a resource by PUT request.
    wait          : Place the CLI in a waiting state until a condition of a resources is met.

To search AI knowledge base for examples, use: az find "az resource"


## az deployment

Group
    az deployment : Manage Azure Resource Manager template deployment at subscription scope.

Subgroups:
    group     : Manage Azure Resource Manager template deployment at resource group.
    mg        : Manage Azure Resource Manager template deployment at management group.
    operation : Manage deployment operations at subscription scope.
    sub       : Manage Azure Resource Manager template deployment at subscription scope.
    tenant    : Manage Azure Resource Manager template deployment at tenant scope.

To search AI knowledge base for examples, use: az find "az deployment"


## az keyvault

Group
    az keyvault : Manage KeyVault keys, secrets, and certificates.

Subgroups:
    backup                      : Manage full HSM backup.
    certificate                 : Manage certificates.
    key                         : Manage keys.
    network-rule                : Manage network ACLs for vault or managed hsm.
    private-endpoint-connection : Manage vault/HSM private endpoint connections.
    private-link-resource       : Manage vault/HSM private link resources.
    region                      : Manage MHSM multi-regions.
    restore                     : Manage full HSM restore.
    role                        : Manage user roles for access control.
    secret                      : Manage secrets.
    security-domain             : Manage security domain operations.
    setting                     : Manage MHSM settings.

Commands:
    check-name                  : Check that the given name is valid and is not already in use.
    create                      : Create a Vault or HSM.
    delete                      : Delete a Vault or HSM.
    delete-policy               : Delete security policy settings for a Key Vault.
    list                        : List Vaults and/or HSMs.
    list-deleted                : Get information about the deleted Vaults or HSMs in a
                                  subscription.
    purge                       : Permanently delete the specified Vault or HSM. Aka Purges the
                                  deleted Vault or HSM.
    recover                     : Recover a Vault or HSM.
    set-policy                  : Update security policy settings for a Key Vault.
    show                        : Show details of a Vault or HSM.
    show-deleted                : Show details of a deleted Vault or HSM.
    update                      : Update the properties of a Vault.
    update-hsm                  : Update the properties of a HSM.
    wait                        : Place the CLI in a waiting state until a condition of the Vault is
                                  met.
    wait-hsm                    : Place the CLI in a waiting state until a condition of the HSM is
                                  met.

To search AI knowledge base for examples, use: az find "az keyvault"


## az appservice

Group
    az appservice : Manage Appservice.

Subgroups:
    ase               : Manage App Service Environments.
    domain  [Preview] : Manage custom domains.
    hybrid-connection : A method that sets the key a hybrid-connection uses.
    plan              : Manage Plan.
    vnet-integration  : A method that lists the virtual network integrations used in an appservice
                        plan.

Commands:
    list-locations    : List regions where a plan sku is available.

To search AI knowledge base for examples, use: az find "az appservice"


## az webapp

Group
    az webapp : Manage web apps.

Subgroups:
    auth                     : Manage webapp authentication and authorization. To use v2 auth
                               commands, run "az extension add --name authV2" to add the authV2 CLI
                               extension.
    config                   : Configure a web app.
    connection               : Commands to manage webapp connections.
    cors                     : Manage Cross-Origin Resource Sharing (CORS).
    deleted        [Preview] : Manage deleted web apps.
    deployment               : Manage web app deployments.
    hybrid-connection        : Methods that list, add and remove hybrid-connections from webapps.
    identity                 : Manage web app's managed identity.
    log                      : Manage web app logs.
    sitecontainers           : Manage linux web apps sitecontainers.
    traffic-routing          : Manage traffic routing for web apps.
    vnet-integration         : Methods that list, add, and remove virtual network integrations from
                               a webapp.
    webjob                   : Allows management operations for webjobs on a web app.

Commands:
    browse                   : Open a web app in a browser. This is not supported in Azure Cloud
                               Shell.
    create                   : Create a web app.
    create-remote-connection : Creates a remote connection using a tcp tunnel to your web app.
    delete                   : Delete a web app.
    deploy                   : Deploys a provided artifact to Azure Web Apps.
    list                     : List web apps.
    list-instances           : List all scaled out instances of a web app or web app slot.
    list-runtimes            : List available built-in stacks which can be used for web apps.
    restart                  : Restart a web app.
    show                     : Get the details of a web app.
    ssh            [Preview] : SSH command establishes a ssh session to the web container and
                               developer would get a shell terminal remotely.
    start                    : Start a web app.
    stop                     : Stop a web app.
    up                       : Create a webapp and deploy code from a local workspace to the app.
                               The command is required to run from the folder where the code is
                               present. Current support includes Node, Python, .NET Core and
                               ASP.NET. Node, Python apps are created as Linux apps. .Net Core,
                               ASP.NET, and static HTML apps are created as Windows apps. Append the
                               html flag to deploy as a static HTML app. Each time the command is
                               successfully run, default argument values for resource group, sku,
                               location, plan, and name are saved for the current directory. These
                               defaults are then used for any arguments not provided on subsequent
                               runs of the command in the same directory.  Use 'az configure' to
                               manage defaults. Run this command with the --debug parameter to see
                               the API calls and parameters values being used.
    update                   : Update an existing web app.

To search AI knowledge base for examples, use: az find "az webapp"


## az containerapp

Group
    az containerapp : Manage Azure Container Apps.

Subgroups:
    add-on                   [Preview] : Commands to manage add-ons available within the
                                         environment.
    arc                      [Preview] : Install prerequisites for Kubernetes cluster on Arc.
    auth                               : Manage containerapp authentication and authorization.
    compose                            : Commands to create Azure Container Apps from Compose
                                         specifications.
    connected-env            [Preview] : Commands to manage Container Apps Connected environments
                                         for use with Arc enabled Container Apps.
    connection                         : Commands to manage containerapp connections.
    dapr                               : Commands to manage Dapr. To manage Dapr components, see `az
                                         containerapp env dapr-component`.
    env                                : Commands to manage Container Apps environments.
    github-action                      : Commands to manage GitHub Actions.
    hostname                           : Commands to manage hostnames of a container app.
    identity                           : Commands to manage managed identities.
    ingress                            : Commands to manage ingress and traffic-splitting.
    java                               : Commands to manage Java workloads.
    job                                : Commands to manage Container Apps jobs.
    label-history            [Preview] : Show the history for one or more labels on the Container
                                         App.
    logs                               : Show container app logs.
    patch                    [Preview] : Patch Azure Container Apps. Patching is only available for
                                         the apps built using the source to cloud feature. See
                                         https://aka.ms/aca-local-source-to-cloud.
    registry                 [Preview] : Commands to manage container registry information.
    replica                            : Manage container app replicas.
    resiliency               [Preview] : Commands to manage resiliency policies for a container app.
    revision                           : Commands to manage revisions.
    secret                             : Commands to manage secrets.
    session                            : Commands to manage sessions.To learn more about individual
                                         commands under each subgroup run containerapp session
                                         [subgroup name] --help.
    sessionpool                        : Commands to manage session pools.
    ssl                                : Upload certificate to a managed environment, add hostname
                                         to an app in that environment, and bind the certificate to
                                         the hostname.

Commands:
    browse                             : Open a containerapp in the browser, if possible.
    create                             : Create a container app.
    debug                    [Preview] : Open an SSH-like interactive shell within a container app
                                         debug console.
    delete                             : Delete a container app.
    exec                               : Open an SSH-like interactive shell within a container app
                                         replica.
    list                               : List container apps.
    list-usages                        : List usages of subscription level quotas in specific
                                         region.
    show                               : Show details of a container app.
    show-custom-domain-verification-id : Show the verification id for binding app or environment
                                         custom domains.
    up                                 : Create or update a container app as well as any associated
                                         resources (ACR, resource group, container apps environment,
                                         GitHub Actions, etc.).
    update                             : Update a container app. In multiple revisions mode, create
                                         a new revision based on the latest revision.

To search AI knowledge base for examples, use: az find "az containerapp"


## az acr

Group
    az acr : Manage private registries with Azure Container Registries.

Subgroups:
    agentpool          [Preview] : Manage private Tasks agent pools with Azure Container Registries.
    artifact-streaming [Preview] : Manage artifact streaming for any repositories or supported
                                   images in an ACR.
    cache                        : Manage cache rules in Azure Container Registries.
    config                       : Configure policies for Azure Container Registries.
    connected-registry           : Manage connected registry resources with Azure Container
                                   Registries.
    credential                   : Manage login credentials for Azure Container Registries.
    credential-set               : Manage credential sets in Azure Container Registries.
    encryption                   : Manage container registry encryption.
    helm            [Deprecated] : Manage helm charts for Azure Container Registries.
    identity                     : Manage service (managed) identities for a container registry.
    manifest           [Preview] : Manage artifact manifests in Azure Container Registries.
    network-rule                 : Manage network rules for Azure Container Registries.
    pack               [Preview] : Manage Azure Container Registry Tasks that use Cloud Native
                                   Buildpacks.
    private-endpoint-connection  : Manage container registry private endpoint connections.
    private-link-resource        : Manage registry private link resources.
    replication                  : Manage geo-replicated regions of Azure Container Registries.
    repository                   : Manage repositories (image names) for Azure Container Registries.
    scope-map                    : Manage scope access maps for Azure Container Registries.
    task                         : Manage a collection of steps for building, testing and OS &
                                   Framework patching container images using Azure Container
                                   Registries.
    taskrun            [Preview] : Manage taskruns using Azure Container Registries.
    token                        : Manage tokens for an Azure Container Registry.
    webhook                      : Manage webhooks for Azure Container Registries.

Commands:
    build                        : Queues a quick build, providing streaming logs for an Azure
                                   Container Registry.
    check-health                 : Gets health information on the environment and optionally a
                                   target registry.
    check-name                   : Checks if an Azure Container Registry name is valid and available
                                   for use.
    create                       : Create an Azure Container Registry.
    delete                       : Deletes an Azure Container Registry.
    import                       : Imports an image to an Azure Container Registry from another
                                   Container Registry. Import removes the need to docker pull,
                                   docker tag, docker push. For larger images consider using `--no-
                                   wait`.
    list                         : Lists all the container registries under the current
                                   subscription.
    login                        : Log in to an Azure Container Registry through the Docker CLI.
    run                          : Queues a quick run providing streamed logs for an Azure Container
                                   Registry.
    show                         : Get the details of an Azure Container Registry.
    show-endpoints               : Display registry endpoints.
    show-usage                   : Get the storage usage for an Azure Container Registry.
    update                       : Update an Azure Container Registry.

To search AI knowledge base for examples, use: az find "az acr"


## az role

Group
    az role : Manage Azure role-based access control (Azure RBAC).

Subgroups:
    assignment : Manage role assignments.
    definition : Manage role definitions.

To search AI knowledge base for examples, use: az find "az role"


## az monitor

Group
    az monitor : Manage the Azure Monitor Service.

Subgroups:
    account                      : Manage monitor account.
    action-group                 : Manage action groups.
    activity-log                 : Manage activity logs.
    app-insights                 : Commands for querying data in Application Insights applications.
    autoscale                    : Manage autoscale settings.
    diagnostic-settings          : Manage service diagnostic settings.
    log-analytics                : Manage Azure log analytics.
    log-profiles                 : Manage log profiles.
    metrics                      : View Azure resource metrics.
    private-link-scope [Preview] : Manage monitor private link scope resource.

Commands:
    clone              [Preview] : Clone metrics alert rules from one resource to another resource.

To search AI knowledge base for examples, use: az find "az monitor"


## az deployment group

Group
    az deployment group : Manage Azure Resource Manager template deployment at resource group.

Commands:
    cancel   : Cancel a deployment at resource group.
    create   : Start a deployment at resource group.
    delete   : Delete a deployment at resource group.
    export   : Export the template used for a deployment.
    list     : List deployments at resource group.
    show     : Show a deployment at resource group.
    validate : Validate whether a template is valid at resource group.
    wait     : Place the CLI in a waiting state until a deployment condition is met.
    what-if  : Execute a deployment What-If operation at resource group scope.

To search AI knowledge base for examples, use: az find "az deployment group"


## az deployment sub

Group
    az deployment sub : Manage Azure Resource Manager template deployment at subscription scope.

Commands:
    cancel   : Cancel a deployment at subscription scope.
    create   : Start a deployment at subscription scope.
    delete   : Delete a deployment at subscription scope.
    export   : Export the template used for a deployment.
    list     : List deployments at subscription scope.
    show     : Show a deployment at subscription scope.
    validate : Validate whether a template is valid at subscription scope.
    wait     : Place the CLI in a waiting state until a deployment condition is met.
    what-if  : Execute a deployment What-If operation at subscription scope.

To search AI knowledge base for examples, use: az find "az deployment sub"


