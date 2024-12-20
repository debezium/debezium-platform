/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.configuration;

import io.debezium.DebeziumException;
import io.debezium.operator.api.model.source.Offset;
import io.debezium.operator.api.model.source.OffsetBuilder;
import io.debezium.operator.api.model.source.storage.offset.FileOffsetStoreBuilder;
import io.debezium.operator.api.model.source.storage.offset.JdbcOffsetStoreBuilder;
import io.debezium.operator.api.model.source.storage.offset.JdbcOffsetTableConfigBuilder;
import io.debezium.platform.config.PipelineConfigGroup;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.storage.jdbc.JdbcCommonConfig;
import jakarta.enterprise.context.Dependent;

import java.util.Map;

@Dependent
public class OffsetConfigurationFactory {

    private static final String JDBC = "io.debezium.storage.jdbc.offset.JdbcOffsetBackingStore";
    private static final String FILE = "org.apache.kafka.connect.storage.FileOffsetBackingStore";
    public static final String OFFSET_SUFFIX = "offset";
    private static final String FILE_OFFSET_STORE_FILE_FILENAME_CONFIG = "file.filename";

    private final PipelineConfigGroup pipelineConfigGroup;
    private final TableNameResolver tableNameResolver;

    public OffsetConfigurationFactory(PipelineConfigGroup pipelineConfigGroup, TableNameResolver tableNameResolver) {

        this.pipelineConfigGroup = pipelineConfigGroup;
        this.tableNameResolver = tableNameResolver;
    }

    public Offset create(PipelineFlat pipeline) {

        var pipelineOffsetConfigs = pipelineConfigGroup.offset().storage().config();
        var type = pipelineConfigGroup.offset().storage().type();
        return switch (type) {
            case JDBC -> buildJdbcConfigs(pipeline, pipelineOffsetConfigs);
            case FILE ->  buildFileConfigs(pipelineOffsetConfigs);
            default -> throw new DebeziumException(String.format("Offset type %s not supported", type));
        };
    }

    private Offset buildFileConfigs(Map<String, String> pipelineOffsetConfigs) {

        return new OffsetBuilder()
                .withFile(new FileOffsetStoreBuilder()
                        .withFileName(pipelineOffsetConfigs.get(FILE_OFFSET_STORE_FILE_FILENAME_CONFIG)).build()).build();
    }

    private Offset buildJdbcConfigs(PipelineFlat pipeline, Map<String, String> pipelineOffsetConfigs) {

        return new OffsetBuilder()
                .withJdbc(new JdbcOffsetStoreBuilder()
                        .withUrl(pipelineOffsetConfigs.get(JdbcCommonConfig.PROP_JDBC_URL.name()))
                        .withUser(pipelineOffsetConfigs.get(JdbcCommonConfig.PROP_USER.name()))
                        .withPassword(pipelineOffsetConfigs.get(JdbcCommonConfig.PROP_PASSWORD.name()))
                        .withTable(new JdbcOffsetTableConfigBuilder()
                                .withName(tableNameResolver.resolve(pipeline, OFFSET_SUFFIX))
                                .build())
                        .build()
                )
                .build();
    }
}
