/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.anyOf;
import static org.hamcrest.CoreMatchers.equalTo;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.junit.jupiter.api.Test;

import io.debezium.platform.util.TestDatasourceHelper;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;

@QuarkusTest
public class ConnectionValidationResourceIT {

    @ConfigProperty(name = "quarkus.datasource.jdbc.url")
    String datasourceUrl;

    @ConfigProperty(name = "quarkus.datasource.username")
    String datasourceUsername;

    @ConfigProperty(name = "quarkus.datasource.password")
    String datasourcePassword;

    private String createValidConnectionJson() {
        TestDatasourceHelper dbHelper = TestDatasourceHelper.parsePostgresJdbcUrl(datasourceUrl);

        return """
                {
                  "name": "valid-test-connection",
                  "type": "POSTGRESQL",
                  "config": {
                    "hostname": "%s",
                    "port": %s,
                    "username": "%s",
                    "password": "%s",
                    "database": "%s"
                  }
                }
                """.formatted(dbHelper.getHostname(), dbHelper.getPort(), datasourceUsername, datasourcePassword, dbHelper.getDatabase());
    }

    private String createInvalidHostConnectionJson() {
        return """
                {
                  "name": "invalid-host-connection",
                  "type": "POSTGRESQL",
                  "config": {
                    "hostname": "non-existent-host-12345.invalid",
                    "port": 5432,
                    "username": "testuser",
                    "password": "testpass",
                    "database": "testdb"
                  }
                }
                """;
    }

    private String createInvalidPortConnectionJson() {
        return """
                {
                  "name": "invalid-port-connection",
                  "type": "POSTGRESQL",
                  "config": {
                    "hostname": "localhost",
                    "port": 9999,
                    "username": "testuser",
                    "password": "testpass",
                    "database": "testdb"
                  }
                }
                """;
    }

    private String createInvalidCredentialsConnectionJson() {
        TestDatasourceHelper dbHelper = TestDatasourceHelper.parsePostgresJdbcUrl(datasourceUrl);

        return """
                {
                  "name": "invalid-credentials-connection",
                  "type": "POSTGRESQL",
                  "config": {
                    "hostname": "%s",
                    "port": %s,
                    "username": "wronguser",
                    "password": "wrongpass",
                    "database": "testdb"
                  }
                }
                """.formatted(dbHelper.getHostname(), dbHelper.getPort());
    }

    private String createInvalidDatabaseConnectionJson() {
        TestDatasourceHelper dbHelper = TestDatasourceHelper.parsePostgresJdbcUrl(datasourceUrl);

        return """
                {
                  "name": "invalid-database-connection",
                  "type": "POSTGRESQL",
                  "config": {
                    "hostname": "%s",
                    "port": %s,
                    "username": "%s",
                    "password": "%s",
                    "database": "nonexistentdb"
                  }
                }
                """.formatted(dbHelper.getHostname(), dbHelper.getPort(), datasourceUsername, datasourcePassword);
    }

    private String createUnsupportedTypeConnectionJson() {
        return """
                {
                  "name": "unsupported-type-connection",
                  "type": "UNSUPPORTED_DB",
                  "config": {
                    "hostname": "localhost",
                    "port": 5432,
                    "username": "testuser",
                    "password": "testpass",
                    "database": "testdb"
                  }
                }
                """;
    }

    @Test
    public void testValidateConnection_ValidConnection() {
        String json = createValidConnectionJson();

        given()
                .contentType(ContentType.JSON)
                .body(json)
                .when()
                .post("api/connections/validate")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("valid", is(true))
                .body("message", notNullValue());
    }

    @Test
    public void testValidateConnection_InvalidHost() {
        String json = createInvalidHostConnectionJson();

        given()
                .contentType(ContentType.JSON)
                .body(json)
                .when()
                .post("api/connections/validate")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("valid", is(false))
                .body("message", is("The connection attempt failed."))
                .body("errorType", equalTo("CONNECTION_ERROR"));
    }

    @Test
    public void testValidateConnection_InvalidPort() {
        String json = createInvalidPortConnectionJson();

        given()
                .contentType(ContentType.JSON)
                .body(json)
                .when()
                .post("api/connections/validate")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("valid", is(false))
                .body("message",
                        is("Connection to localhost:9999 refused. Check that the hostname and port are correct and that the postmaster is accepting TCP/IP connections."))
                .body("errorType", equalTo("CONNECTION_ERROR"));
    }

