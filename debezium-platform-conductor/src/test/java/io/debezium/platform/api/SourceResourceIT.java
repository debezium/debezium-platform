/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath;
import static org.hamcrest.Matchers.equalTo;

import java.sql.SQLException;
import java.sql.Statement;

import jakarta.inject.Inject;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.agroal.api.AgroalDataSource;
import io.quarkus.arc.InjectableInstance;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
class SourceResourceIT {

    @Inject
    InjectableInstance<AgroalDataSource> dataSource;

    @Test
    @DisplayName("When signal data collection is not setup then the verify will return exists false")
    void noSignalSetup() {

        String jsonBody = """
                {
                    "databaseType": "POSTGRESQL",
                    "hostname": "localhost",
                    "port": 5432,
                    "username": "quarkus",
                    "password": "quarkus",
                    "dbName": "quarkus",
                    "test": "test",
                    "fullyQualifiedTableName": "public.debezium_signal"
                }""";

        given()
                .header("Content-Type", "application/json")
                .body(jsonBody).when().post("api/sources/signals/verify")
                .then()
                .assertThat().body(matchesJsonSchemaInClasspath("schemas/signal-verify-response-schema.json"))
                .statusCode(200)
                .body("exists", equalTo(false))
                .body("message", equalTo("Signal data collection not present or misconfigured"));
    }

    @Test
    @DisplayName("When signal data collection is correctly configured then the verify will return exists true")
    void signalCorrectlyConfigured() {

        createDataSignalDataCollection();

        String jsonBody = """
                {
                    "databaseType": "POSTGRESQL",
                    "hostname": "localhost",
                    "port": 5432,
                    "username": "quarkus",
                    "password": "quarkus",
                    "dbName": "quarkus",
                    "fullyQualifiedTableName": "public.debezium_signal"
                }""";

        given()
                .header("Content-Type", "application/json")
                .body(jsonBody).when().post("api/sources/signals/verify")
                .then()
                .assertThat().body(matchesJsonSchemaInClasspath("schemas/signal-verify-response-schema.json"))
                .statusCode(200)
                .body("exists", equalTo(true))
                .body("message", equalTo("Signal data collection correctly configured"));
    }

    private void createDataSignalDataCollection() {

        AgroalDataSource dataSource = this.dataSource.get();

        try (Statement statement = dataSource.getConnection().createStatement()) {

            statement.execute("CREATE TABLE public.debezium_signal (id VARCHAR(42) PRIMARY KEY, type VARCHAR(32) NOT NULL, data VARCHAR(2048) NULL);");
        }
        catch (SQLException e) {
            throw new RuntimeException(e);
        }
    }
}
