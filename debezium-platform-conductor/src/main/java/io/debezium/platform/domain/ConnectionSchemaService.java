/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@ApplicationScoped
public class ConnectionSchemaService {

    private static final Logger LOGGER = LoggerFactory.getLogger(ConnectionSchemaService.class);
    public static final String CONNECTION_SCHEMAS_JSON_FILE_PATH = "/connection-schemas.json";

    private String schemasJson;

    @PostConstruct
    void loadSchemas() {
        try {

            try (InputStream is = getClass().getResourceAsStream(CONNECTION_SCHEMAS_JSON_FILE_PATH)) {
                if (is == null) {
                    LOGGER.error("Schema file {} not found in resources", CONNECTION_SCHEMAS_JSON_FILE_PATH);
                    schemasJson = "[]";
                    return;
                }
                schemasJson = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            }

            LOGGER.info("Successfully loaded connection schemas from {}", CONNECTION_SCHEMAS_JSON_FILE_PATH);

        }
        catch (IOException e) {
            LOGGER.error("Error loading connection schemas: {}", e.getMessage(), e);
            schemasJson = "[]";
        }
        catch (Exception e) {
            LOGGER.error("Unexpected error loading connection schemas", e);
            schemasJson = "[]";
        }
    }

    public String getSchemasJson() {
        return schemasJson;
    }
}
