/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.strategy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.debezium.DebeziumException;
import io.debezium.platform.domain.Host;

/**
 * Unit tests for {@link RoundRobinStrategy}.
 */
class RoundRobinStrategyTest {

    private EntityManager em;
    private RoundRobinStrategy strategy;

    @BeforeEach
    void setUp() {
        em = mock(EntityManager.class);
        strategy = new RoundRobinStrategy(em);
    }

    @Test
    void selectReturnsLeastLoadedHost() {
        Host host1 = new Host(1L, "server-1");
        Host host2 = new Host(2L, "server-2");
        Host host3 = new Host(3L, "server-3");

        // host1 has 3 pipelines, host2 has 1, host3 has 2
        stubDeploymentCounts(Map.of(1L, 3L, 2L, 1L, 3L, 2L));

        Host selected = strategy.select(List.of(host1, host2, host3));

        assertThat(selected.id()).isEqualTo(2L);
    }

    @Test
    void selectBreaksTiesByLowestId() {
        Host host1 = new Host(1L, "server-1");
        Host host2 = new Host(2L, "server-2");

        // Both have 0 deployments — should pick host1 (lower ID)
        stubDeploymentCounts(Map.of(1L, 0L, 2L, 0L));

        Host selected = strategy.select(List.of(host1, host2));

        assertThat(selected.id()).isEqualTo(1L);
    }

    @Test
    void selectThrowsWhenNoHostsAvailable() {
        assertThatThrownBy(() -> strategy.select(List.of()))
                .isInstanceOf(DebeziumException.class)
                .hasMessageContaining("No READY hosts available");
    }

    @Test
    void selectHandlesSingleHost() {
        Host host = new Host(1L, "server-1");
        stubDeploymentCounts(Map.of(1L, 5L));

        Host selected = strategy.select(List.of(host));

        assertThat(selected.id()).isEqualTo(1L);
    }

    @SuppressWarnings("unchecked")
    private void stubDeploymentCounts(Map<Long, Long> counts) {
        when(em.createQuery(anyString(), eq(Long.class))).thenAnswer(inv -> {
            TypedQuery<Long> query = mock(TypedQuery.class);
            final Long[] currentHostId = new Long[1];
            when(query.setParameter(eq("hostId"), any())).thenAnswer(paramInv -> {
                currentHostId[0] = paramInv.getArgument(1, Long.class);
                return query;
            });
            when(query.getSingleResult()).thenAnswer(resInv -> counts.getOrDefault(currentHostId[0], 0L));
            return query;
        });
    }
}
