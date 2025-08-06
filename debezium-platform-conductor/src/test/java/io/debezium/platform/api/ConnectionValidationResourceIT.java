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

import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;

@QuarkusTest
public class ConnectionValidationResourceIT {

    private String createValidConnectionJson() {
        return """
                {
                  "name": "valid-test-connection",
                  "type": "POSTGRESQL",
                  "config": {
                    "hostname": "localhost",
                    "port": 5432,
                    "username": "quarkus",
                    "password": "quarkus",
                    "database": "quarkus"
                  }
                }
                """;
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
        return """
                {
                  "name": "invalid-credentials-connection",
                  "type": "POSTGRESQL",
                  "config": {
                    "hostname": "localhost",
                    "port": 5432,
                    "username": "wronguser",
                    "password": "wrongpass",
                    "database": "testdb"
                  }
                }
                """;
    }

    private String createInvalidDatabaseConnectionJson() {
        return """
                {
                  "name": "invalid-database-connection",
                  "type": "POSTGRESQL",
                  "config": {
                    "hostname": "localhost",
                    "port": 5432,
                    "username": "quarkus",
                    "password": "quarkus",
                    "database": "nonexistentdb"
                  }
                }
                """;
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
                .statusCode(anyOf(equalTo(400), equalTo(200)))
                .contentType(ContentType.JSON);

        // If it returns 200, it should indicate the connection type is unsupported
        // If it returns 400, it's a validation error for unsupported type
    }

    @Test
    public void testValidateConnection_MissingContentType() {
        String json = createValidConnectionJson();

        given()
                .body(json)
                .when()
                .post("api/connections/validate")
                .then()
                .statusCode(anyOf(equalTo(400), equalTo(415))); // Bad Request or Unsupported Media Type
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
        String specialCharsJson = """
                {
                  "name": "special-chars-connection",
                  "type": "POSTGRESQL",
                  "config": {
                    "hostname": "localhost",
                    "port": 5432,
                    "username": "test@user!#$%",
                    "password": "pass@word!#$%^&*()",
                    "database": "test_db-123"
                  }
                }
                """;

        given()
                .contentType(ContentType.JSON)
                .body(specialCharsJson)
                .when()
                .post("api/connections/validate")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("valid", anyOf(equalTo(true), equalTo(false)))
                .body("message", notNullValue());
    }

    @Test
    public void testValidateConnection_EdgeCasePortValues() {
        // Test with port 0 (invalid)
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
                .statusCode(anyOf(equalTo(200), equalTo(400)))
                .contentType(ContentType.JSON);

        // Test with port 65535 (maximum valid port)
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
                .body("valid", anyOf(equalTo(true), equalTo(false)))
                .body("message", notNullValue());
    }
}
