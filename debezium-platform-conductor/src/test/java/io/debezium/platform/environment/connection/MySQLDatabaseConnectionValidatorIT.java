/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import org.testcontainers.containers.JdbcDatabaseContainer;

import io.debezium.platform.MinimalDevServicesTestProfile;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.environment.database.db.MySQLTestResource;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

@QuarkusTest
@TestProfile(MinimalDevServicesTestProfile.class)
@QuarkusTestResource(value = MySQLTestResource.class, restrictToAnnotatedClass = true)
class MySQLDatabaseConnectionValidatorIT extends AbstractDatabaseConnectionValidatorIT {

    @Override
    protected ConnectionEntity.Type getDatabaseType() {
        return ConnectionEntity.Type.MYSQL;
    }

    @Override
    protected JdbcDatabaseContainer<?> getContainer() {
        return MySQLTestResource.getContainer();
    }
}
