/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.actions;

import java.util.Map;
import java.util.Optional;

import jakarta.enterprise.context.ApplicationScoped;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.operator.api.model.DebeziumServer;
import io.debezium.operator.api.model.runtime.metrics.Metrics;
import io.fabric8.kubernetes.api.model.ObjectMeta;
import io.fabric8.kubernetes.api.model.Service;
import io.fabric8.kubernetes.api.model.ServiceList;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.dsl.TailPrettyLoggable;

/**
 * Adapter class for interacting with Kubernetes resources related to Debezium Server instances.
 * <p>
 * This class serves as an abstraction layer between the application and the Kubernetes API,
 * providing methods to locate, deploy, undeploy, and manage Debezium Server resources
 * within a Kubernetes cluster. It encapsulates the underlying Kubernetes client implementation
 * and exposes a decoupled API for Debezium-specific operations.
 * </p>
 */
@ApplicationScoped
public class DebeziumKubernetesAdapter {

    private static final Logger LOGGER = LoggerFactory.getLogger(DebeziumKubernetesAdapter.class);

    private static final String DEBEZIUM_IO_CLASSIFIER_LABEL = "debezium.io/classifier";
    private static final String DEBEZIUM_IO_INSTANCE_LABEL = "debezium.io/instance";
    private static final String LABEL_DBZ_CONDUCTOR_ID = "debezium.io/conductor-id";
    private static final String API_CLASSIFIER = "api";
    private static final String SERVICE_URL_FORMAT = "http://%s:%s";

    private final KubernetesClient kubernetesClient;

    public DebeziumKubernetesAdapter(KubernetesClient kubernetesClient) {
        this.kubernetesClient = kubernetesClient;
    }

    /**
     * Retrieves the base URL for the API service associated with a Debezium Server instance.
     * <p>
     * This method searches for a Kubernetes service in the specified namespace that has the appropriate
     * labels matching the Debezium Server instance. It then constructs a URL using the service name
     * and port number.
     * </p>
     *
     * @param debeziumServerAttributes The attributes of the Debezium Server instance, including namespace and name.
     * @return An Optional containing the base URL of the API service if found, or an empty Optional if no matching
     *         service is found or if the service configuration is incomplete.
     */
    Optional<String> getServiceApiBaseUrl(DebeziumServerAttributes debeziumServerAttributes) {

        var requiredLabels = Map.of(
                DEBEZIUM_IO_CLASSIFIER_LABEL, API_CLASSIFIER,
                DEBEZIUM_IO_INSTANCE_LABEL, debeziumServerAttributes.name());

        ServiceList apiServices = kubernetesClient.services()
                .inNamespace(debeziumServerAttributes.namespace())
                .withLabels(requiredLabels)
                .list();

        if (apiServices.getItems().isEmpty()) {
            LOGGER.error("No service found in the ns {} with labels {}", debeziumServerAttributes.namespace(), requiredLabels);
            return Optional.empty();
        }

        Service apiService = apiServices.getItems().getFirst();

        if (apiService.getSpec().getPorts().isEmpty()) {
            LOGGER.error("Found service {} in the ns {} without any ports", apiService.getMetadata().getName(), debeziumServerAttributes.namespace());
            return Optional.empty();
        }

        var port = apiService.getSpec().getPorts().getFirst().getPort();

        return Optional.of(String.format(SERVICE_URL_FORMAT, apiService.getMetadata().getName(), port));
    }

    /**
     * Deploys a Debezium Server instance to the Kubernetes cluster.
     * <p>
     * This method applies the provided DebeziumServer resource to the Kubernetes cluster
     * using server-side apply, which creates or updates the resource as needed.
     * </p>
     *
     * @param debeziumServer The DebeziumServer resource to deploy.
     */
    public void deployPipeline(DebeziumServer debeziumServer) {
        // apply to server
        kubernetesClient.resource(debeziumServer).serverSideApply();
    }

    /**
     * Undeploy a Debezium Server instance from the Kubernetes cluster.
     * <p>
     * This method finds and deletes all DebeziumServer resources associated with the
     * specified pipeline ID.
     * </p>
     *
     * @param pipelineId The pipeline id used to identify the DebeziumServer resources to be deleted.
     */
    public void undeployPipeline(Long pipelineId) {
        kubernetesClient.resources(DebeziumServer.class)
                .withLabels(Map.of(LABEL_DBZ_CONDUCTOR_ID, pipelineId.toString()))
                .delete();
    }

    /**
     * Finds the DebeziumServer resource associated with a specific pipeline.
     * <p>
     * This method searches for DebeziumServer resources labeled with the specified
     * pipeline id and returns the first one found.
     * </p>
     *
     * @param pipelineId The pipeline id used to identify the DebeziumServer resource.
     * @return An Optional containing the DebeziumServer resource if found, or an empty Optional if none is found.
     */
    public Optional<DebeziumServer> findAssociatedDebeziumServer(Long pipelineId) {
        return kubernetesClient.resources(DebeziumServer.class)
                .withLabels(Map.of(LABEL_DBZ_CONDUCTOR_ID, pipelineId.toString()))
                .list()
                .getItems()
                .stream()
                .findFirst();
    }

    /**
     * Retrieves a loggable deployment associated with a specific pipeline.
     * <p>
     * This method finds the Kubernetes Deployment resource associated with the
     * DebeziumServer for the specified pipeline and returns a {@link TailPrettyLoggable}
     * instance that can be used to access the deployment's logs.
     * </p>
     *
     * @param pipelineId The pipeline id used to identify the associated deployment.
     * @return A {@link TailPrettyLoggable} instance for accessing the deployment's logs.
     * @throws NoSuchElementException If no associated DebeziumServer is found for the given pipeline id.
     */
    public TailPrettyLoggable findLoggableDeployment(Long pipelineId) {
        return findAssociatedDebeziumServer(pipelineId)
                .map(DebeziumServer::getMetadata)
                .map(ObjectMeta::getName)
                .map(name -> kubernetesClient.apps().deployments().withName(name))
                .get();
    }

    /**
     * Changes the operational status of a Debezium Server resource.
     * <p>
     * This method finds the DebeziumServer resource associated with the specified
     * pipeline id, updates its stopped status, and applies the change to the
     * Kubernetes cluster.
     * </p>
     *
     * @param pipelineId The pipeline id used to identify the DebeziumServer resource.
     * @param stop {@code true} to stop the DebeziumServer instance, {@code false} to start it.
     */
    public void changeStatus(Long pipelineId, boolean stop) {
        findAssociatedDebeziumServer(pipelineId).ifPresent(ds -> {
            ds.setStopped(stop);
            kubernetesClient.resource(ds).serverSideApply();
        });
    }

    /**
     * Applies the given metrics configuration to every DebeziumServer resource managed by the conductor,
     * so that a changed collector endpoint reaches existing pipelines without waiting for a pipeline update.
     *
     * @param metrics The metrics configuration to apply.
     */
    public void updateMetrics(Metrics metrics) {
        // ponytail: applies unconditionally; server-side apply leaves unchanged resources untouched
        kubernetesClient.resources(DebeziumServer.class)
                .withLabel(LABEL_DBZ_CONDUCTOR_ID)
                .list()
                .getItems()
                .forEach(ds -> {
                    ds.getSpec().getRuntime().setMetrics(metrics);
                    kubernetesClient.resource(ds).serverSideApply();
                });
    }
}
