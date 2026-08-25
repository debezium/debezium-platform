/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import io.debezium.platform.domain.views.refs.HostStatusReference;

/**
 * Result of host selection and port allocation.
 *
 * <p>Returned by {@link HostDeploymentService#allocateHostAndPort()}.
 * Uses the {@link HostStatusReference} Blaze-Persistence view instead
 * of a JPA entity so that callers never handle persistence-layer types.
 *
 * @param host          the selected host
 * @param allocatedPort the unique port assigned for this deployment
 */
public record HostAllocation(HostStatusReference host, int allocatedPort) {
}
