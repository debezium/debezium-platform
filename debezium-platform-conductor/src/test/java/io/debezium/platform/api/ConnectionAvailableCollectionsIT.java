/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.CoreMatchers.is;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;

@QuarkusTest
public class ConnectionAvailableCollectionsIT {

    private String createConnectionRequest() {
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

    private String createWrongConnectionRequest() {
        return """
                {
                  "name": "invalid-test-connection",
                  "type": "POSTGRESQL",
                  "config": {
                    "hostname": "not-exist",
                    "port": 5432,
                    "username": "quarkus",
                    "password": "quarkus",
                    "database": "quarkus"
                  }
                }
                """;
    }

    @BeforeEach
    void setUp() {

        Response response = given()
                .header("Content-Type", "application/json")
                .when()
                .get("api/connections")
                .then()
                .statusCode(200)
                .extract()
                .response();

        List<Integer> connectionIds = response.jsonPath().getList("id", Integer.class);

        for (Integer connectionId : connectionIds) {
            given()
                    .header("Content-Type", "application/json")
                    .when()
                    .delete("api/connections/" + connectionId)
                    .then()
                    .statusCode(204);
        }
    }

    @Test
    public void testValidCollectionList() {

        given()
                .header("Content-Type", "application/json")
                .body(createConnectionRequest()).when().post("api/connections")
                .then()
                .statusCode(201);

        Response response = given()
                .contentType(ContentType.JSON)
                .when()
                .get("api/connections/1/collections")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .extract().response();

        JsonPath jsonPath = response.jsonPath();

        List<Map<String, Object>> catalogs = jsonPath.getList("catalogs");
        assertThat(catalogs).isNotEmpty();

        Map<String, Object> firstCatalog = catalogs.get(0);
        assertCatalogHasTheExpectedFormat(firstCatalog);

        List<Map<String, Object>> schemas = jsonPath.getList("catalogs[0].schemas");
        assertThat(schemas).isNotEmpty();

        Map<String, Object> firstSchema = schemas.get(0);
        assertSchemaHasTheExpectedFormat(firstSchema);

        List<Map<String, Object>> tables = (List<Map<String, Object>>) firstSchema.get("collections");
        assertThat(tables).isNotEmpty();

        Map<String, Object> firstTable = tables.get(0);
        assertCollectionHasTheExpectedFormat(firstTable);

        // Cross-field validations using extracted values
        String catalogName = jsonPath.getString("catalogs[0].name");
        String schemaName = jsonPath.getString("catalogs[0].schemas[0].name");
        String tableName = jsonPath.getString("catalogs[0].schemas[0].collections[0].name");
        String fullyQualifiedName = jsonPath.getString("catalogs[0].schemas[0].collections[0].fullyQualifiedName");

        assertCorrectnessOfFullyQualifiedName(fullyQualifiedName, catalogName, schemaName, tableName);

        assertCountsMatches(tables, jsonPath, schemas);

    }

    @Test
    public void testNotExistingConnection() {

        Response response = given()
                .header("Content-Type", "application/json")
                .body(createWrongConnectionRequest())
                .when()
                .post("api/connections")
                .then()
                .statusCode(201)
                .extract()
                .response();

        Long connectionId = response.jsonPath().getLong("id");

        given()
                .contentType(ContentType.JSON)
                .when()
                .get("api/connections/" + connectionId + "/collections")
                .then()
                .statusCode(500)
                .contentType(ContentType.JSON)
                .body("error", is("An unexpected error happened"))
                .body("details[0]", is("Unable to get available collections from host not-exist"));

    }

    @Test
    public void testNotWorkingConnection() {

        given()
                .contentType(ContentType.JSON)
                .when()
                .get("api/connections/0/collections")
                .then()
                .statusCode(404)
                .contentType(ContentType.JSON);

    }

    private static void assertCountsMatches(List<Map<String, Object>> tables, JsonPath jsonPath, List<Map<String, Object>> schemas) {
        int expectedTableCount = tables.size();
        Integer actualTableCount = jsonPath.get("catalogs[0].schemas[0].collectionCount");
        assertThat(actualTableCount).isEqualTo(expectedTableCount);

        int expectedTotalTables = schemas.stream()
                .mapToInt(schema -> (Integer) schema.get("collectionCount"))
                .sum();
        Integer actualTotalTables = jsonPath.get("catalogs[0].totalCollections");
        assertThat(actualTotalTables).isEqualTo(expectedTotalTables);
    }

    private static void assertCorrectnessOfFullyQualifiedName(String fullyQualifiedName, String catalogName, String schemaName, String tableName) {
        // There is discussion in progress on if postgresql should have catalog set to null or not
        // assertThat(fullyQualifiedName).contains(catalogName);
        assertThat(fullyQualifiedName).contains(schemaName);
        assertThat(fullyQualifiedName).contains(tableName);
    }

    private static void assertCollectionHasTheExpectedFormat(Map<String, Object> firstTable) {
        assertThat(firstTable).containsKeys("name", "fullyQualifiedName");
        assertThat(firstTable.get("name")).isInstanceOf(String.class);
        assertThat(firstTable.get("fullyQualifiedName")).isInstanceOf(String.class);
    }

    private static void assertSchemaHasTheExpectedFormat(Map<String, Object> firstSchema) {
        assertThat(firstSchema).containsKeys("name", "collections", "collectionCount");
        assertThat(firstSchema.get("name")).isInstanceOf(String.class);
        assertThat(firstSchema.get("collectionCount")).isInstanceOf(Integer.class);
        assertThat((Integer) firstSchema.get("collectionCount")).isPositive();
    }

    private static void assertCatalogHasTheExpectedFormat(Map<String, Object> firstCatalog) {
        assertThat(firstCatalog).containsKeys("name", "schemas", "totalCollections");
        // There is discussion in progress on if postgresql should have catalog set to null or not
        // assertThat(firstCatalog.get("name")).isInstanceOf(String.class);
        assertThat(firstCatalog.get("totalCollections")).isInstanceOf(Integer.class);
        assertThat((Integer) firstCatalog.get("totalCollections")).isPositive();
    }

}
