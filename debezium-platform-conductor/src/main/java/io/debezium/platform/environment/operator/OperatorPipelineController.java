/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator;

import java.util.Optional;

import jakarta.enterprise.context.Dependent;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.DebeziumException;
import io.debezium.operator.api.model.DebeziumServer;
import io.debezium.platform.domain.Signal;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.environment.PipelineController;
import io.debezium.platform.environment.logs.LogReader;
import io.debezium.platform.environment.operator.actions.DebeziumKubernetesAdapter;
import io.debezium.platform.environment.operator.actions.DebeziumServerProxy;
import io.debezium.platform.environment.operator.logs.KubernetesLogReader;

@Dependent
public class OperatorPipelineController implements PipelineController {

    private static final Logger LOGGER = LoggerFactory.getLogger(OperatorPipelineController.class);

    public static final String LABEL_DBZ_CONDUCTOR_ID = "debezium.io/conductor-id";

    private final DebeziumKubernetesAdapter kubernetesAdapter;
    private final DebeziumServerProxy debeziumServerProxy;
    private final PipelineMapper pipelineMapper;

    public OperatorPipelineController(DebeziumKubernetesAdapter kubernetesAdapter,
                                      PipelineMapper pipelineMapper,
                                      DebeziumServerProxy debeziumServerProxy) {
        this.kubernetesAdapter = kubernetesAdapter;
        this.pipelineMapper = pipelineMapper;
        this.debeziumServerProxy = debeziumServerProxy;
    }

    @Override
    public void deploy(PipelineFlat pipeline) {

        var ds = pipelineMapper.map(pipeline);

        LOGGER.debug("Going to deploy resource {}", ds);
        // apply to server
        kubernetesAdapter.deployPipeline(ds);
    }

    @Override
    public void undeploy(Long pipelineId) {
        kubernetesAdapter.undeployPipeline(pipelineId);
    }

    @Override
    public void stop(Long id) {
        kubernetesAdapter.changeStatus(id, true);
    }

    @Override
    public void start(Long id) {
        kubernetesAdapter.changeStatus(id, false);
    }

    public Optional<DebeziumServer> findById(Long id) {
        return kubernetesAdapter.findAssociatedDebeziumServer(id);
    }

    @Override
    public LogReader logReader(Long id) {
        return new KubernetesLogReader(() -> kubernetesAdapter.findLoggableDeployment(id));
    }

    @Override
    public void sendSignal(Long pipelineId, Signal signal) {
        findById(pipelineId).ifPresentOrElse(
                debeziumServer -> debeziumServerProxy.sendSignal(signal, debeziumServer),
                () -> {
                    throw new DebeziumException(String.format("Pipeline with id %s not found", pipelineId));
                });
    }
}
