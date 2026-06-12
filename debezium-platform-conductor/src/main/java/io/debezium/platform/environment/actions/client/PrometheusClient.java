/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.actions.client;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

import io.debezium.platform.data.dto.PrometheusQueryRangeResponse;

@Path("/api/v1")
@RegisterRestClient(configKey = "prometheus-api")
public interface PrometheusClient {

    @GET
    @Path("/query_range")
    @Produces(MediaType.APPLICATION_JSON)
    PrometheusQueryRangeResponse queryRange(
                                            @QueryParam("query") String query,
                                            @QueryParam("start") String start,
                                            @QueryParam("end") String end,
                                            @QueryParam("step") String step);
}
