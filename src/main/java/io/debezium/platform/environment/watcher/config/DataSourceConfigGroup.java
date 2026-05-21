package io.debezium.platform.environment.watcher.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithName;

@ConfigMapping(prefix = "quarkus.datasource")
public interface DataSourceConfigGroup {

    String username();
    String password();
    @WithName("jdbc.url")
    String url();
}
