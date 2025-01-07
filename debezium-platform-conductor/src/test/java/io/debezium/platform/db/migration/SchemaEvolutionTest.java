/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.db.migration;

import static org.assertj.core.api.Assertions.assertThatCode;

import jakarta.inject.Inject;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
public class SchemaEvolutionTest {

    @Inject
    Flyway flyway;

    @Test
    public void checkMigration() {

        flyway.clean();

        assertThatCode(() -> flyway.migrate()).doesNotThrowAnyException();

    }

}
