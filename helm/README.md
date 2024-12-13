This chart will install the components required to run the Debezium Platform.

1. Conductor: The back-end component which provides a set of APIs to orchestrate and control Debezium deployments.
2. Stage: The front-end component which provides a user interface to interact with the Conductor.
3. Debezium operator: operator that manages the creation of Debezium Server custom resource. 
4. [Optional] PostgreSQL database used by conductor to store its data. 
5. [Optional] Strimzi operator: operator for creating Kakfa cluster. In case you want to use a Kafka destination in you pipeline.

# Prerequisites
The chart use an ingress to expose `debezium-stage (UI)` and `debezium-conductor (backend)`,
this will require to have an [ingress controller](https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/) installed in you cluster.
You need also to have domain that must point to the cluster IP and then configure the `domain.url` property in you `values.yaml` with your domain.

### Configurations

| Name                               | Description                                                                                                                                       | Value                                       |
|------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------|
| domain.url                         | domain used as ingress host                                                                                                                       | ""                                          |
| stage.image                        | Image for the stage (UI)                                                                                                                          | quay.io/debezium/platform-stage:latest      |
| conductor.image                    | Image for the conductor                                                                                                                           | quay.io/debezium/platform-conductor:nightly |
| conductor.offset.existingConfigMap | Name of the config map used to store conductor offsets. If empty it will be automatically created.                                                | ""                                          |
| kafka.enabled                      | Enable the installation of Strimzi operator                                                                                                       | false                                       |
| database.enabled                   | Enable the installation of PostgreSQL by the chart                                                                                                | false                                       |
| database.name                      | Database name                                                                                                                                     | postgres                                    |
| database.host                      | Database host                                                                                                                                     |                                             |
| database.auth.existingSecret       | Name of the secret to where `username` and `password` are stored. If empty a secret will be created using the `username` and `password` properties | ""                                          |
| database.auth.username             | Database username                                                                                                                                 | user                                        |
| database.auth.password             | Database password                                                                                                                                 | password                                    |
| env                                | List of env variable to pass to the conductor                                                                                                     | []                                          |


# Install

```shell
helm dependency build
```
Thi will download the required debezium operator chart and, only if `kafka.enabled` is `true`, the Strimzi operator chart.

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