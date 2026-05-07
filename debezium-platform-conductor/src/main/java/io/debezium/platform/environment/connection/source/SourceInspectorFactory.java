/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.source;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.literal.NamedLiteral;

import io.debezium.platform.data.model.ConnectionEntity;

@ApplicationScoped
public class SourceInspectorFactory {

    private final Instance<SourceInspector> sourceInspectors;

    public SourceInspectorFactory(Instance<SourceInspector> sourceInspectors) {
        this.sourceInspectors = sourceInspectors;
    }

    public SourceInspector getSourceInspector(ConnectionEntity.Type connectionType) {
        if (connectionType == null) {
            throw new IllegalArgumentException("Connection type is required to select a source inspector.");
        }

        String inspectorName = switch (connectionType) {
            case ORACLE, MYSQL, MARIADB, SQLSERVER, POSTGRESQL -> "JDBC_SOURCE_INSPECTOR";
            case MONGODB -> "MONGODB_SOURCE_INSPECTOR";
            default -> throw new IllegalArgumentException("Unsupported source type: " + connectionType);
        };

        return sourceInspectors.select(NamedLiteral.of(inspectorName)).get();
    }
}
