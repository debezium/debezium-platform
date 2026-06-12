This chart will install the components required to run the Debezium Platform.

1. Conductor: The back-end component which provides a set of APIs to orchestrate and control Debezium deployments.
2. Stage: The front-end component which provides a user interface to interact with the Conductor.
3. Debezium operator: operator that manages the creation of Debezium Server custom resource.
4. [Optional] PostgreSQL database used by conductor to store its data.
5. [Optional] Strimzi operator: operator for creating Kakfa cluster. In case you want to use a Kafka destination in you
   pipeline.

When monitoring is enabled, the chart also creates:
1. An `OpenTelemetryCollector` custom resource, which requires the OpenTelemetry Operator to already be installed.
2. [Optional] A `ServiceMonitor`, which requires the Prometheus Operator to already be installed.

More details in the [Monitoring](#monitoring) section. 

# Prerequisites

The chart use an ingress to expose `debezium-stage (UI)` and `debezium-conductor (backend)`,
this will require to have
an [ingress controller](https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/) installed in you
cluster.
You need also to have domain that must point to the cluster IP and then configure the `domain.name` property in
you `values.yaml` with your domain.

### Monitoring

The platform's built-in monitoring features require an OpenTelemetry Collector to collect metrics from Debezium Server instances. 
The following operators must be installed in the cluster **before** deploying the chart with monitoring enabled (`monitoring.otel.enabled: true`):

1. **[OpenTelemetry Operator](https://github.com/open-telemetry/opentelemetry-operator)** — manages the `OpenTelemetryCollector` custom resource that the chart creates.
   Install via Helm:
   ```shell
   helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
   helm install opentelemetry-operator open-telemetry/opentelemetry-operator
   ```

2. **[Prometheus Operator](https://github.com/prometheus-operator/prometheus-operator)** (optional) — required only if you want the chart to create a `ServiceMonitor` for automatic Prometheus scraping (`monitoring.prometheus.serviceMonitor.enabled: true`). 
3. Commonly installed via the [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack) chart:
   ```shell
   helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
   helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack
   ```

> **Note:** The OTel Collector must include the **Prometheus exporter**. The base `otelcol` distribution
> includes it, but when the OTel Operator is installed via Helm it defaults to the `otelcol-k8s` distribution
> which does **not**. If your operator uses the `k8s` distribution, set `monitoring.otel.collector.image`
> to override it with the base or contrib image, e.g.:
> - Base: `ghcr.io/open-telemetry/opentelemetry-collector-releases/opentelemetry-collector:0.152.0`
> - Contrib: `ghcr.io/open-telemetry/opentelemetry-collector-releases/opentelemetry-collector-contrib:0.152.0`
>
> See [opentelemetry-collector-releases](https://github.com/open-telemetry/opentelemetry-collector-releases) for available distributions and their included components.

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
| conductor.extraVolumes                     | Extra volumes to add to the conductor deployment                                                                                                                                       | []                                         |
| conductor.extraVolumeMounts                | Extra volume mounts to add to the conductor container                                                                                                                                  | []                                         |
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
| pipeline.labels                            | Map of labels to apply to DebeziumServer custom resources created by pipelines. These labels are merged with the internal `debezium.io/conductor-id` label.                            | {}                                         |
| monitoring.panels.additionalPanelsPath     | Path to a YAML file with additional monitoring panels. Panels are merged with built-in defaults; matching IDs override built-in panels.                                                | ""                                         |
| monitoring.otel.enabled                    | Enable OpenTelemetry monitoring infrastructure. Requires the OpenTelemetry Operator to be installed (see Prerequisites).                                                               | false                                      |
| monitoring.otel.collector.image            | OTel Collector image. Must be the **contrib** distribution to include the Prometheus exporter. If empty, the operator's default is used (which lacks the Prometheus exporter).          | ""                                         |
| monitoring.otel.collector.replicas         | Number of OTel Collector replicas                                                                                                                                                      | 1                                          |
| monitoring.otel.collector.receivers.grpc.port | OTLP gRPC receiver port                                                                                                                                                              | 4317                                       |
| monitoring.otel.collector.receivers.http.port | OTLP HTTP receiver port                                                                                                                                                              | 4318                                       |
| monitoring.otel.collector.processors.batch.timeout | Batch processor flush timeout                                                                                                                                                    | 5s                                         |
| monitoring.otel.collector.processors.batch.sendBatchSize | Maximum number of metrics per batch                                                                                                                                        | 512                                        |
| monitoring.otel.collector.exporters.prometheus.port | Prometheus exporter listen port                                                                                                                                                 | 8889                                       |
| monitoring.otel.collector.exporters.prometheus.resourceToTelemetryConversion | Convert OTel resource attributes to Prometheus labels                                                                                                    | true                                       |
| monitoring.otel.collector.exporters.prometheus.constLabels | Static labels added to all exported metrics                                                                                                                              | {platform: debezium}                       |
| monitoring.prometheus.external.url         | URL of an external Prometheus instance (for users not using Prometheus Operator)                                                                                                        | ""                                         |
| monitoring.prometheus.serviceMonitor.enabled | Create a ServiceMonitor for automatic Prometheus scraping. Requires the Prometheus Operator to be installed (see Prerequisites).                                                      | true                                       |
| monitoring.prometheus.serviceMonitor.scrapeInterval | Prometheus scrape interval                                                                                                                                                    | 15s                                        |
| monitoring.prometheus.serviceMonitor.labels | Labels for Prometheus Operator ServiceMonitor discovery                                                                                                                                | {prometheus: kube-prometheus}              |

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

## Extra Conductor Volumes

Additional volumes and volume mounts can be configured for the conductor container. This can be used, for example, to mount a ConfigMap containing a custom truststore.

```yaml
conductor:
  extraVolumes: 
    - name: truststore 
      configMap: 
        name: conductor-truststore
  extraVolumeMounts: 
    - name: truststore 
      mountPath: /etc/truststore 
      readOnly: true
```

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

## Pipeline Labels

You can configure labels that will be applied to all DebeziumServer custom resources created by pipelines. These labels are merged with the internal `debezium.io/conductor-id` label that is always set automatically.

This is useful for integrating with tools like ArgoCD that rely on labels to track and group resources.

### Configuration

```yaml
pipeline:
  labels:
    argocd.argoproj.io/instance: debezium-platform
    team: data-engineering
```

The labels are automatically converted to environment variables for the Conductor pod (e.g., `PIPELINE_LABELS_ARGOCD_ARGOPROJ_IO_INSTANCE`).

## Additional Monitoring Panels

The platform ships with built-in monitoring panels. You can add custom panels or override built-in ones by providing an additional panels file via a ConfigMap.

### Configuration

1. Create a ConfigMap with your custom panels:

```shell
kubectl create configmap custom-panels --from-file=panels.yml
```

Where `panels.yml` follows this format:

```yaml
panels:
  - id: my-custom-panel
    title: "Custom Metric"
    description: "My custom monitoring panel"
    category: streaming
    query: 'rate(my_custom_metric_total{service_name="{{pipeline_id}}"}[5m])'
    unit: ops/s
    visualization:
      type: line
      suggestedStep: 15s
```

2. Mount it and set the path in your Helm values:

```yaml
conductor:
  extraVolumes:
    - name: custom-panels
      configMap:
        name: custom-panels
  extraVolumeMounts:
    - name: custom-panels
      mountPath: /opt/config/panels.yml
      subPath: panels.yml
      readOnly: true

monitoring:
  panels:
    additionalPanelsPath: /opt/config/panels.yml
```

Panels with matching `id` values override the built-in defaults. New `id` values are added alongside the built-in panels.

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