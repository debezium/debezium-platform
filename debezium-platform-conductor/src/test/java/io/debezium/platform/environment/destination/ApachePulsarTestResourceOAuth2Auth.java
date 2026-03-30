/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.destination;

import java.util.Map;

import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.pulsar.PulsarContainer;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.MountableFile;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

public class ApachePulsarTestResourceOAuth2Auth implements QuarkusTestResourceLifecycleManager {

    private static final String OAUTH2_SERVER_NETWORK_ALIAS = "mock-oauth2-server";
    private static final int OAUTH2_SERVER_PORT = 8080;
    public static final String OAUTH2_ISSUER_ID = "default";

    // How Pulsar sees the OAuth2 provider from within the Docker network
    private static final String OAUTH2_ISSUER_URL_INTERNAL = String.format(
            "http://%s:%d/%s", OAUTH2_SERVER_NETWORK_ALIAS, OAUTH2_SERVER_PORT, OAUTH2_ISSUER_ID);

    private static final Network NETWORK = Network.newNetwork();

    // Shared test JWT token - matches the token in pulsar-standalone-jwt.conf
    public static final String TEST_JWT_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.VyRprXLybrDgsWKQEN5UnuIudMJRkwB0wpVZxIWfQLs";
    // Shared test JWT token secret key - matches the secret key in pulsar-standalone-jwt.conf
    public static final String TEST_TOKEN_SECRET_KEY = "data:application/json;base64,ewogICJjbGllbnRfaWQiOiAiYWRtaW4iLAogICJjbGllbnRfc2VjcmV0IjogImNsaWVudHNlY3JldCIsCiAgImdyYW50X3R5cGUiOiAiY2xpZW50X2NyZWRlbnRpYWxzIgp9Cg==";

    private static final GenericContainer<?> OAUTH2_SERVER = new GenericContainer<>(
            DockerImageName.parse("ghcr.io/navikt/mock-oauth2-server:latest"))
            .withNetwork(NETWORK)
            .withNetworkAliases(OAUTH2_SERVER_NETWORK_ALIAS)
            .withExposedPorts(OAUTH2_SERVER_PORT)
            .withStartupAttempts(1)
            .waitingFor(Wait.forHttp("/" + OAUTH2_ISSUER_ID + "/.well-known/openid-configuration")
                    .forPort(OAUTH2_SERVER_PORT)
                    .forStatusCode(200));

    private static final PulsarContainer PULSAR = new PulsarContainer(DockerImageName.parse("apachepulsar/pulsar:4.1.3"))
            .withNetwork(NETWORK)
            .withCopyFileToContainer(
                    MountableFile.forClasspathResource("pulsar-standalone-oauth2.conf"),
                    "/pulsar/conf/standalone-auth.conf")
            .withCommand(
                    "bin/pulsar",
                    "standalone",
                    "--config",
                    "/pulsar/conf/standalone-auth.conf")
            .dependsOn(OAUTH2_SERVER);

    public static PulsarContainer getContainer() {
        return PULSAR;
    }

    /**
     * Returns the issuer URL reachable from the host (i.e. with the mapped port),
     * to be used as {@code oauth2IssuerUrl} in test configurations.
     */
    public static String getIssuerUrl() {
        return String.format("http://%s:%d/%s",
                OAUTH2_SERVER.getHost(),
                OAUTH2_SERVER.getMappedPort(OAUTH2_SERVER_PORT),
                OAUTH2_ISSUER_ID);
    }

    @Override
    public Map<String, String> start() {
        OAUTH2_SERVER.start();
        PULSAR.start();
        return Map.of();
    }

    @Override
    public void stop() {
        PULSAR.stop();
        OAUTH2_SERVER.stop();
        NETWORK.close();
    }
}
