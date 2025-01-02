/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.configuration.common;

import java.util.Map;

public record RedisStoreConfig(RedisConnectionConfig connectionConfig, String key, RedisWriteConfig writeConfig) {

    public static final String REDIS_STORE_ADDRESS = "address";
    public static final String REDIS_STORE_USER = "user";
    public static final String REDIS_STORE_PASSWORD = "password";
    public static final String REDIS_STORE_SSL_ENABLED = "ssl.enabled";
    public static final String REDIS_STORE_KEY = "key";
    public static final String REDIS_STORE_WRITE_WAIT_ENABLED = "wait.enabled";
    public static final String REDIS_STORE_WRITE_WAIT_TIMEOUT_MS = "wait.timeout.ms";
    public static final String REDIS_STORE_WRITE_WAIT_RETRY_ENABLED = "wait.retry.enabled";
    public static final String REDIS_STORE_WRITE_WAIT_RETRY_DELAY_MS = "wait.retry.delay.ms";


    public static RedisStoreConfig from(Map<String, String> configurations) {

        String address = configurations.get(REDIS_STORE_ADDRESS);
        String user = configurations.get(REDIS_STORE_USER);
        String password = configurations.get(REDIS_STORE_PASSWORD);
        boolean sslEnabled = Boolean.parseBoolean(configurations.get(REDIS_STORE_SSL_ENABLED));
        String key = configurations.get(REDIS_STORE_KEY);
        boolean writeWaitEnabled = Boolean.parseBoolean(configurations.get(REDIS_STORE_WRITE_WAIT_ENABLED));
        Long writeWaitTimeout = configurations.get(REDIS_STORE_WRITE_WAIT_TIMEOUT_MS) == null ?
                null :
                Long.valueOf(configurations.get(REDIS_STORE_WRITE_WAIT_TIMEOUT_MS));
        boolean writeWaitRetryEnabled = Boolean.parseBoolean(configurations.get(REDIS_STORE_WRITE_WAIT_RETRY_ENABLED));
        Long writeWaitRetryDelay = configurations.get(REDIS_STORE_WRITE_WAIT_RETRY_DELAY_MS) == null ?
                null :
                Long.valueOf(configurations.get(REDIS_STORE_WRITE_WAIT_RETRY_DELAY_MS));

        RedisConnectionConfig redisConnectionConf = new RedisConnectionConfig(address, user, password, sslEnabled);
        RedisWriteConfig redisWriteConf = new RedisWriteConfig(writeWaitEnabled, writeWaitTimeout, writeWaitRetryEnabled, writeWaitRetryDelay);

        return new RedisStoreConfig(redisConnectionConf, key, redisWriteConf);
    }
}
