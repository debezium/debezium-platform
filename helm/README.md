This chart will install the components required to run the Debezium Platform.

1. Conductor: The back-end component which provides a set of APIs to orchestrate and control Debezium deployments.
2. Stage: The front-end component which provides a user interface to interact with the Conductor.
3. Debezium operator: operator that manages the creation of Debezium Server custom resource.
4. [Optional] PostgreSQL database used by conductor to store its data.
5. [Optional] Strimzi operator: operator for creating Kakfa cluster. In case you want to use a Kafka destination in you
   pipeline.

# Prerequisites

The chart use an ingress to expose `debezium-stage (UI)` and `debezium-conductor (backend)`,
this will require to have
an [ingress controller](https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/) installed in you
cluster.
You need also to have domain that must point to the cluster IP and then configure the `domain.name` property in
you `values.yaml` with your domain.

### Configurations

| Name                                       | Description                                                                                                                                                                            | Default                                    |
|:-------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------|
| domain.name                                | domain used as ingress host                                                                                                                                                            | ""                                         |
| domain.url                                 | domain used as ingress host (DEPRECATED). Use `domain.name` instead.)                                                                                                                  | ""                                         |
| ingress.enabled                            | Enable ingress resource for conductor/stage                                                                                                                                            | true                                       |
| ingress.className                          | Optional ingress class name                                                                                                                                                            | ""                                         |
| ingress.annotations                        | Extra ingress annotations                                                                                                                                                              | {}                                         |
| ingress.tls.enabled                        | Enable TLS section on ingress                                                                                                                                                          | false                                      |
| ingress.tls.secretName                     | Secret name used when TLS is enabled                                                                                                                                                   | ""                                         |
| stage.image                                | Image for the stage (UI)                                                                                                                                                               | quay.io/debezium/platform-stage:latest     |
| stage.imagePullPolicy                      | Image pull policy for the stage container (UI). If empty it will default to IfNotPresent.                                                                                              | IfNotPresent                               |
| conductor.image                            | Image for the conductor                                                                                                                                                                | quay.io/debezium/platform-conductor:latest |
| conductor.imagePullPolicy                  | Image pull policy for the conductor container. If empty it will default to IfNotPresent.                                                                                               | IfNotPresent                               |
| conductor.offset.existingConfigMap         | Name of the config map used to store conductor offsets. If empty it will be automatically created.                                                                                     | ""                                         |
| conductor.descriptors.official.enabled     | Enable official Debezium descriptors (downloaded via ORAS at startup)                                                                                                                  | true                                       |
| conductor.descriptors.official.registry    | Registry hosting the descriptor OCI artifact                                                                                                                                           | quay.io                                    |
| conductor.descriptors.official.image       | Image name for the descriptor OCI artifact                                                                                                                                             | debezium/debezium-descriptors              |
| conductor.descriptors.official.tag         | Image tag for the descriptor OCI artifact                                                                                                                                              | nightly                                    |
| conductor.descriptors.official.mountPath   | Path where descriptors will be downloaded inside the container                                                                                                                         | /opt/descriptors                           |
| server.image                               | Image for Debezium Server instances created by pipelines. If empty, the operator's ServerImageProvider determines the image                                                            | ""                                         |
| database.enabled                           | Enable the installation of PostgreSQL by the chart                                                                                                                                     | false                                      |
| database.name                              | Database name                                                                                                                                                                          | postgres                                   |
| database.host                              | Database host                                                                                                                                                                          | postgres                                   |
| database.auth.existingSecret               | Name of the secret to where `username` and `password` are stored. If empty a secret will be created using the `username` and `password` properties                                     | ""                                         |
| database.auth.username                     | Database username                                                                                                                                                                      | user                                       |
| database.auth.password                     | Database password                                                                                                                                                                      | password                                   |
| debezium-operator.enabled                  | Enable the installation of the debezium-operator by the chart                                                                                                                          | true                                       |
| offset.reusePlatformDatabase               | Pipelines will use database to store offsets. By default the database used by the conductor service is used.<br/> If you want to use a dedicated one set this property to false        | true                                       |
| offset.database.name                       | Database name                                                                                                                                                                          | postgres                                   |
| offset.database.host                       | Database host                                                                                                                                                                          | postgres                                   |
| offset.database.port                       | Database port                                                                                                                                                                          | 5432                                       |                                                                                                                                                                              |                                             |
| offset.database.auth.existingSecret        | Name of the secret to where `username` and `password` are stored. If not set `offset.database.auth.username` and `offset.database.auth.password` will be used.                         | ""                                         |
| offset.database.auth.username              | Database username                                                                                                                                                                      | user                                       |
| offset.database.auth.password              | Database password                                                                                                                                                                      | password                                   |                                                                                                                                                                  |                                             |
| schemaHistory.reusePlatformDatabase        | Pipelines will use database to store schema history. By default the database used by the conductor service is used.<br/> If you want to use a dedicated one set this property to false | true                                       |
| schemaHistory.database.name                | Database name                                                                                                                                                                          | postgres                                   |
| schemaHistory.database.host                | Database host                                                                                                                                                                          | postgres                                   |
| schemaHistory.database.port                | Database port                                                                                                                                                                          | 5432                                       |                                                                                                                                                                              |                                             |
| schemaHistory.database.auth.existingSecret | Name of the secret to where `username` and `password` are stored. If not set `schemaHistory.database.auth.username` and `schemaHistory.database.auth.password` will be used.           | ""                                         |
| schemaHistory.database.auth.username       | Database username                                                                                                                                                                      | user                                       |
| schemaHistory.database.auth.password       | Database password                                                                                                                                                                      | password                                   |                                                                                                                                                                       |                                                                                                                                                                                 |                                             |
| env                                        | List of env variable to pass to the conductor                                                                                                                                          | []                                         |

