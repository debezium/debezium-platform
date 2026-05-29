# Debezium Management Platform

> **Note:** This repository has been archived in favour of [debezium-platform](https://github.com/debezium/debezium-platform)

# debezium-platform-conductor

The back-end component of Debezium management platform. Conductor provides a set APIs which can be used to orchestrate and control Debezium deployments. Usually it's intended to be interacted with through a front-end client.

**Disclaimer**: This project is still in early development stage and should not be used in production.

## Debezium Management Platform

Debezium Management Platform (Debezium Orchestra) aims to provide means to simplify the deployment of Debezium to various environments in highly opinionated manner. The goal is not to provide total control over environment specific configuration. To achieve this goal the platform uses a data-centric view on Debezium components.

## Platform Architecture

The platform is composed of two main components:

1. Conductor: The back-end component which provides a set of APIs to orchestrate and control Debezium deployments.
2. Stage: The front-end component which provides a user interface to interact with the Conductor.

### Conductor Architecture

The conductor component itself is composed of several subcomponents:

1. API Server: The main entry point for the platform. It provides a set of APIs to interact with the platform.
2. Watcher: Component responsible for the actual communication with deployment environment (e.g. Debezium Operator in K8s cluster).

![Debezium Management Platform Architecture](img/debezium-platform-architecture.svg)

## Installation

You can install the platform through helm chart. For instructions refer to the [README](helm/README.md)

## How to Try the Platform

There are currently two examples available to try the platform under `examples` directory:

1. `compose-rest-api-only`: This example provides a mean to run the API server and the front-end Stage application locally. While data is persisted in a local database, the platform does not interact with any deployment environment (which means no Debezium pipelines are actually deployed).
2. `compose-kind-kafka`: This example uses a more complex environment which relies on local Kubernetes cluster provision via [Kind](https://kind.sigs.k8s.io/)

### Running the `compose-rest-api-only` Example

To run the example, execute the following command from the `examples/compose-rest-api-only` directory:

```shell
# Using podman
podman compose -f compose.yml up

# Using docker
docker compose -f compose.yml up
```

### Running the `compose-kind-kafka` Example

To run the example, execute the following commands from the `examples/compose-kind-kafka` directory:

```shell
# Create the local Kubernetes cluster
./create-cluster.sh

# Deploy the platform (podman)
docker compose -f compose.yml up

# Deploy the platform (docker)
docker compose -f compose.yml up
```

The `create-cluster.sh` performs several steps:

1. Creates a local Kubernetes cluster using Kind.
2. Exports "internal" `kubeconfig` file, which is then mounted to the conductor container.
3. Deploys Debezium Operator to the cluster.
4. Deploys Strimzi Operator to the cluster.
5. Provisions PostgreSQL database and Kafka Cluster in the cluster.

The behaviour of `create-cluster.sh` can be modified by changing the values in the `env.sh` file.

## Run the example (Helm)

If you don't have already a Kubernetes cluster up, you can use one of the commons tools to have a local K8s cluster:
* [minikube](https://minikube.sigs.k8s.io/docs/)
* [kind](https://kind.sigs.k8s.io/)

If you are using `kind` locally, expose ports `80` and `443` on the control-plane node so the ingress can be reached from your host:

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    listenAddress: "127.0.0.1"
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    listenAddress: "127.0.0.1"
    protocol: TCP
```

```shell
kind create cluster --config kind-ingress.yaml
```

The prerequisite is to install an ingress controller. For example, on `kind` you can install `ingress-nginx` with:

```shell
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.hostPort.enabled=true
```

For this example, considering a local setup, we will use the `/etc/hosts` to resolve the domain. The following script will map the K8s IP to the specified domain into the `/etc/hosts`.

```shell
export DEBEZIUM_PLATFORM_DOMAIN=platform.debezium.io
sudo ./examples/update_hosts.sh
```

> **NOTE:** If you are using minikube on Mac, you need also to run the `minikube tunnel` command. For more details see [this](https://minikube.sigs.k8s.io/docs/drivers/docker/#known-issues) and [this](https://stackoverflow.com/questions/70961901/ingress-with-minikube-working-differently-on-mac-vs-ubuntu-when-to-set-etc-host).

> **NOTE:** If you are using Windows, add `127.0.0.1 platform.debezium.io` to `C:\Windows\System32\drivers\etc\hosts`.

Create a dedicated namespace:

```shell
kubectl create ns debezium-platform
```

and then install *debezium-platform* through `helm`:

```shell
cd helm && helm dependency build &&
helm install debezium-platform . -n debezium-platform -f ../examples/example.yaml &&
cd ..
```

After all pods are running you should access the platform UI from `http://platform.debezium.io/`

To finish the example we will create a PostgreSQL, that will be used as source database, and a kafka cluster, used as destination in our example pipeline.

```shell
# Deploy the source database
kubectl create -n debezium-platform -f examples/k8s/database/001_postgresql.yml
```

Install the Strimzi operator:

```shell
helm repo add strimzi https://strimzi.io/charts/ &&
helm repo update strimzi &&
helm install strimzi-operator strimzi/strimzi-kafka-operator --version 0.45.1 --namespace debezium-platform
```

```shell
# Deploy the kafka cluster
kubectl create -n debezium-platform -f examples/k8s/kafka/001_kafka.yml
```

```shell
# Create a test pipeline
# The script uses the `http` command from HTTPie.
./examples/seed.sh platform.debezium.io 80 examples/payloads/
```

And that's all.

![Debezium Management Platform Pipeline](resources/images/pipeline.png)

You should have a test pipeline configured to move data from PostgreSQL to Kafka.