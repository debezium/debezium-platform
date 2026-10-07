/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;

import io.debezium.platform.data.dto.SignalCollectionSetupQueryRequest;
import io.debezium.platform.data.dto.SignalCollectionSetupQueryResponse;
import io.debezium.platform.data.dto.SignalCollectionVerifyRequest;
import io.debezium.platform.data.dto.SignalDataCollectionVerifyResponse;
import io.debezium.platform.data.model.SourceEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.domain.views.Source;
import io.debezium.platform.domain.views.refs.SourceReference;
import io.debezium.platform.environment.connection.source.SourceInspector;
import io.debezium.platform.environment.connection.source.SourceInspectorFactory;
import io.debezium.platform.error.NotFoundException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import static jakarta.transaction.Transactional.TxType.SUPPORTS;

@ApplicationScoped
public class SourceService extends AbstractService<SourceEntity, Source, SourceReference> {

    private static final Logger LOGGER = LoggerFactory.getLogger(SourceService.class);

    public static final String SOURCE_REFERENCE_ATTRIBUTE = "source";

    private final PipelineService pipelineService;
    private final SourceInspectorFactory sourceInspectorFactory;
    private final ConnectionService connectionService;

    public SourceService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm,
                         ConnectionService connectionService,
                         PipelineService pipelineService,
                         SourceInspectorFactory sourceInspectorFactory) {
        super(SourceEntity.class, Source.class, SourceReference.class, em, cbf, evm);
        this.pipelineService = pipelineService;
        this.sourceInspectorFactory = sourceInspectorFactory;
        this.connectionService = connectionService;
    }

    @Transactional(SUPPORTS)
    public Optional<SourceReference> findReferenceById(Long id) {
        var result = evm.find(em, SourceReference.class, id);
        return Optional.ofNullable(result);
    }

    @Override
    @Transactional(Transactional.TxType.REQUIRED)
    public void onChange(Source source) {
        pipelineService.findViewByReference(SOURCE_REFERENCE_ATTRIBUTE, source.getId())
                .forEach(pipelineService::onChange);
    }

    public SignalCollectionSetupQueryResponse buildSignalCollectionSetupQuery(SignalCollectionSetupQueryRequest signalCollectionSetupQueryRequest) {
        try {
            String connectorType = signalCollectionSetupQueryRequest.connectorType();
            String fullyQualifiedCollectionName = signalCollectionSetupQueryRequest.fullyQualifiedCollectionName();

            String setupQuery;

            connectorType = connectorType.toLowerCase();

            if (connectorType.contains("mongo")) {
                int dotIndex = fullyQualifiedCollectionName.indexOf(".");
                if (dotIndex > 0 && dotIndex < fullyQualifiedCollectionName.length() - 1) {
                    String database = fullyQualifiedCollectionName.substring(0, dotIndex);
                    String collection = fullyQualifiedCollectionName.substring(dotIndex + 1);
                    setupQuery = String.format("db.getSiblingDB('%s').createCollection('%s')", database, collection);
                }
                else {
                    setupQuery = "db.getSiblingDB('<database>').createCollection('<collection>')";
                }
            }
            else if (connectorType.contains("postgre") || connectorType.contains("mysql") || connectorType.contains("mariadb") || connectorType.contains("sqlserver")) {
                setupQuery = String.format("CREATE TABLE %s (id VARCHAR(42) PRIMARY KEY, type VARCHAR(32) NOT NULL, data VARCHAR(2048) NULL);",
                        fullyQualifiedCollectionName);
            }
            else if (connectorType.contains("oracle")) {
                setupQuery = String.format("CREATE TABLE %s (id VARCHAR2(42) PRIMARY KEY, type VARCHAR2(32) NOT NULL, data VARCHAR2(2048) NULL);",
                        fullyQualifiedCollectionName);
            }
            else if (connectorType.contains("db2")) {
                setupQuery = String.format("CREATE TABLE %s (id VARCHAR(42) NOT NULL, type VARCHAR(32) NOT NULL, data VARCHAR(2048) NULL, PRIMARY KEY(id));",
                        fullyQualifiedCollectionName);
            }
            else if (connectorType.contains("cassandra")) {
                setupQuery = String.format("CREATE TABLE %s (id text PRIMARY KEY, type text, data text);",
                        fullyQualifiedCollectionName);
            }
            // else if (connectorType.contains("apache_pulsar") || connectorType.contains("pulsar")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("rocketmq")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("kinesis")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("eventhubs") || connectorType.contains("event_hubs")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("rabbitmq")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("jdbc")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("nats")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("kafka")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("infinispan")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("instructlab")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("fluss")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("pub_sub_lite") || connectorType.contains("pubsub_lite")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("pub_sub") || connectorType.contains("pubsub")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("pravega")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("milvus")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("qdrant")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("redis")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("http")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("sns")) {
            // setupQuery = "";
            // }
            // else if (connectorType.contains("sqs")) {
            // setupQuery = "";
            // }
            else {
                throw new Exception(String.format("No statement available for connector type: {}", connectorType));
            }

            return new SignalCollectionSetupQueryResponse(setupQuery);
        }
        catch (Exception e) {
            LOGGER.error("Failed to generate signal collection setup query: {}", e.getMessage(), e);
            return new SignalCollectionSetupQueryResponse(String.format("Failed to generate signal collection setup query: {}", e.getMessage()));
        }
    }

    public SignalDataCollectionVerifyResponse verifySignalDataCollection(SignalCollectionVerifyRequest signalCollectionVerifyRequest) {

        try {
            Connection connection = connectionService.findById(signalCollectionVerifyRequest.connectionId())
                    .orElseThrow(() -> new NotFoundException(signalCollectionVerifyRequest.connectionId()));

            SourceInspector sourceInspector = sourceInspectorFactory.getSourceInspector(connection.getType());

            return sourceInspector.verifyDataCollectionStructure(connection, signalCollectionVerifyRequest.fullyQualifiedTableName());
        }
        catch (Exception e) {
            LOGGER.error("Failed to verify signal data collection structure: {}", e.getMessage(), e);
            return new SignalDataCollectionVerifyResponse(false, e.getMessage());
        }
    }
}