## Descriptor OCI Artifacts

The conductor uses OCI artifacts containing component descriptors (JSON files) for connectors and transformations. This enables the platform to:
- Discover available connectors and transformations
- Render UI forms for configuration
- Validate pipeline configurations

### How it Works

At conductor startup, the OCI artifact is downloaded using **ORAS** (OCI Registry as Storage):
- Downloads the descriptor OCI artifact to local filesystem
- Extracts all descriptor JSON files
- Adds ~5-15 seconds to startup time
- Works on any Kubernetes version

### Configuration

The official Debezium descriptors are enabled by default:

```yaml
conductor:
  descriptors:
    official:
      enabled: true
      registry: quay.io
      image: debezium/debezium-descriptors
      tag: nightly
      mountPath: /opt/descriptors
```

To use a specific version:

```yaml
conductor:
  descriptors:
    official:
      enabled: true
      tag: 3.5.0  # Override just the tag
```

To disable descriptors:

```yaml
conductor:
  descriptors:
    official:
      enabled: false
```

### OCI Artifact Structure

Descriptor OCI artifacts should follow this structure:

```
debezium-descriptors:nightly
└── <version>/
    ├── manifest.json
    ├── source-connector/
    │   └── io.debezium.connector.mysql.MySqlConnector.json
    └── transformation/
        └── io.debezium.transforms.ExtractNewRecordState.json
```

The artifact contents are extracted to the configured `mountPath`.

## Debezium Server Image Configuration

By default, when pipelines are created, the Debezium Operator's `ServerImageProvider` automatically determines which Debezium Server image to use based on the configured version and connector type.

However, you can override this behavior and specify a custom Debezium Server image that will be used for all pipelines:

```yaml
server:
  image: quay.io/debezium/server:3.0.0.Final
```

### Use Cases

- **Pinning to a specific version**: Ensure all pipelines use a specific Debezium Server version
  ```yaml
  server:
    image: quay.io/debezium/server:3.0.0.Final
  ```

- **Using custom server image**: Deploy pipelines with a customized Debezium Server image
  ```yaml
  server:
    image: myregistry.io/custom-debezium-server:latest
  ```

- **Default behavior**: Leave empty to let the operator decide
  ```yaml
  server:
    image: ""  # Operator's ServerImageProvider determines the image
  ```

# Install

```shell
helm dependency build
```

Thi will download the required [Debezium Operator](https://github.com/debezium/debezium-operator) chart.

```shell
helm install <release_name> .
```

# Uninstall

Find the release name you want to uninstall

```shell
helm list --all
```

then uninstall it

```shell
helm uninstall <release_name>
```