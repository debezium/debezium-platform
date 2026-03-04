/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import java.time.Duration;

/**
 * Utility class providing common helper methods for integration tests.
 */
public final class TestHelper {

    private static final String TEST_PROPERTY_PREFIX = "debezium.test.";

    private TestHelper() {
    }

    /**
     * Returns the maximum time to wait for a container to become ready.
     * Can be configured via the {@code debezium.test.container.waittime} system property
     * (value in seconds). Defaults to 300 seconds.
     *
     * @return the wait {@link Duration} for container startup
     */
    public static Duration waitTimeForContainer() {
        int seconds = Integer.parseInt(System.getProperty(TEST_PROPERTY_PREFIX + "container.waittime", "300"));
        return Duration.ofSeconds(seconds);
    }
}
