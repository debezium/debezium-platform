/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

import jakarta.enterprise.context.ApplicationScoped;

import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.environment.operator.PipelineMapper;

/**
 * Converts a {@link PipelineFlat} into a flat Debezium Server
 * {@code application.properties} string suitable for host-mode deployment.
 *
 * <p>Delegates to the operator's {@link PipelineMapper} for the core
 * mapping logic, then overrides offset and schema history storage
 * to use file-based backends with container-local paths. The host's
 * data directory is bind-mounted into the container, so offset data
 * survives container restarts and redeployments.
 *
 * <p><strong>Deterministic output:</strong> A {@link TreeMap} ensures
 * alphabetical key ordering for stable SHA-256 hashing used in config
 * drift detection.
 */
@ApplicationScoped
public class HostPipelineMapper {

    // ── File-based offset/schema history storage ──
    private static final String OFFSET_STORAGE_KEY = "debezium.source.offset.storage";
    private static final String OFFSET_STORAGE_PREFIX = "debezium.source.offset.storage.";
    private static final String SCHEMA_HISTORY_KEY = "debezium.source.schema.history.internal";
    private static final String SCHEMA_HISTORY_PREFIX = "debezium.source.schema.history.internal.";

    private static final String FILE_OFFSET_STORAGE_CLASS = "org.apache.kafka.connect.storage.FileOffsetBackingStore";
    private static final String FILE_OFFSET_FILENAME = "/debezium/data/offsets.dat";

    private static final String FILE_SCHEMA_HISTORY_CLASS = "io.debezium.storage.file.history.FileSchemaHistory";
    private static final String FILE_SCHEMA_HISTORY_FILENAME = "/debezium/data/schema-history.dat";

    // ── Serialization ──
    private static final String PROPERTY_SEPARATOR = "=";
    private static final String LINE_SEPARATOR = "\n";
    private static final String HASH_ALGORITHM = "SHA-256";

    private final PipelineMapper operatorMapper;

    public HostPipelineMapper(PipelineMapper operatorMapper) {
        this.operatorMapper = operatorMapper;
    }

    /**
     * Result of mapping a pipeline to its host-mode configuration.
     *
     * @param propertiesContent the flat {@code key=value} properties string
     * @param configHash        SHA-256 hex digest for drift detection
     */
    public record MappedConfig(String propertiesContent, String configHash) {
    }

    /**
     * Maps a pipeline to its host-mode Debezium Server configuration.
     *
     * <p>Uses the operator's {@link PipelineMapper} to build the full
     * {@code DebeziumServer} CRD, then calls {@code asConfiguration()}
     * to flatten it into a properties map. Offset and schema history
     * storage are overridden from JDBC to file-based for host mode.
     *
     * @param pipeline the pipeline to map
     * @return the mapped config with properties content and hash
     */
    public MappedConfig map(PipelineFlat pipeline) {
        // 1. Delegate to operator mapper for core config generation
        Map<String, String> configMap = operatorMapper.map(pipeline)
                .asConfiguration()
                .getAsMapSimple();

        // 2. Copy into TreeMap for deterministic ordering
        TreeMap<String, String> properties = new TreeMap<>(configMap);

        // 3. Override offset storage: JDBC → file-based
        properties.entrySet().removeIf(e -> e.getKey().startsWith(OFFSET_STORAGE_PREFIX));
        properties.put(OFFSET_STORAGE_KEY, FILE_OFFSET_STORAGE_CLASS);
        properties.put(OFFSET_STORAGE_PREFIX + "file.filename", FILE_OFFSET_FILENAME);

        // 4. Override schema history: JDBC → file-based
        properties.entrySet().removeIf(e -> e.getKey().startsWith(SCHEMA_HISTORY_PREFIX) && !e.getKey().equals(SCHEMA_HISTORY_KEY));
        properties.put(SCHEMA_HISTORY_KEY, FILE_SCHEMA_HISTORY_CLASS);
        properties.put(SCHEMA_HISTORY_PREFIX + "file.filename", FILE_SCHEMA_HISTORY_FILENAME);

        // 5. Serialize and hash
        String content = serializeProperties(properties);
        String hash = computeConfigHash(content);

        return new MappedConfig(content, hash);
    }

    /**
     * Serializes the properties map to a flat key=value string without
     * the timestamp comment that {@link java.util.Properties#store} injects.
     */
    private static String serializeProperties(TreeMap<String, String> properties) {
        return properties.entrySet().stream()
                .map(entry -> entry.getKey() + PROPERTY_SEPARATOR + entry.getValue())
                .collect(Collectors.joining(LINE_SEPARATOR));
    }

    /**
     * Computes a SHA-256 hex digest of the given content string.
     */
    static String computeConfigHash(String content) {
        try {
            MessageDigest digest = MessageDigest.getInstance(HASH_ALGORITHM);
            byte[] hash = digest.digest(content.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        }
        catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }
}
