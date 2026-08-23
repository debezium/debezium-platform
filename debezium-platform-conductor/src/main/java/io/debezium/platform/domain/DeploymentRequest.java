/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

/**
 * Groups the parameters for creating a new host deployment record.
 *
 * <p>{@link HostDeploymentService#createDeployment} previously took six
 * parameters. This record collapses the four deployment-specific values
 * into a single object, bringing the method signature down to three
 * parameters (pipeline ID, host ID, and this request).
 */
public record DeploymentRequest(String containerName, String imageVersion,
        int serverPort, String configHash) {
}
