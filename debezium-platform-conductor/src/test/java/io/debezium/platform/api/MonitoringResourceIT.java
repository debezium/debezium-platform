/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.not;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.Test;

import io.debezium.platform.environment.monitoring.PrometheusTestResource;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;

@QuarkusTest
@QuarkusTestResource(value = PrometheusTestResource.class, restrictToAnnotatedClass = true)
class MonitoringResourceIT {

    @Test
    void listPanelsReturnsPanels() {
        given()
                .when()
                .get("api/monitoring/panels")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("panels", notNullValue())
                .body("panels", not(empty()))
                .body("panels[0].id", is("streaming-event-count"))
                .body("panels[0].title", is("Streaming Event Count"))
                .body("panels[0].category", is("streaming"))
                .body("panels[0].unit", is("events/s"))
                .body("panels[0].visualization.type", is("area"))
                .body("panels[0].visualization.suggestedStep", is("15s"));
    }

    @Test
    void queryPanelReturnsDataFromPrometheus() {
        Instant now = Instant.now();
        String start = now.minus(5, ChronoUnit.MINUTES).toString();
        String end = now.toString();

        given()
                .queryParam("pipeline_id", "test-pipeline")
                .queryParam("start", start)
                .queryParam("end", end)
                .queryParam("step", "15s")
                .when()
                .get("api/monitoring/panels/streaming-event-count/query")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("panelId", is("streaming-event-count"))
                .body("pipelineId", is("test-pipeline"))
                .body("series", not(empty()))
                .body("series[0].labels.service_name", is("test-pipeline"))
                .body("series[0].datapoints", not(empty()))
                .body("metadata.queryDurationMs", notNullValue());
    }

    @Test
    void queryPanelReturns404ForUnknownPanel() {
        given()
                .queryParam("pipeline_id", "test-pipeline")
                .queryParam("start", Instant.now().minus(5, ChronoUnit.MINUTES).toString())
                .queryParam("end", Instant.now().toString())
                .when()
                .get("api/monitoring/panels/unknown-panel/query")
                .then()
                .statusCode(404);
    }

    @Test
    void queryPanelReturns400ForInvalidPipelineId() {
        given()
                .queryParam("pipeline_id", "invalid'; DROP TABLE--")
                .queryParam("start", Instant.now().minus(5, ChronoUnit.MINUTES).toString())
                .queryParam("end", Instant.now().toString())
                .when()
                .get("api/monitoring/panels/streaming-event-count/query")
                .then()
                .statusCode(400)
                .body("title", is("Constraint Violation"));
    }

    @Test
    void queryPanelReturns400ForMissingPipelineId() {
        given()
                .queryParam("start", Instant.now().minus(5, ChronoUnit.MINUTES).toString())
                .queryParam("end", Instant.now().toString())
                .when()
                .get("api/monitoring/panels/streaming-event-count/query")
                .then()
                .statusCode(400)
                .body("title", is("Constraint Violation"));
    }

    @Test
    void queryPanelReturns400ForMissingStart() {
        given()
                .queryParam("pipeline_id", "test-pipeline")
                .queryParam("end", Instant.now().toString())
                .when()
                .get("api/monitoring/panels/streaming-event-count/query")
                .then()
                .statusCode(400)
                .body("title", is("Constraint Violation"));
    }

    @Test
    void queryPanelReturns400ForMissingEnd() {
        given()
                .queryParam("pipeline_id", "test-pipeline")
                .queryParam("start", Instant.now().minus(5, ChronoUnit.MINUTES).toString())
                .when()
                .get("api/monitoring/panels/streaming-event-count/query")
                .then()
                .statusCode(400)
                .body("title", is("Constraint Violation"));
    }

    @Test
    void queryPanelUsesDefaultStepWhenOmitted() {
        Instant now = Instant.now();

        given()
                .queryParam("pipeline_id", "test-pipeline")
                .queryParam("start", now.minus(5, ChronoUnit.MINUTES).toString())
                .queryParam("end", now.toString())
                .when()
                .get("api/monitoring/panels/streaming-event-count/query")
                .then()
                .statusCode(200)
                .body("timeRange.step", is("15s"))
                .body("series", not(empty()))
                .body("series[0].datapoints.size()", greaterThan(0));
    }
}
