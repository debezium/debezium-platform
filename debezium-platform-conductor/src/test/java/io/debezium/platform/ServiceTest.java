/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import jakarta.inject.Inject;

import org.assertj.core.api.Assertions;
import org.assertj.core.api.Assumptions;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import com.blazebit.persistence.view.EntityViewManager;

import io.debezium.platform.domain.DestinationService;
import io.debezium.platform.domain.PipelineService;
import io.debezium.platform.domain.SourceService;
import io.debezium.platform.domain.TransformService;
import io.debezium.platform.domain.VaultService;
import io.debezium.platform.domain.views.Destination;
import io.debezium.platform.domain.views.Pipeline;
import io.debezium.platform.domain.views.Source;
import io.debezium.platform.domain.views.Transform;
import io.debezium.platform.domain.views.Vault;
import io.debezium.platform.domain.views.refs.DestinationReference;
import io.debezium.platform.domain.views.refs.SourceReference;
import io.debezium.platform.domain.views.refs.VaultReference;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ServiceTest {
    @Inject
    SourceService sourceService;

    @Inject
    PipelineService pipelineService;
    @Inject
    DestinationService destinationService;
    @Inject
    VaultService vaultService;
    @Inject
    TransformService transformService;

    @Inject
    EntityViewManager evm;

    static List<Source> sources = new ArrayList<>();
    static List<Destination> destinations = new ArrayList<>();
    static List<Vault> vaults = new ArrayList<>();
    static List<Transform> transforms = new ArrayList<>();
    static Pipeline pipeline;

    @Test
    @Order(0)
    public void createVault() {
        var vault1 = evm.create(Vault.class);
        vault1.setName("vault1");
        vault1.setItems(Map.of("foo", "bar", "baz", "qux"));
        var vault2 = evm.create(Vault.class);
        vault2.setName("vault2");
        vault2.setItems(Map.of("baz", "qux"));

        vaults.add(vaultService.create(vault1));
        vaults.add(vaultService.create(vault2));
    }

    @Test
    @Order(10)
    public void updateVault() {
        var v = vaults.get(0);
        v.setItems(Map.of("foo", "bar"));
        v = vaultService.update(v);
        vaults.set(0, v);
    }

    @Test
    @Order(20)
    public void createSources() {
        Assumptions.assumeThat(vaults).hasSize(2);

        var source1 = evm.create(Source.class);
        source1.setName("source1");
        source1.setSchema("schemaXY");
        source1.setType("io.debezium.connector.MongoDbConnector");
        source1.setVaults(Set.of(vaultRef(1)));
        source1.setConfig(Map.of("mongodb.connection.string", "mongodb://localhost:27017"));

        var source2 = evm.create(Source.class);
        source2.setName("source2");
        source2.setSchema("schemaXY");
        source2.setType("io.debezium.connector.MongoDbConnector");
        source2.setVaults(Set.of(vaultRef(0)));
        source2.setConfig(Map.of("mongodb.connection.string", "mongodb://localhost:37017"));

        sources.add(sourceService.create(source1));
        sources.add(sourceService.create(source2));
    }

    @Test
    @Order(30)
    public void createDestinations() {
        Assumptions.assumeThat(vaults).hasSize(2);

        var destination1 = evm.create(Destination.class);
        destination1.setName("destination1");
        destination1.setSchema("schemaDXY");
        destination1.setType("pubsub");
        destination1.setVaults(Set.of(vaultRef(0), vaultRef(1)));
        destination1.setConfig(Map.of("foo", "bar"));

        var destination2 = evm.create(Destination.class);
        destination2.setName("destination2");
        destination2.setSchema("schemaDYZ");
        destination2.setType("redis");
        destination2.setVaults(Set.of(vaultRef(0)));
        destination2.setConfig(Map.of("bar", "baz"));

        destinations.add(destinationService.create(destination1));
        destinations.add(destinationService.create(destination2));
    }

    @Test
    @Order(40)
    public void createTransform() {
        Assumptions.assumeThat(vaults).hasSize(2);

        var transform1 = evm.create(Transform.class);
        transform1.setName("transform1");
        transform1.setSchema("schemaASD");
        transform1.setType("io.example.SomeTransform");
        transform1.setVaults(Set.of(vaultRef(0), vaultRef(1)));
        transform1.setConfig(Map.of("baz", "qux"));

        transforms.add(transformService.create(transform1));
    }

    @Test
    @Order(50)
    public void createPipeline() {
        Assumptions.assumeThat(sources).isNotEmpty();
        Assumptions.assumeThat(destinations).isNotEmpty();
        Assumptions.assumeThat(transforms).isNotEmpty();

        var sourceRef = sourceRef(0);
        var destinationRef = destinationRef(0);

        var newPipeline = evm.create(Pipeline.class);
        newPipeline.setName("pipeline1");
        newPipeline.setSource(sourceRef);
        newPipeline.setDestination(destinationRef);
        newPipeline.setLogLevel("info");

        pipeline = pipelineService.create(newPipeline);
    }

    @Test
    @Order(51)
    public void updatePipeline() {
        Assumptions.assumeThat(sources).hasSize(2);
        Assumptions.assumeThat(destinations).hasSize(2);
        Assumptions.assumeThat(pipeline).isNotNull();

        var sourceRef = sourceRef(1);
        var destinationRef = destinationRef(1);
        var uPipeline = pipelineService.findById(pipeline.getId()).orElse(null);
        uPipeline.setSource(sourceRef);
        uPipeline.setDestination(destinationRef);

        pipeline = pipelineService.update(uPipeline);
    }

    @Test
    @Order(52)
    public void listPipelines() {
        var list = pipelineService.list();

        Assertions.assertThat(list).hasSize(1);
    }

    @Test
    @Order(61)
    public void deletePipeline() {
        pipelineService.delete(pipeline.getId());

        var found = pipelineService.findById(pipeline.getId());
        Assertions.assertThat(found).isEmpty();
        Assertions.assertThat(destinationService.list()).hasSize(2);
        Assertions.assertThat(sourceService.list()).hasSize(2);
    }

    @Test
    @Order(100)
    public void foo() {
        System.out.println();
    }

    public VaultReference vaultRef(int idx) {
        return vaultService.viewAs(vaults.get(idx), VaultReference.class);
    }

    public SourceReference sourceRef(int idx) {
        return sourceService.viewAs(sources.get(idx), SourceReference.class);
    }

    public DestinationReference destinationRef(int idx) {
        return destinationService.viewAs(destinations.get(idx), DestinationReference.class);
    }
}
