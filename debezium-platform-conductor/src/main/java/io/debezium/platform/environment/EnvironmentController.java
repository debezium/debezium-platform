package io.debezium.platform.environment;

public interface EnvironmentController {

    PipelineController pipelines();
    VaultController vaults();

}
