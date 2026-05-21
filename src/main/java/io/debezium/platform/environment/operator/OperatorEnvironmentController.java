package io.debezium.platform.environment.operator;

import io.debezium.platform.environment.EnvironmentController;
import io.debezium.platform.environment.PipelineController;
import io.debezium.platform.environment.VaultController;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.jboss.logging.Logger;

@ApplicationScoped
@Named(OperatorEnvironmentController.BEAN_NAME)
public class OperatorEnvironmentController implements EnvironmentController {
    public static final String BEAN_NAME = "operator-environment-controller";

    protected final Logger logger;
    private final OperatorPipelineController pipelineController;
    private final OperatorVaultController vaultController;

    public OperatorEnvironmentController(
            Logger logger,
            OperatorPipelineController pipelineController,
            OperatorVaultController vaultController) {
        this.logger = logger;
        this.pipelineController = pipelineController;
        this.vaultController = vaultController;
    }

    @Override
    public PipelineController pipelines() {
        return pipelineController;
    }

    @Override
    public VaultController vaults() {
        return vaultController;
    }
}
