/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import jakarta.enterprise.context.ApplicationScoped;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;

import io.debezium.platform.config.PanelConfig;

@ApplicationScoped
public class PanelConfigLoader {

    private static final Logger LOGGER = LoggerFactory.getLogger(PanelConfigLoader.class);
    private static final String BUILTIN_PANELS_RESOURCE = "panels.yml";
    private static final Duration REFRESH_INTERVAL = Duration.ofSeconds(30);

    @ConfigProperty(name = "monitoring.panels.path")
    Optional<String> userPanelsPath;

    private final ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());

    private volatile List<PanelConfig> cachedPanels;
    private volatile Instant lastLoadTime = Instant.MIN;

    public List<PanelConfig> loadPanels() {
        Instant now = Instant.now();
        if (cachedPanels != null && Duration.between(lastLoadTime, now).compareTo(REFRESH_INTERVAL) < 0) {
            return cachedPanels;
        }

        List<PanelConfig> panels = doLoadPanels();
        cachedPanels = panels;
        lastLoadTime = now;
        return panels;
    }

    private List<PanelConfig> doLoadPanels() {
        Map<String, PanelConfig> panels = new LinkedHashMap<>();

        loadFromClasspath().forEach(p -> panels.put(p.id(), p));

        userPanelsPath
                .filter(path -> !path.isBlank())
                .ifPresent(path -> loadFromFile(path).forEach(p -> panels.put(p.id(), p)));

        return List.copyOf(panels.values());
    }

    private List<PanelConfig> loadFromClasspath() {
        try (InputStream is = Thread.currentThread().getContextClassLoader().getResourceAsStream(BUILTIN_PANELS_RESOURCE)) {
            if (is == null) {
                LOGGER.warn("Built-in panels resource '{}' not found on classpath", BUILTIN_PANELS_RESOURCE);
                return Collections.emptyList();
            }
            return parsePanels(is);
        }
        catch (IOException e) {
            LOGGER.error("Failed to load built-in panels", e);
            return Collections.emptyList();
        }
    }

    private List<PanelConfig> loadFromFile(String path) {
        Path filePath = Path.of(path);
        if (!Files.exists(filePath)) {
            LOGGER.debug("User panels file '{}' does not exist, skipping", path);
            return Collections.emptyList();
        }

        try (InputStream is = Files.newInputStream(filePath)) {
            List<PanelConfig> userPanels = parsePanels(is);
            LOGGER.info("Loaded {} user panel(s) from '{}'", userPanels.size(), path);
            return userPanels;
        }
        catch (IOException e) {
            LOGGER.error("Failed to load user panels from '{}'", path, e);
            return Collections.emptyList();
        }
    }

    private List<PanelConfig> parsePanels(InputStream is) throws IOException {
        PanelsFile file = yamlMapper.readValue(is, PanelsFile.class);
        if (file == null || file.panels() == null) {
            return Collections.emptyList();
        }
        return file.panels();
    }

    private record PanelsFile(List<PanelConfig> panels) {
    }
}
