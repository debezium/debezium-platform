/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination.pulsar;

import java.util.Base64;
import java.util.Map;

import org.apache.pulsar.client.admin.PulsarAdminBuilder;

/**
 * Strategy interface for applying and validating authentication settings used to connect to Apache Pulsar.
 * <p>
 * Implementations of this interface encapsulate the behavior required for a specific Pulsar
 * authentication scheme, such as no authentication, basic authentication, or JWT-based authentication.
 * They are responsible for:
 * </p>
 * <ul>
 *   <li>validating that all required authentication-related configuration values are present and well-formed, and</li>
 *   <li>configuring a {@link PulsarAdminBuilder} with the authentication mechanism expected by Pulsar.</li>
 * </ul>
 *
 * <p>
 * The {@code config} map contains connection properties associated with a Pulsar destination.
 * Implementations may read authentication-specific keys from this map, such as usernames,
 * passwords, or tokens.
 * </p>
 */
public interface PulsarAuthHandler {

    /**
     * Configures the provided {@link PulsarAdminBuilder} with the authentication settings
     * required by this handler.
     * <p>
     * Implementations may add authentication credentials or other related settings to the builder.
     * This method assumes that the supplied configuration has already been validated.
     * </p>
     *
     * @param builder the Pulsar admin builder to configure; must not be {@code null}
     * @param config the Pulsar connection configuration containing authentication properties;
     *               must not be {@code null}
     */
    void configure(PulsarAdminBuilder builder, Map<String, Object> config);

    /**
     * Validates the authentication-related configuration required by this handler.
     * <p>
     * Implementations should verify that required configuration keys are present and that their
     * values are valid for the corresponding authentication scheme. If validation fails, an
     * {@link IllegalArgumentException} should be thrown with a descriptive message.
     * </p>
     *
     * @param config the Pulsar connection configuration to validate; must not be {@code null}
     * @throws IllegalArgumentException if required configuration values are missing, blank, or invalid
     */
    void validate(Map<String, Object> config) throws IllegalArgumentException;

    /**
     * Utility method to check whether a configuration value is missing or blank.
     * <p>
     * A value is considered missing if the map does not contain the key, if the associated value
     * is {@code null}, or if the string representation of the value is blank after trimming.
     * </p>
     *
     * @param config the configuration map to inspect; must not be {@code null}
     * @param key the configuration key to look up
     * @return {@code true} if the key is absent, mapped to {@code null}, or mapped to a blank value;
     *         {@code false} otherwise
     */
    default boolean isConfigValueMissing(Map<String, ?> config, String key) {
        return !config.containsKey(key) ||
                config.get(key) == null ||
                config.get(key).toString().trim().isEmpty();
    }
}
