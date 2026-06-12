/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import io.debezium.platform.config.PanelConfig;

class PanelConfigLoaderTest {

    private static final Duration DEFAULT_REFRESH = Duration.ofSeconds(30);

    private PanelConfigLoader createLoader(Optional<String> panelsPath) {
        return new PanelConfigLoader(panelsPath, DEFAULT_REFRESH);
    }

    @Test
    void loadBuiltInPanelsFromClasspath() {
        var loader = createLoader(Optional.empty());

        List<PanelConfig> panels = loader.loadPanels();

        assertThat(panels).isNotEmpty();
        assertThat(panels).extracting(PanelConfig::id).contains("streaming-event-count", "source-lag");
    }

    @Test
    void builtInPanelsHaveRequiredFields() {
        var loader = createLoader(Optional.empty());

        List<PanelConfig> panels = loader.loadPanels();

        for (PanelConfig panel : panels) {
            assertThat(panel.id()).isNotBlank();
            assertThat(panel.title()).isNotBlank();
            assertThat(panel.query()).isNotBlank();
            assertThat(panel.visualization()).isNotNull();
            assertThat(panel.visualization().type()).isNotBlank();
        }
    }

    @Test
    void loadUserPanelsFromFile() throws Exception {
        String testPanelsPath = Path.of(getClass().getClassLoader().getResource("test-panels.yml").toURI()).toString();
        var loader = createLoader(Optional.of(testPanelsPath));

        List<PanelConfig> panels = loader.loadPanels();

        assertThat(panels).extracting(PanelConfig::id).contains("user-custom-panel");

        PanelConfig customPanel = panels.stream()
                .filter(p -> "user-custom-panel".equals(p.id()))
                .findFirst()
                .orElseThrow();

        assertThat(customPanel.title()).isEqualTo("Custom Panel");
        assertThat(customPanel.category()).isEqualTo("custom");
        assertThat(customPanel.unit()).isEqualTo("ops/s");
        assertThat(customPanel.visualization().type()).isEqualTo("line");
        assertThat(customPanel.visualization().suggestedStep()).isEqualTo("30s");
    }

    @Test
    void userPanelsOverrideBuiltInWithSameId() throws Exception {
        String overridePath = Path.of(getClass().getClassLoader().getResource("user-override-panels.yml").toURI()).toString();
        var loader = createLoader(Optional.of(overridePath));

        List<PanelConfig> panels = loader.loadPanels();

        List<PanelConfig> eventCountPanels = panels.stream()
                .filter(p -> "streaming-event-count".equals(p.id()))
                .toList();

        assertThat(eventCountPanels).hasSize(1);
        assertThat(eventCountPanels.getFirst().title()).isEqualTo("Overridden Event Count");
    }

    @Test
    void nonExistentUserPanelsPathIsIgnored(@TempDir Path tempDir) {
        var loader = createLoader(Optional.of(tempDir.resolve("does-not-exist.yml").toString()));

        List<PanelConfig> panels = loader.loadPanels();

        assertThat(panels).isNotEmpty();
        assertThat(panels).extracting(PanelConfig::id).contains("streaming-event-count");
    }

    @Test
    void blankUserPanelsPathIsIgnored() {
        var loader = createLoader(Optional.of("   "));

        List<PanelConfig> panels = loader.loadPanels();

        assertThat(panels).isNotEmpty();
    }

    @Test
    void emptyOptionalUserPanelsPathIsIgnored() {
        var loader = createLoader(Optional.empty());

        List<PanelConfig> panels = loader.loadPanels();

        assertThat(panels).isNotEmpty();
    }

    @Test
    void returnsCachedPanelsWithinRefreshInterval() {
        var loader = new PanelConfigLoader(Optional.empty(), Duration.ofMinutes(10));

        List<PanelConfig> first = loader.loadPanels();
        List<PanelConfig> second = loader.loadPanels();

        assertThat(first).isSameAs(second);
    }

    @Test
    void refreshesCacheAfterExpiry() throws Exception {
        var loader = new PanelConfigLoader(Optional.empty(), Duration.ZERO);

        List<PanelConfig> first = loader.loadPanels();

        Thread.sleep(1);

        List<PanelConfig> refreshed = loader.loadPanels();

        assertThat(refreshed).isNotSameAs(first);
        assertThat(refreshed).isEqualTo(first);
    }
}
