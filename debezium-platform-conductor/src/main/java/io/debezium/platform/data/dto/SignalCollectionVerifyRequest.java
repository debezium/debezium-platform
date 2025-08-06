/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

import io.debezium.platform.environment.database.DatabaseConnectionConfiguration;

public class SignalCollectionVerifyRequest {

    // This is for backward compatibility, previously the configuration was directly in this class,
    // that is not a record since @JsonUnwrapped is not supported
    @JsonUnwrapped
    private DatabaseConnectionConfiguration connectionConfig;
    private String fullyQualifiedTableName;

    public SignalCollectionVerifyRequest() {
    }

    public SignalCollectionVerifyRequest(DatabaseConnectionConfiguration connectionConfig,
                                         String fullyQualifiedTableName) {
        this.connectionConfig = connectionConfig;
        this.fullyQualifiedTableName = fullyQualifiedTableName;
    }

    public DatabaseConnectionConfiguration connectionConfig() {
        return connectionConfig;
    }

    public void setConnectionConfig(DatabaseConnectionConfiguration connectionConfig) {
        this.connectionConfig = connectionConfig;
    }

    public String fullyQualifiedTableName() {
        return fullyQualifiedTableName;
    }

    public void setFullyQualifiedTableName(String fullyQualifiedTableName) {
        this.fullyQualifiedTableName = fullyQualifiedTableName;
    }
}
