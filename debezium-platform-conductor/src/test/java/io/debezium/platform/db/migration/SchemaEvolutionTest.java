package io.debezium.platform.db.migration;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;

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
