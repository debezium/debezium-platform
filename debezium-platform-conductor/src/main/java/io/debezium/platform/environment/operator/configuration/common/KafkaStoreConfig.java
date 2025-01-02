/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.configuration.common;

import java.util.Map;

public record KafkaStoreConfig(String bootstrapServers, String topic, int partitions, int replicationFactor) {

    public static final String KAFKA_STORE_BOOTSTRAP_SERVERS = "bootstrap.servers";
    public static final String KAFKA_STORE_TOPIC = "topic";
    public static final String KAFKA_STORE_PARTITIONS = "partitions";
    public static final String KAFKA_STORE_REPLICATION_FACTOR = "replication.factor";
    public static final String DEFAULT_KAFKA_STORE_PARTITION = "1";
    public static final String DEFAULT_KAFKA_STORE_REPLICATION_FACTOR = "1";


    public static KafkaStoreConfig from(Map<String, String> configurations) {

        String bootstrapServers = configurations.get(KAFKA_STORE_BOOTSTRAP_SERVERS);
        String topic = configurations.get(KAFKA_STORE_TOPIC);
        int partitions = Integer.parseInt(configurations.getOrDefault(KAFKA_STORE_PARTITIONS, DEFAULT_KAFKA_STORE_PARTITION));
        int replicationFactor = Integer.parseInt(configurations.getOrDefault(KAFKA_STORE_REPLICATION_FACTOR, DEFAULT_KAFKA_STORE_REPLICATION_FACTOR));

        return new KafkaStoreConfig(bootstrapServers, topic, partitions, replicationFactor);
    }
}
