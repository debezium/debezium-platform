source env.sh

kind delete cluster --name $CLUSTER
rm -f kubeconfig