    @Test
    public void testValidateConnection_InvalidCredentials() {
        String json = createInvalidCredentialsConnectionJson();

        given()
                .contentType(ContentType.JSON)
                .body(json)
                .when()
                .post("api/connections/validate")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("valid", is(false))
                .body("message", is("FATAL: password authentication failed for user \"wronguser\""))
                .body("errorType", equalTo("CONNECTION_ERROR"));
    }

    @Test
    public void testValidateConnection_InvalidDatabase() {
        String json = createInvalidDatabaseConnectionJson();

        given()
                .contentType(ContentType.JSON)
                .body(json)
                .when()
                .post("api/connections/validate")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("valid", is(false))
                .body("message", is("FATAL: database \"nonexistentdb\" does not exist"))
                .body("errorType", equalTo("CONNECTION_ERROR"));
    }

    @Test
    public void testValidateConnection_NullBody() {
        given()
                .contentType(ContentType.JSON)
                .when()
                .post("api/connections/validate")
                .then()
                .statusCode(400);
    }

    @Test
    public void testValidateConnection_MalformedJson() {
        String malformedJson = "{ invalid json }";

        given()
                .contentType(ContentType.JSON)
                .body(malformedJson)
                .when()
                .post("api/connections/validate")
                .then()
                .statusCode(400);
    }

    @Test
    public void testValidateConnection_UnsupportedConnectionType() {
        String json = createUnsupportedTypeConnectionJson();

        given()
                .contentType(ContentType.JSON)
                .body(json)
                .when()
                .post("api/connections/validate")
                .then()
                .statusCode(anyOf(equalTo(400)))
                .contentType(ContentType.JSON);
    }

    @Test
    public void testValidateConnection_MissingContentType() {
        String json = createValidConnectionJson();

        given()
                .body(json)
                .when()
                .post("api/connections/validate")
                .then()
                .statusCode(anyOf(equalTo(400)));
    }

    @Test
    public void testValidateConnection_WrongContentType() {
        String json = createValidConnectionJson();

        given()
                .contentType("text/plain")
                .body(json)
                .when()
                .post("api/connections/validate")
                .then()
                .statusCode(equalTo(400));
    }

    @Test
    public void testValidateConnection_SpecialCharactersInConfig() {
        TestDatasourceHelper dbHelper = TestDatasourceHelper.parsePostgresJdbcUrl(datasourceUrl);

        String specialCharsJson = """
                {
                  "name": "special-chars-connection",
                  "type": "POSTGRESQL",
                  "config": {
                    "hostname": "%s",
                    "port": %s,
                    "username": "test@user!#$%%",
                    "password": "testpass@word!#$%%^&*()",
                    "database": "test_db-123"
                  }
                }
                """.formatted(dbHelper.getHostname(), dbHelper.getPort());

        given()
                .contentType(ContentType.JSON)
                .body(specialCharsJson)
                .when()
                .post("api/connections/validate")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("valid", equalTo(false))
                .body("message", notNullValue());
    }

    @Test
    public void testValidateConnection_EdgeCasePortValues() {

        String invalidPortJson = """
                {
                  "name": "invalid-port-zero-connection",
                  "type": "POSTGRESQL",
                  "config": {
                    "hostname": "localhost",
                    "port": 0,
                    "username": "testuser",
                    "password": "testpass",
                    "database": "testdb"
                  }
                }
                """;

        given()
                .contentType(ContentType.JSON)
                .body(invalidPortJson)
                .when()
                .post("api/connections/validate")
                .then()
                .statusCode(equalTo(200))
                .contentType(ContentType.JSON)
                .body("message", equalTo("Unable to parse URL jdbc:postgresql://localhost:0/testdb"));

        String maxPortJson = """
                {
                  "name": "max-port-connection",
                  "type": "POSTGRESQL",
                  "config": {
                    "hostname": "localhost",
                    "port": 65535,
                    "username": "testuser",
                    "password": "testpass",
                    "database": "testdb"
                  }
                }
                """;

        given()
                .contentType(ContentType.JSON)
                .body(maxPortJson)
                .when()
                .post("api/connections/validate")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("valid", equalTo(false))
                .body("message", equalTo(
                        "Connection to localhost:65535 refused. Check that the hostname and port are correct and that the postmaster is accepting TCP/IP connections."));
    }
}
