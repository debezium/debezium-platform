/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;

import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;

@QuarkusTest
public class ConnectionResourceIT {

    private String createTestConnectionJson(String nameSuffix) {
        return """
                {
                  "name": "test-connection-%s",
                  "type": "DB",
                  "config": {
                    "host": "localhost",
                    "port": 5432,
                    "username": "testuser",
                    "password": "testpass"
                  }
                }
                """.formatted(nameSuffix);
    }

    private String createUpdatedConnectionJson(Integer id, String nameSuffix) {
        return """
                {
                  "id": %d,
                  "name": "updated-connection-%s",
                  "type": "DB",
                  "config": {
                    "host": "updated-host",
                    "port": 5433,
                    "username": "updateduser",
                    "password": "updatedpass"
                  }
                }
                """.formatted(id, nameSuffix);
    }

    @Test
    public void testGetAllConnections() {
        given()
                .when()
                .get("api/connections")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON);
    }

    @Test
    public void testCreateConnection() {
        String nameSuffix = String.valueOf(System.currentTimeMillis());
        String json = createTestConnectionJson(nameSuffix);

        given()
                .contentType(ContentType.JSON)
                .body(json)
                .when()
                .post("api/connections")
                .then()
                .statusCode(201)
                .contentType(ContentType.JSON)
                .header("Location", notNullValue())
                .body("id", notNullValue())
                .body("name", is("test-connection-" + nameSuffix))
                .body("type", is("DB"))
                .body("config.host", is("localhost"))
                .body("config.port", is(5432))
                .body("config.username", is("testuser"));
    }

    @Test
    public void testGetConnectionById() {
        String nameSuffix = String.valueOf(System.currentTimeMillis());
        String json = createTestConnectionJson(nameSuffix);

        Integer connectionId = given()
                .contentType(ContentType.JSON)
                .body(json)
                .when()
                .post("api/connections")
                .then()
                .statusCode(201)
                .extract()
                .path("id");

        given()
                .pathParam("id", connectionId)
                .when()
                .get("api/connections/{id}")
                .then()
                .statusCode(200)
                .body("id", is(connectionId.intValue()))
                .body("name", is("test-connection-" + nameSuffix))
                .body("type", is("DB"))
                .body("config.host", is("localhost"))
                .body("config.port", is(5432))
                .body("config.username", is("testuser"));

        cleanUp(connectionId);
    }

    @Test
    public void testGetConnectionById_NotFound() {
        given()
                .pathParam("id", 99999L)
                .when()
                .get("api/connections/{id}")
                .then()
                .statusCode(404);
    }

    @Test
    public void testUpdateConnection() {
        String nameSuffix = String.valueOf(System.currentTimeMillis());
        String json = createTestConnectionJson(nameSuffix);

        Integer connectionId = given()
                .contentType(ContentType.JSON)
                .body(json)
                .when()
                .post("api/connections")
                .then()
                .statusCode(201)
                .extract()
                .path("id");

        String updatedNameSuffix = "updated-" + nameSuffix;
        String updatedJson = createUpdatedConnectionJson(connectionId, updatedNameSuffix);

        given()
                .contentType(ContentType.JSON)
                .pathParam("id", connectionId)
                .body(updatedJson)
                .when()
                .put("api/connections/{id}")
                .then()
                .statusCode(200)
                .body("id", is(connectionId.intValue()))
                .body("name", is("updated-connection-" + updatedNameSuffix))
                .body("config.host", is("updated-host"))
                .body("config.port", is(5433))
                .body("config.username", is("updateduser"));

        cleanUp(connectionId);
    }

    @Test
    public void testDeleteConnection() {
        String nameSuffix = String.valueOf(System.currentTimeMillis());
        String json = createTestConnectionJson(nameSuffix);

        Integer connectionId = given()
                .contentType(ContentType.JSON)
                .body(json)
                .when()
                .post("api/connections")
                .then()
                .statusCode(201)
                .extract()
                .path("id");

        cleanUp(connectionId);

        given()
                .pathParam("id", connectionId)
                .when()
                .get("api/connections/{id}")
                .then()
                .statusCode(404);
    }

    @Test
    public void testCreateConnection_InvalidData() {
        String invalidJson = """
                {
                  "name": ""
                }
                """;

        given()
                .contentType(ContentType.JSON)
                .body(invalidJson)
                .when()
                .post("api/connections")
                .then()
                .statusCode(400);
    }

    @Test
    public void testCreateConnection_NullBody() {
        given()
                .contentType(ContentType.JSON)
                .when()
                .post("api/connections")
                .then()
                .statusCode(400);
    }

    @Test
    public void testUpdateConnection_NotFound() {
        String nameSuffix = String.valueOf(System.currentTimeMillis());
        String updatedJson = createUpdatedConnectionJson(99999, nameSuffix);

        given()
                .contentType(ContentType.JSON)
                .pathParam("id", 99999L)
                .body(updatedJson)
                .when()
                .put("api/connections/{id}")
                .then()
                .statusCode(404);
    }

    @Test
    public void testDeleteConnection_NotFound() {
        given()
                .pathParam("id", 99999L)
                .when()
                .delete("api/connections/{id}")
                .then()
                .statusCode(204);
    }

    @Test
    public void testFullCrudWorkflow() {
        String nameSuffix = String.valueOf(System.currentTimeMillis());
        String json = createTestConnectionJson(nameSuffix);

        Integer connectionId = given()
                .contentType(ContentType.JSON)
                .body(json)
                .when()
                .post("api/connections")
                .then()
                .statusCode(201)
                .body("id", notNullValue())
                .extract()
                .path("id");

        given()
                .pathParam("id", connectionId)
                .when()
                .get("api/connections/{id}")
                .then()
                .statusCode(200)
                .body("name", is("test-connection-" + nameSuffix));

        String updatedNameSuffix = "updated-" + nameSuffix;
        String updatedJson = createUpdatedConnectionJson(connectionId, updatedNameSuffix);

        given()
                .contentType(ContentType.JSON)
                .pathParam("id", connectionId)
                .body(updatedJson)
                .when()
                .put("api/connections/{id}")
                .then()
                .statusCode(200)
                .body("name", is("updated-connection-" + updatedNameSuffix));

        cleanUp(connectionId);

        given()
                .pathParam("id", connectionId)
                .when()
                .get("api/connections/{id}")
                .then()
                .statusCode(404);
    }

    private static void cleanUp(Integer connectionId) {
        given()
                .pathParam("id", connectionId)
                .when()
                .delete("api/connections/{id}")
                .then()
                .statusCode(204);
    }
}
