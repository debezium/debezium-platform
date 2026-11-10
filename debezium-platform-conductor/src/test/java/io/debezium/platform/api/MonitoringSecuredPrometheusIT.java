/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.CoreMatchers.is;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;

import io.debezium.doc.FixFor;
import io.debezium.platform.environment.monitoring.SecuredPrometheusTestResource;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.response.ValidatableResponse;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;

/**
 * Panel queries against a Prometheus that requires TLS with a private CA and a bearer token.
 */
@QuarkusTest
@QuarkusTestResource(value = SecuredPrometheusTestResource.class, restrictToAnnotatedClass = true)
class MonitoringSecuredPrometheusIT {

    private static final String QUERY_RANGE_RESPONSE = """
            {"status":"success","data":{"resultType":"matrix","result":[
              {"metric":{"service_name":"test-pipeline"},"values":[[1745414100,"35.2"],[1745414160,"37.8"]]}
            ]}}""";

    MockWebServer prometheus;

    Path tokenFile;

    @Test
    @FixFor("debezium/dbz#3049")
    void queryPanelTrustsTheConfiguredCaAndSendsTheBearerToken() throws InterruptedException {
        prometheus.enqueue(queryRangeResponse());

        queryPanel()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("series[0].labels.service_name", is("test-pipeline"))
                .body("series[0].datapoints.size()", is(2));

        RecordedRequest request = takeRequest();
        assertThat(request.getPath()).startsWith("/api/v1/query_range?");
        assertThat(request.getHandshake()).as("request sent over TLS").isNotNull();
        assertThat(request.getHeader("Authorization")).isEqualTo("Bearer " + currentToken());
    }

    @Test
    @FixFor("debezium/dbz#3049")
    void queryPanelSendsTheTokenRotatedOnDisk() throws IOException, InterruptedException {
        String original = currentToken();
        try {
            Files.writeString(tokenFile, "rotated-token");
            prometheus.enqueue(queryRangeResponse());

            queryPanel().statusCode(200);

            assertThat(takeRequest().getHeader("Authorization")).isEqualTo("Bearer rotated-token");
        }
        finally {
            Files.writeString(tokenFile, original);
        }
    }

    private ValidatableResponse queryPanel() {
        Instant now = Instant.now();
        return given()
                .queryParam("pipeline_id", "test-pipeline")
                .queryParam("start", now.minus(5, ChronoUnit.MINUTES).toString())
                .queryParam("end", now.toString())
                .queryParam("step", "15s")
                .when()
                .get("api/monitoring/panels/streaming-event-count/query")
                .then();
    }

    private RecordedRequest takeRequest() throws InterruptedException {
        RecordedRequest request = prometheus.takeRequest(10, TimeUnit.SECONDS);
        assertThat(request).as("request received by Prometheus").isNotNull();
        return request;
    }

    private String currentToken() {
        try {
            return Files.readString(tokenFile);
        }
        catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static MockResponse queryRangeResponse() {
        return new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(QUERY_RANGE_RESPONSE);
    }
}
