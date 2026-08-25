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
import io.debezium.platform.domain.views.refs.HostStatusReference;

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
        HostStatusReference host1 = mockHost(1L, "server-1");
        HostStatusReference host2 = mockHost(2L, "server-2");
        HostStatusReference host3 = mockHost(3L, "server-3");

        // host1 has 3 pipelines, host2 has 1, host3 has 2
        stubDeploymentCounts(Map.of(1L, 3L, 2L, 1L, 3L, 2L));

        HostStatusReference selected = strategy.select(List.of(host1, host2, host3));

        assertThat(selected.getId()).isEqualTo(2L);
    }

    @Test
    void selectBreaksTiesByLowestId() {
        HostStatusReference host1 = mockHost(1L, "server-1");
        HostStatusReference host2 = mockHost(2L, "server-2");

        // Both have 0 deployments — should pick host1 (lower ID)
        stubDeploymentCounts(Map.of(1L, 0L, 2L, 0L));

        HostStatusReference selected = strategy.select(List.of(host1, host2));

        assertThat(selected.getId()).isEqualTo(1L);
    }

    @Test
    void selectThrowsWhenNoHostsAvailable() {
        assertThatThrownBy(() -> strategy.select(List.of()))
                .isInstanceOf(DebeziumException.class)
                .hasMessageContaining("No READY hosts available");
    }

    @Test
    void selectHandlesSingleHost() {
        HostStatusReference host = mockHost(1L, "server-1");
        stubDeploymentCounts(Map.of(1L, 5L));

        HostStatusReference selected = strategy.select(List.of(host));

        assertThat(selected.getId()).isEqualTo(1L);
    }

    private HostStatusReference mockHost(Long id, String sshAlias) {
        HostStatusReference host = mock(HostStatusReference.class);
        when(host.getId()).thenReturn(id);
        when(host.getSshAlias()).thenReturn(sshAlias);
        return host;
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
