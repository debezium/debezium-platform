/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.strategy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.debezium.DebeziumException;
import io.debezium.platform.data.model.HostStatusEntity;

/**
 * Unit tests for {@link RoundRobinStrategy}.
 */
class RoundRobinStrategyTest {

    private final RoundRobinStrategy strategy = new RoundRobinStrategy();

    @Test
    void selectReturnsLeastLoadedHost() {
        HostStatusEntity host1 = createHost(1L, "server-1");
        HostStatusEntity host2 = createHost(2L, "server-2");
        HostStatusEntity host3 = createHost(3L, "server-3");

        // host1 has 3 pipelines, host2 has 1, host3 has 2
        Map<Long, Long> loadMap = Map.of(1L, 3L, 2L, 1L, 3L, 2L);

        HostStatusEntity selected = strategy.select(
                List.of(host1, host2, host3),
                loadMap::get);

        assertThat(selected.getId()).isEqualTo(2L);
    }

    @Test
    void selectBreaksTiesByLowestId() {
        HostStatusEntity host1 = createHost(1L, "server-1");
        HostStatusEntity host2 = createHost(2L, "server-2");

        // Both have 0 deployments — should pick host1 (lower ID)
        Map<Long, Long> loadMap = Map.of(1L, 0L, 2L, 0L);

        HostStatusEntity selected = strategy.select(
                List.of(host1, host2),
                loadMap::get);

        assertThat(selected.getId()).isEqualTo(1L);
    }

    @Test
    void selectThrowsWhenNoHostsAvailable() {
        assertThatThrownBy(() -> strategy.select(List.of(), id -> 0L))
                .isInstanceOf(DebeziumException.class)
                .hasMessageContaining("No READY hosts available");
    }

    @Test
    void selectHandlesSingleHost() {
        HostStatusEntity host = createHost(1L, "server-1");
        Map<Long, Long> loadMap = Map.of(1L, 5L);

        HostStatusEntity selected = strategy.select(List.of(host), loadMap::get);

        assertThat(selected.getId()).isEqualTo(1L);
    }

    private static HostStatusEntity createHost(Long id, String alias) {
        HostStatusEntity host = new HostStatusEntity();
        host.setId(id);
        host.setSshAlias(alias);
        return host;
    }
}
