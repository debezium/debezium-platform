/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;

import java.sql.SQLException;
import java.sql.Statement;
import java.util.stream.Stream;

import jakarta.inject.Inject;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import io.agroal.api.AgroalDataSource;
import io.debezium.platform.util.TestDatasourceHelper;
import io.quarkus.arc.InjectableInstance;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;

@QuarkusTest
class SourceResourceIT {

    @Inject
    InjectableInstance<AgroalDataSource> dataSource;

    @ConfigProperty(name = "quarkus.datasource.jdbc.url")
    String datasourceUrl;

    @ConfigProperty(name = "quarkus.datasource.username")
    String datasourceUsername;

    @ConfigProperty(name = "quarkus.datasource.password")
    String datasourcePassword;

    @Test
    @DisplayName("When signal data collection is not setup then the verify will return exists false")
    void noSignalSetup() {
        TestDatasourceHelper dbHelper = TestDatasourceHelper.parsePostgresJdbcUrl(datasourceUrl);

        String jsonBody = """
                {
                    "databaseType": "POSTGRESQL",
                    "hostname": "%s",
                    "port": %s,
                    "username": "%s",
                    "password": "%s",
                    "dbName": "%s",
                    "test": "test",
                    "fullyQualifiedTableName": "public.debezium_signal"
                }""".formatted(dbHelper.getHostname(), dbHelper.getPort(), datasourceUsername, datasourcePassword, dbHelper.getDatabase());

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

        TestDatasourceHelper dbHelper = TestDatasourceHelper.parsePostgresJdbcUrl(datasourceUrl);

        String jsonBody = """
                {
                    "databaseType": "POSTGRESQL",
                    "hostname": "%s",
                    "port": %s,
                    "username": "%s",
                    "password": "%s",
                    "dbName": "%s",
                    "fullyQualifiedTableName": "public.debezium_signal"
                }""".formatted(dbHelper.getHostname(), dbHelper.getPort(), datasourceUsername, datasourcePassword, dbHelper.getDatabase());

        given()
                .header("Content-Type", "application/json")
                .body(jsonBody).when().post("api/sources/signals/verify")
                .then()
                .assertThat().body(matchesJsonSchemaInClasspath("schemas/signal-verify-response-schema.json"))
                .statusCode(200)
                .body("exists", equalTo(true))
                .body("message", equalTo("Signal data collection correctly configured"));
    }

    @ParameterizedTest(name = "Creating a source with empty {0} should return 400")
    @MethodSource("invalidSourceRequests")
    void createSourceWithInvalidField(String fieldName, String jsonBody) {
        given()
                .contentType(ContentType.JSON)
                .body(jsonBody)
                .when()
                .post("api/sources")
                .then()
                .statusCode(400)
                .body("title", is("Constraint Violation"))
                .body("violations.field", hasItem("post.request." + fieldName));
    }

    static Stream<Arguments> invalidSourceRequests() {
        return Stream.of(
                Arguments.of("name", """
                        {
                          "name": "",
                          "type": "postgres",
                          "schema": "dummy",
                          "config": {}
                        }"""),
                Arguments.of("type", """
                        {
                          "name": "test-source",
                          "type": "",
                          "schema": "dummy",
                          "config": {}
                        }"""),
                Arguments.of("schema", """
                        {
                          "name": "test-source",
                          "type": "postgres",
                          "schema": "",
                          "config": {}
                        }"""));
    }

    @Test
    @DisplayName("Sending a null body to POST sources should return 400")
    void createSourceWithNullBody() {
        given()
                .contentType(ContentType.JSON)
                .when()
                .post("api/sources")
                .then()
                .statusCode(400);
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
