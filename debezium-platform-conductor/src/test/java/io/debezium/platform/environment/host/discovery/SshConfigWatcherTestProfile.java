/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.discovery;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import io.quarkus.test.junit.QuarkusTestProfile;

/**
 * Test profile that activates host deployment mode and redirects the
 * SSH config path to a temporary file seeded from the
 * {@code ssh-config/it-initial.config} test resource.
 *
 * <p>The temp directory is created once when the profile class is loaded.
 * The initial content is copied from the classpath resource to keep the
 * seed data alongside the other parser fixture files in
 * {@code src/test/resources/ssh-config/}. The IT rewrites this temp file
 * during its ordered test methods.
 */
public class SshConfigWatcherTestProfile implements QuarkusTestProfile {

    static final Path TEMP_SSH_DIR;
    static final Path TEMP_SSH_CONFIG;

    static {
        try {
            TEMP_SSH_DIR = Files.createTempDirectory("ssh-watcher-it");
            TEMP_SSH_CONFIG = TEMP_SSH_DIR.resolve("config");

            try (InputStream seed = SshConfigWatcherTestProfile.class.getClassLoader()
                    .getResourceAsStream("ssh-config/it-initial.config")) {
                if (seed == null) {
                    throw new IllegalStateException("Missing test resource: ssh-config/it-initial.config");
                }
                Files.copy(seed, TEMP_SSH_CONFIG);
            }
        }
        catch (IOException e) {
            throw new RuntimeException("Failed to create temp SSH config for IT", e);
        }
    }

    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of(
                "debezium.deployment.mode", "host",
                "platform.host.ssh-config-path", TEMP_SSH_CONFIG.toString(),
                "quarkus.oras.devservices.base-port", "25002",
                "quarkus.arc.exclude-types",
                "io.debezium.platform.environment.watcher.config.WatcherConfig,io.debezium.platform.environment.watcher.ConductorEnvironmentWatcher");
    }

    @Override
    public String getConfigProfile() {
        return "test";
    }
}
