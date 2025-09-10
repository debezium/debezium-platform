/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static jakarta.transaction.Transactional.TxType.SUPPORTS;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;

import io.debezium.platform.data.dto.CatalogNode;
import io.debezium.platform.data.dto.CollectionNode;
import io.debezium.platform.data.dto.CollectionTree;
import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.dto.SchemaNode;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.domain.views.refs.ConnectionReference;
import io.debezium.platform.environment.connection.ConnectionValidator;
import io.debezium.platform.environment.connection.ConnectionValidatorFactory;
import io.debezium.platform.environment.database.DatabaseConnectionConfiguration;
import io.debezium.platform.environment.database.DatabaseConnectionFactory;
import io.debezium.platform.environment.database.DatabaseInspector;
import io.debezium.platform.error.NotFoundException;

@ApplicationScoped
public class ConnectionService extends AbstractService<ConnectionEntity, Connection, ConnectionReference> {

    private static final Logger LOGGER = LoggerFactory.getLogger(ConnectionService.class);

    private final ConnectionValidatorFactory connectionValidatorFactory;
    private final DatabaseInspector databaseInspector;
    private final DatabaseConnectionFactory databaseConnectionFactory;

    public ConnectionService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm, DatabaseConnectionFactory databaseConnectionFactory,
                             ConnectionValidatorFactory connectionValidatorFactory, DatabaseInspector databaseInspector) {
        super(ConnectionEntity.class, Connection.class, ConnectionReference.class, em, cbf, evm);

        this.connectionValidatorFactory = connectionValidatorFactory;
        this.databaseInspector = databaseInspector;
        this.databaseConnectionFactory = databaseConnectionFactory;
    }

    @Transactional(SUPPORTS)
    public Optional<ConnectionReference> findReferenceById(Long id) {
        var result = evm.find(em, ConnectionReference.class, id);
        return Optional.ofNullable(result);
    }

    public ConnectionValidationResult validateConnection(@NotNull @Valid Connection connection) {

        ConnectionValidator connectionValidator = connectionValidatorFactory.getValidator(connection.getType().name());

        return connectionValidator.validate(connection);
    }

    public CollectionTree listAvailableCollections(Long id) {

        Connection connectionConfig = findById(id).orElseThrow(() -> new NotFoundException(id));

        DatabaseConnectionConfiguration databaseConnectionConfiguration = DatabaseConnectionConfiguration.from(connectionConfig);
        try (java.sql.Connection conn = databaseConnectionFactory.create(databaseConnectionConfiguration)) {

            Map<String, Map<String, List<CollectionNode>>> allTableNames = databaseInspector.getAllTableNames(conn);

            List<CatalogNode> catalogs = allTableNames.entrySet().stream()
                    .map(this::extractCatalogNode)
                    .toList();

            return new CollectionTree(catalogs);
        }
        catch (Exception e) {
            LOGGER.error("Unable to get available collections from host {}", databaseConnectionConfiguration.hostname(), e);
            throw new RuntimeException(String.format("Unable to get available collections from host %s", databaseConnectionConfiguration.hostname()), e);
        }
    }

    private CatalogNode extractCatalogNode(Map.Entry<String, Map<String, List<CollectionNode>>> catalogEntry) {
        List<SchemaNode> schemas = catalogEntry.getValue().entrySet().stream()
                .map(this::extractSchemaNode)
                .toList();

        int totalTables = schemas.stream()
                .mapToInt(SchemaNode::collectionCount)
                .sum();

        return new CatalogNode(
                catalogEntry.getKey(),
                List.copyOf(schemas),
                totalTables);
    }

    private SchemaNode extractSchemaNode(Map.Entry<String, List<CollectionNode>> schemaEntry) {
        List<CollectionNode> tablesList = schemaEntry.getValue();
        return new SchemaNode(
                schemaEntry.getKey(),
                List.copyOf(tablesList),
                tablesList.size());

    }
}
