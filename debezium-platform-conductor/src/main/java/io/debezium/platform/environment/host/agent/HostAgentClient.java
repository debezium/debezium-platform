/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.agent;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.ProcessingException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;

import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.jboss.logging.Logger;

import io.debezium.DebeziumException;

/**
 * Service wrapper around {@link HostAgentApi} that handles URL construction,
 * per-host bearer-token propagation, and error mapping.
 *
 * <p>Each remote host runs an Agent at a unique {@code hostname:agentPort}
 * with its own bearer token. This class takes those values as parameters
 * (resolved from the {@code HostDeployment} Blaze view) and passes them
 * to every REST call.
 *
 * <p>Mirrors the existing {@code DebeziumServerProxy} wrapper in the
 * operator path, which wraps {@code DebeziumServerClient}.
 *
 * @see HostAgentApi
 *
 * @author Divyanshu Kumar Nayak
 */
@ApplicationScoped
public class HostAgentClient {

    private final Logger logger;
    private final HostAgentApi agentApi;

    public HostAgentClient(Logger logger, @RestClient HostAgentApi agentApi) {
        this.logger = logger;
        this.agentApi = agentApi;
    }

    /**
     * Sends a deploy request to the Agent running on the given host.
     *
     * @param hostname       the remote host's IP or hostname
     * @param agentPort      the Agent's HTTP port
     * @param agentToken     the bearer token for authentication
     * @param containerName  container name to deploy
     * @param image          Docker image to run
     * @param port           host port to bind
     * @param configContent  application.properties content
     */
    public void deploy(String hostname, int agentPort, String agentToken,
                       String containerName, String image, int port, String configContent) {
        String baseUrl = buildBaseUrl(hostname, agentPort);

        logger.infov("Sending deploy request to Agent at {0} for container {1}", baseUrl, containerName);

        try {
            try (Response response = agentApi.deploy(baseUrl, agentToken,
                    new AgentDeployRequest(containerName, image, port, configContent))) {
                if (response.getStatus() != 202) {
                    throw new DebeziumException("Agent deploy returned unexpected status "
                            + response.getStatus() + ": " + response.readEntity(String.class));
                }
            }
        }
        catch (WebApplicationException e) {
            throw new DebeziumException("Agent deploy failed on " + hostname + ": "
                    + e.getMessage(), e);
        }
    }

    /**
     * Sends an undeploy request to the Agent.
     */
    public void undeploy(String hostname, int agentPort, String agentToken, String containerName) {
        String baseUrl = buildBaseUrl(hostname, agentPort);

        logger.infov("Sending undeploy request to Agent at {0} for container {1}", baseUrl, containerName);

        try {
            try (Response response = agentApi.undeploy(baseUrl, agentToken, containerName)) {
                if (response.getStatusInfo().getFamily() != Response.Status.Family.SUCCESSFUL) {
                    logger.warnv("Agent undeploy returned {0} for {1} on {2}, proceeding",
                            response.getStatus(), containerName, hostname);
                }
            }
        }
        catch (WebApplicationException e) {
            logger.warnv("Agent undeploy failed for {0} on {1}: {2}, proceeding",
                    containerName, hostname, e.getMessage());
        }
    }

    /**
     * Sends a stop request to the Agent.
     */
    public void stop(String hostname, int agentPort, String agentToken, String containerName) {
        String baseUrl = buildBaseUrl(hostname, agentPort);

        try {
            try (Response response = agentApi.stop(baseUrl, agentToken, containerName)) {
                if (response.getStatusInfo().getFamily() != Response.Status.Family.SUCCESSFUL) {
                    throw new DebeziumException("Agent stop returned " + response.getStatus());
                }
            }
        }
        catch (WebApplicationException e) {
            throw new DebeziumException("Agent stop failed for " + containerName
                    + " on " + hostname + ": " + e.getMessage(), e);
        }
    }

    /**
     * Sends a start request to the Agent.
     */
    public void start(String hostname, int agentPort, String agentToken, String containerName) {
        String baseUrl = buildBaseUrl(hostname, agentPort);

        try {
            try (Response response = agentApi.start(baseUrl, agentToken, containerName)) {
                if (response.getStatusInfo().getFamily() != Response.Status.Family.SUCCESSFUL) {
                    throw new DebeziumException("Agent start returned " + response.getStatus());
                }
            }
        }
        catch (WebApplicationException e) {
            throw new DebeziumException("Agent start failed for " + containerName
                    + " on " + hostname + ": " + e.getMessage(), e);
        }
    }

    /**
     * Queries the Agent for container status.
     *
     * @return the container status, or {@code null} if the container does not exist (404)
     */
    public AgentContainerStatus status(String hostname, int agentPort, String agentToken,
                                       String containerName) {
        String baseUrl = buildBaseUrl(hostname, agentPort);

        try {
            try (Response response = agentApi.status(baseUrl, agentToken, containerName)) {
                if (response.getStatus() == 404) {
                    return null;
                }
                if (response.getStatus() != 200) {
                    throw new DebeziumException("Agent status returned " + response.getStatus());
                }
                return response.readEntity(AgentContainerStatus.class);
            }
        }
        catch (WebApplicationException e) {
            if (e.getResponse() != null && e.getResponse().getStatus() == 404) {
                return null;
            }
            throw new DebeziumException("Agent status failed for " + containerName
                    + " on " + hostname + ": " + e.getMessage(), e);
        }
        catch (ProcessingException e) {
            // Covers read timeouts and connection-refused errors.
            // Wrapping as DebeziumException lets RetryingRunnable retry the call
            // and lets the poller skip the cycle gracefully (WARN, not ERROR)
            // when all retries are exhausted.
            throw new DebeziumException("Agent status unreachable for " + containerName
                    + " on " + hostname + " (transient): " + e.getMessage(), e);
        }
    }

    /**
     * Retrieves container logs from the Agent.
     */
    public String logs(String hostname, int agentPort, String agentToken, String containerName) {
        String baseUrl = buildBaseUrl(hostname, agentPort);

        try {
            try (Response response = agentApi.logs(baseUrl, agentToken, containerName)) {
                if (response.getStatusInfo().getFamily() != Response.Status.Family.SUCCESSFUL) {
                    return "[Log retrieval failed: Agent returned HTTP " + response.getStatus() + "]";
                }
                return response.readEntity(String.class);
            }
        }
        catch (WebApplicationException e) {
            return "[Log retrieval failed: " + e.getMessage() + "]";
        }
    }

    private static String buildBaseUrl(String hostname, int agentPort) {
        return String.format("http://%s:%d", hostname, agentPort);
    }
}
