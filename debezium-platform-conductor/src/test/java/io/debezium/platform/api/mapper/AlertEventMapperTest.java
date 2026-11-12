/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.mapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

import io.debezium.platform.data.model.Severity;
import io.debezium.platform.domain.views.AlertEvent;

class AlertEventMapperTest {

    private final AlertEventMapper mapper = Mappers.getMapper(AlertEventMapper.class);

    @Test
    void mapsResolvedEvent() {
        AlertEvent event = mock(AlertEvent.class);
        Instant firedAt = Instant.parse("2026-01-01T10:00:00Z");
        Instant resolvedAt = Instant.parse("2026-01-01T10:02:00Z");

        when(event.getId()).thenReturn(10L);
        when(event.getRuleId()).thenReturn(20L);
        when(event.getRuleName()).thenReturn("test-rule");
        when(event.getPipelineId()).thenReturn("pipeline-1");
        when(event.getPipelineName()).thenReturn("pipeline-1");
        when(event.getValue()).thenReturn(25.0);
        when(event.getThreshold()).thenReturn(10.0);
        when(event.getSeverity()).thenReturn(Severity.WARNING);
        when(event.getMessage()).thenReturn("test message");
        when(event.getFiredAt()).thenReturn(firedAt);
        when(event.getResolvedAt()).thenReturn(resolvedAt);
        when(event.getCreatedAt()).thenReturn(firedAt);

        var response = mapper.toResponse(event);

        assertThat(response.id()).isEqualTo(10L);
        assertThat(response.ruleId()).isEqualTo(20L);
        assertThat(response.ruleName()).isEqualTo("test-rule");
        assertThat(response.pipelineId()).isEqualTo("pipeline-1");
        assertThat(response.pipelineName()).isEqualTo("pipeline-1");
        assertThat(response.value()).isEqualTo(25.0);
        assertThat(response.threshold()).isEqualTo(10.0);
        assertThat(response.severity()).isEqualTo(Severity.WARNING);
        assertThat(response.message()).isEqualTo("test message");
        assertThat(response.firedAt()).isEqualTo(firedAt);
        assertThat(response.resolvedAt()).isEqualTo(resolvedAt);
        assertThat(response.createdAt()).isEqualTo(firedAt);
        assertThat(response.status()).isEqualTo("resolved");
        assertThat(response.durationSeconds()).isEqualTo(120L);
    }

    @Test
    void mapsFiringEvent() {
        AlertEvent event = mock(AlertEvent.class);
        Instant firedAt = Instant.now().minusSeconds(60);

        when(event.getFiredAt()).thenReturn(firedAt);

        var response = mapper.toResponse(event);

        assertThat(response.status()).isEqualTo("firing");
        assertThat(response.resolvedAt()).isNull();
        assertThat(response.durationSeconds()).isGreaterThanOrEqualTo(60L);
    }

    @Test
    void mapsNullToNull() {
        assertThat(mapper.toResponse(null)).isNull();
    }
}