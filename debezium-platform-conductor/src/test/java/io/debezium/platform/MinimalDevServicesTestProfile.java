/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform;

import java.util.Map;

import io.quarkus.test.junit.QuarkusTestProfile;

/**
 * Keeps only the dev services the conductor itself needs to boot, namely the datasource.
 * <p>
 * Tests that bring their own container through a {@code @QuarkusTestResource} already force a Quarkus
 * restart, and every restart otherwise drags along a Kafka broker, an ORAS registry and a Kubernetes
 * API server that the test never touches. Disabling them is the difference between a few seconds and
 * tens of seconds per class.
 * <p>
 * Note that {@link #getConfigProfile()} is deliberately not overridden: returning a custom name would
 * replace the {@code test} profile rather than extend it, and the {@code %test} block in
 * {@code application.yml} carries settings these tests rely on, such as {@code quarkus.http.test-port}.
 */
public class MinimalDevServicesTestProfile implements QuarkusTestProfile {

    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of(
                // Both are @Startup beans that reach out over the network before any test runs, and neither is
                // involved in validating a connection:
                // - OperatorPipelineStatusWatcher opens an informer against the Kubernetes API server. Leaving
                // it in place while the Kubernetes dev service is off is worse than keeping the dev service,
                // because the client falls back to in-cluster config and blocks on kubernetes.default.svc.
                // - ConductorEnvironmentWatcher builds and starts a Debezium engine.
                "quarkus.arc.exclude-types",
                "io.debezium.platform.environment.operator.OperatorPipelineStatusWatcher,"
                        + "io.debezium.platform.environment.watcher.config.WatcherConfig,"
                        + "io.debezium.platform.environment.watcher.ConductorEnvironmentWatcher",
                // %test turns the volume source off, which sends OCIArtifactLoader to the ORAS registry on
                // startup. Turning it back on makes it return immediately without pulling anything.
                "conductor.descriptors.volume-source", "true",
                "quarkus.kubernetes-client.devservices.enabled", "false",
                "quarkus.kafka.devservices.enabled", "false");
    }
}
