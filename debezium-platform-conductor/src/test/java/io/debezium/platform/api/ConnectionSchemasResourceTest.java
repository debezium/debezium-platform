/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.instanceOf;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import io.debezium.platform.data.model.ConnectionEntity;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;

@QuarkusTest
class ConnectionSchemasResourceTest {

    @Test
    void shouldReturnValidJsonArray() {

        given()
                .when()
                .get("/api/connections/schemas")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("$", instanceOf(List.class)); // Validates it's a JSON array
    }

    @Test
    void shouldReturnNonEmptySchemas() {

        given()
                .when()
                .get("/api/connections/schemas")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("size()", greaterThan(0));
    }

    @Test
    void shouldReturnSchemasWithExpectedStructure() {

        given()
                .when()
                .get("/api/connections/schemas")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("[0]", hasKey("type"))
                .body("[0]", hasKey("schema"))
                .body("[0].type", equalTo("POSTGRESQL"))
                .body("[0].schema", hasKey("title"))
                .body("[0].schema", hasKey("description"))
                .body("[0].schema", hasKey("properties"))
                .body("[0].schema", hasKey("required"));
    }

    @Test
    void shouldReturnPostgresSchemaWithCorrectProperties() {

        given()
                .when()
                .get("/api/connections/schemas")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("[0].schema.properties", hasKey("hostname"))
                .body("[0].schema.properties", hasKey("port"))
                .body("[0].schema.properties", hasKey("username"))
                .body("[0].schema.properties", hasKey("password"))
                .body("[0].schema.required", hasItems("hostname", "port", "username", "password"))
                .body("[0].schema.properties.hostname.type", equalTo("string"))
                .body("[0].schema.properties.port.type", equalTo("integer"));
    }

    @Test
    void shouldReturnCorrectSchemaMetadata() {

        given()
                .when()
                .get("/api/connections/schemas")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("[0].schema.title", equalTo("PostgreSQL connection properties"))
                .body("[0].schema.description", equalTo("PostgreSQL connection properties"))
                .body("[0].schema.type", equalTo("object"));
    }

    /*
     * This test act as a contract so that when a new connection type is added
     * this will fail if no schema is provided for it
     *
     * This is disabled at the moment since not all validation implementation are provided
     */
    @Disabled
    @Test
    void assureThatAllConnectionTypesAsASchemaDefinition() {

        List<String> expectedTypes = Arrays.stream(ConnectionEntity.Type.values())
                .map(Enum::name)
                .toList();

        List<String> actualTypes = given()
                .when()
                .get("/api/connections/schemas")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .extract()
                .jsonPath()
                .getList("type");

        assertThat(actualTypes).containsExactlyInAnyOrderElementsOf(expectedTypes);
    }
}
