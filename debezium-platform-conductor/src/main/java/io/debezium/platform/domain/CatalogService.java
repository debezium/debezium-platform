/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import jakarta.enterprise.context.ApplicationScoped;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.platform.error.NotFoundException;
import io.debezium.util.Strings;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@ApplicationScoped
public class CatalogService {

    private static final Logger LOGGER = LoggerFactory.getLogger(CatalogService.class);

    private static final String MANIFEST_FILE_NAME = "manifest.json";
    private static final String COMPONENTS_FIELD_NAME = "components";
    private static final String DESCRIPTOR_FILE_TYPE = "json";

    @ConfigProperty(name = "conductor.descriptors.path")
    String descriptorsRootPath;

    private final ObjectMapper objectMapper;

    public CatalogService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String getCatalog(String version, String componentType) {

        Path manifestFilePath = Paths.get(descriptorsRootPath, version, MANIFEST_FILE_NAME);

        if (!Files.exists(manifestFilePath)) {
            throw new NotFoundException("Catalog not found for version: " + version);
        }

        try {
            if (Strings.isNullOrEmpty(componentType)) {
                return Files.readString(manifestFilePath);
            }

            JsonNode catalog = filterComponents(componentType, manifestFilePath);

            return catalog.toString();
        }
        catch (IOException | JacksonException e) {
            throw new RuntimeException(String.format("Error while reading catalog file %s", manifestFilePath), e);
        }
    }

    private JsonNode filterComponents(String componentType, Path manifestFilePath) throws IOException {

        JsonNode catalog = objectMapper.readTree(manifestFilePath.toFile());

        ObjectNode root = (ObjectNode) catalog;
        JsonNode components = root.get(COMPONENTS_FIELD_NAME);

        if (components != null && components.isObject()) {
            ObjectNode filteredComponents = objectMapper.createObjectNode();

            if (components.has(componentType)) {
                filteredComponents.set(componentType, components.get(componentType));
            }

            root.set(COMPONENTS_FIELD_NAME, filteredComponents);
        }
        return catalog;
    }

    public String getComponentDescriptor(String version, String componentType, String componentClass) {

        String descriptorFileName = String.format("%s.%s", componentClass, DESCRIPTOR_FILE_TYPE);
        Path manifestFilePath = Paths.get(descriptorsRootPath, version, componentType, descriptorFileName);

        if (!Files.exists(manifestFilePath)) {
            LOGGER.debug("Descriptor file for {} not found in path {}", componentClass, manifestFilePath);
            throw new NotFoundException(String.format("Descriptor not found for component %s of version %s", componentClass, version));
        }

        try {
            return Files.readString(manifestFilePath);
        }
        catch (IOException e) {
            throw new RuntimeException(String.format("Error while reading catalog file %s", manifestFilePath), e);
        }
    }
}
