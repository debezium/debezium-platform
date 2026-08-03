/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;

@QuarkusTest
class TransformResourceIT {

    @Test
    @DisplayName("A transform created without a predicate does not report one")
    void transformWithoutPredicateOmitsPredicate() {
        String body = """
                {
                    "name": "transform-without-predicate-%s",
                    "description": "no predicate configured",
                    "type": "io.debezium.transforms.ExtractNewRecordState",
                    "schema": "string",
                    "vaults": [],
                    "config": {
                        "add.fields": "op"
                    }
                }
                """.formatted(System.nanoTime());

        Integer id = given()
                .contentType(ContentType.JSON)
                .body(body)
                .when().post("/api/transforms")
                .then()
                .statusCode(201)
                .body("$", not(hasKey("predicate")))
                .extract().path("id");

        given()
                .when().get("/api/transforms/{id}", id)
                .then()
                .statusCode(200)
                .body("$", not(hasKey("predicate")));
    }

    @Test
    @DisplayName("A transform created with a predicate round-trips it unchanged")
    void transformWithPredicateKeepsPredicate() {
        String body = """
                {
                    "name": "transform-with-predicate-%s",
                    "description": "predicate configured",
                    "type": "io.debezium.transforms.ExtractNewRecordState",
                    "schema": "string",
                    "vaults": [],
                    "config": {
                        "add.fields": "op"
                    },
                    "predicate": {
                        "type": "org.apache.kafka.connect.transforms.predicates.TopicNameMatches",
                        "config": {
                            "pattern": "orders.*"
                        },
                        "negate": true
                    }
                }
                """.formatted(System.nanoTime());

        Integer id = given()
                .contentType(ContentType.JSON)
                .body(body)
                .when().post("/api/transforms")
                .then()
                .statusCode(201)
                .extract().path("id");

        given()
                .when().get("/api/transforms/{id}", id)
                .then()
                .statusCode(200)
                .body("predicate.type", is("org.apache.kafka.connect.transforms.predicates.TopicNameMatches"))
                .body("predicate.config.pattern", equalTo("orders.*"))
                .body("predicate.negate", is(true));
    }
}
