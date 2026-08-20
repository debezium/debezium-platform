/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

import java.util.List;
import java.util.Map;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.UserTransaction;

import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;

@QuarkusTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class NotificationChannelResourceIT {

    private static final String BASE_PATH = "api/alerts/channels";

    static Long webhookChannelId;
    static Long emailChannelId;

    @Inject
    EntityManager em;

    @Inject
    UserTransaction tx;

    @Test
    @Order(0)
    void cleanupLeftoverData() throws Exception {
        tx.begin();
        try {
            em.createQuery("DELETE FROM notification_channel c WHERE c.name IN (:names)")
                    .setParameter("names", List.of("test-webhook", "updated-webhook", "test-email"))
                    .executeUpdate();
            tx.commit();
        }
        catch (Exception e) {
            tx.rollback();
            throw e;
        }
    }

    @Test
    @Order(1)
    void listChannelsEmpty() {
        given()
                .when().get(BASE_PATH)
                .then()
                .statusCode(200)
                .body("$", empty());
    }

    @Test
    @Order(2)
    void createChannelWebhook() {
        webhookChannelId = given()
                .contentType(ContentType.JSON)
                .body(Map.of(
                        "name", "test-webhook",
                        "type", "WEBHOOK",
                        "enabled", true,
                        "config", Map.of("url", "http://localhost:9999/hook")))
                .when().post(BASE_PATH)
                .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("name", is("test-webhook"))
                .body("type", is("WEBHOOK"))
                .body("enabled", is(true))
                .body("config.url", is("http://localhost:9999/hook"))
                .extract().jsonPath().getLong("id");
    }

    @Test
    @Order(3)
    void createChannelEmail() {
        emailChannelId = given()
                .contentType(ContentType.JSON)
                .body(Map.of(
                        "name", "test-email",
                        "type", "EMAIL",
                        "enabled", true,
                        "config", Map.of("recipients", List.of("admin@example.com"))))
                .when().post(BASE_PATH)
                .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("name", is("test-email"))
                .body("type", is("EMAIL"))
                .body("config.recipients", hasSize(1))
                .extract().jsonPath().getLong("id");
    }

    @Test
    @Order(4)
    void listChannelsAfterCreation() {
        given()
                .when().get(BASE_PATH)
                .then()
                .statusCode(200)
                .body("$", hasSize(2));
    }

    @Test
    @Order(5)
    void getChannelById() {
        given()
                .when().get(BASE_PATH + "/" + webhookChannelId)
                .then()
                .statusCode(200)
                .body("id", equalTo(webhookChannelId.intValue()))
                .body("name", is("test-webhook"))
                .body("type", is("WEBHOOK"));
    }

    @Test
    @Order(6)
    void getChannelNotFound() {
        given()
                .when().get(BASE_PATH + "/999999")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(7)
    void updateChannel() {
        given()
                .contentType(ContentType.JSON)
                .body(Map.of(
                        "name", "updated-webhook",
                        "type", "WEBHOOK",
                        "enabled", true,
                        "config", Map.of("url", "http://localhost:9999/hook-v2")))
                .when().put(BASE_PATH + "/" + webhookChannelId)
                .then()
                .statusCode(200)
                .body("name", is("updated-webhook"))
                .body("config.url", is("http://localhost:9999/hook-v2"));
    }

    @Test
    @Order(8)
    void createChannelDuplicateName() {
        given()
                .contentType(ContentType.JSON)
                .body(Map.of(
                        "name", "updated-webhook",
                        "type", "WEBHOOK",
                        "config", Map.of("url", "http://localhost:9999/other")))
                .when().post(BASE_PATH)
                .then()
                .statusCode(is(greaterThan(399)));
    }

    @Test
    @Order(9)
    void createChannelEmailNoRecipients() {
        given()
                .contentType(ContentType.JSON)
                .body(Map.of(
                        "name", "bad-email",
                        "type", "EMAIL",
                        "config", Map.of("someProp", "value")))
                .when().post(BASE_PATH)
                .then()
                .statusCode(400);
    }

    @Test
    @Order(10)
    void createChannelWebhookNoUrl() {
        given()
                .contentType(ContentType.JSON)
                .body(Map.of(
                        "name", "bad-webhook",
                        "type", "WEBHOOK",
                        "config", Map.of("method", "POST")))
                .when().post(BASE_PATH)
                .then()
                .statusCode(400);
    }

    @Test
    @Order(98)
    void deleteChannelEmail() {
        given()
                .when().delete(BASE_PATH + "/" + emailChannelId)
                .then()
                .statusCode(204);
    }

    @Test
    @Order(99)
    void deleteChannelWebhook() {
        given()
                .when().delete(BASE_PATH + "/" + webhookChannelId)
                .then()
                .statusCode(204);

        given()
                .when().get(BASE_PATH)
                .then()
                .statusCode(200)
                .body("$", empty());
    }
}
