source env.sh

echo "### DEBEZIUM DEMO ENVIRONMENT ###"
# Create cluster
echo ">>> Creating Cluster"
kind create cluster --name $CLUSTER
kind get kubeconfig --internal --name $CLUSTER > kubeconfig
kubectl cluster-info --context kind-$CLUSTER

# Create namespace
echo ">>> Creating namespace"
kubectl create namespace $NAMESPACE
kubectl config set-context --current --namespace $NAMESPACE

# Install operators
if $DBZ_INSTALL_OPERATOR; then
  echo ">>> Installing Debezium operator"
  echo ">> Add helm repo"
  helm repo add debezium https://charts.debezium.io
  helm repo update debezium
  echo ">> Deploy operator"
  helm install debezium-operator debezium/debezium-operator --version $DBZ_OPERATOR_VERSION --namespace $NAMESPACE
fi

if $STRIMZI_INSTALL_OPERATOR; then
  echo ">>> Installing Strimzi operator"
  echo ">> Add helm repo"
  helm repo add strimzi https://strimzi.io/charts/
  helm repo update strimzi
  echo ">> Deploy operator"
  helm install strimzi-operator strimzi/strimzi-kafka-operator --version $STRIMZI_OPERATOR_VERSION --namespace $NAMESPACE
fi

if $DBZ_INSTALL_OPERATOR; then
  kubectl wait --for=condition=Available deployments/debezium-operator --timeout=$TIMEOUT -n $NAMESPACE
  echo ">>> Debezium operator ready"
fi

if $STRIMZI_INSTALL_OPERATOR; then
  kubectl wait --for=condition=Available deployments/strimzi-cluster-operator --timeout=$TIMEOUT -n $NAMESPACE
  echo ">>> Strimzi operator ready"
fi

# Deploy Kafka and PostgreSQL
if $STRIMZI_DEPLOY_KAFKA; then
  echo ">>> Deploy kafka"
  kubectl create -f k8s/kafka/ -n $NAMESPACE
fi

if $STRIMZI_DEPLOY_KAFKA; then
  echo ">> Wait for kafka cluster"
  kubectl wait --for=condition=Ready kafkas/dbz-kafka --timeout=$TIMEOUT -n $NAMESPACE
  echo ">> Kafka cluster ready"
fi

if $POSTGRES_DEPLOY; then
  echo ">>> Deploy PostgreSQL"
  kubectl create -f k8s/database/ -n $NAMESPACE
fi

if $POSTGRES_DEPLOY; then
  echo ">> Wait for PostgreSQL"
  kubectl wait --for=condition=Available deployments/postgresql --timeout=$TIMEOUT -n $NAMESPACE
  echo ">> PostgreSQL ready"
fi