/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.database.db;

import java.util.Map;
import java.util.concurrent.TimeUnit;

import org.bson.Document;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.shaded.org.awaitility.Awaitility;
import org.testcontainers.utility.DockerImageName;

import com.mongodb.client.MongoClients;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

public class MongoDbTestResource implements QuarkusTestResourceLifecycleManager {

    private static final MongoDBContainer MONGODB = new MongoDBContainer(DockerImageName.parse("mongo:7")).withReplicaSet();

    public static MongoDBContainer getMongoDBContainer() {
        return MONGODB;
    }

    @Override
    public Map<String, String> start() {
        MONGODB.start();

        String replicaSetUrl = MONGODB.getReplicaSetUrl();

        Awaitility.await()
                .atMost(60, TimeUnit.SECONDS)
                .untilAsserted(() -> {
                    try (var client = MongoClients.create(replicaSetUrl)) {
                        Document result = client.getDatabase("admin").runCommand(new Document("hello", 1));
                        if (!result.containsKey("setName")) {
                            throw new IllegalStateException("MongoDB replica set is not ready yet");
                        }
                    }
                });

        return Map.of("mongodb.connection.string", replicaSetUrl);
    }

    @Override
    public void stop() {
        MONGODB.stop();
    }
}
