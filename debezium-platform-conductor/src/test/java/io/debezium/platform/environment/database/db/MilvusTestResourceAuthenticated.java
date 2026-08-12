/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.database.db;

import java.time.Duration;
import java.util.Map;

import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.images.builder.Transferable;
import org.testcontainers.utility.DockerImageName;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

/**
 * Test resource for Milvus vector database using Testcontainers WITH authentication.
 *
 * <p>This class provides a containerized Milvus instance WITH authorization enabled
 * for integration testing. It manages the lifecycle of a Docker container running
 * Milvus server in standalone mode, making it suitable for testing authenticated
 * connection validation scenarios (username/password and token based).</p>
 *
 * <p>The Milvus instance is configured with:
 * <ul>
 *   <li>Default port 19530 mapped to a random host port</li>
 *   <li>Authorization enabled ({@code common.security.authorizationEnabled=true})</li>
 *   <li>Default root credentials ({@code root}/{@code Milvus})</li>
 *   <li>Standalone mode (single-node deployment)</li>
 * </ul>
 * </p>
 *
 */
public class MilvusTestResourceAuthenticated implements QuarkusTestResourceLifecycleManager {

    public static final String USERNAME = "root";
    public static final String PASSWORD = "Milvus";

    private static final String MILVUS_IMAGE = "mirror.gcr.io/milvusdb/milvus:v2.6.4";
    private static final int MILVUS_GRPC_PORT = 19530;
    private static final int MILVUS_HTTP_PORT = 9091;
    private static final Duration MILVUS_STARTUP_TIMEOUT = Duration.ofMinutes(10);

    private static final String EMBED_ETCD_CONFIG_PATH = "/milvus/configs/embedEtcd.yaml";
    private static final String EMBED_ETCD_CONFIG = "listen-client-urls: http://0.0.0.0:2379\n"
            + "advertise-client-urls: http://0.0.0.0:2379\n";

    private static GenericContainer<?> milvusContainer;

    @Override
    public Map<String, String> start() {
        milvusContainer = new GenericContainer<>(DockerImageName.parse(MILVUS_IMAGE))
                .withExposedPorts(MILVUS_GRPC_PORT, MILVUS_HTTP_PORT)
                .withCommand("milvus", "run", "standalone")
                .withEnv("DEPLOY_MODE", "STANDALONE")
                .withEnv("COMMON_SECURITY_AUTHORIZATIONENABLED", "true")
                .withEnv("ETCD_USE_EMBED", "true")
                .withEnv("ETCD_DATA_DIR", "/var/lib/milvus/etcd")
                .withEnv("ETCD_CONFIG_PATH", EMBED_ETCD_CONFIG_PATH)
                .withEnv("COMMON_STORAGETYPE", "local")
                .withCopyToContainer(Transferable.of(EMBED_ETCD_CONFIG), EMBED_ETCD_CONFIG_PATH)
                .waitingFor(Wait.forHttp("/healthz")
                        .forPort(MILVUS_HTTP_PORT)
                        .withStartupTimeout(MILVUS_STARTUP_TIMEOUT));

        milvusContainer.start();

        return Map.of(
                "milvus.host", milvusContainer.getHost(),
                "milvus.grpc.port", milvusContainer.getMappedPort(MILVUS_GRPC_PORT).toString(),
                "milvus.http.port", milvusContainer.getMappedPort(MILVUS_HTTP_PORT).toString());
    }

    @Override
    public void stop() {
        if (milvusContainer != null) {
            milvusContainer.stop();
        }
    }

    public static GenericContainer<?> getContainer() {
        return milvusContainer;
    }
}
