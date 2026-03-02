/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import java.util.Map;

import io.debezium.util.Strings;

/**
 * Small helpers to safely extract typed values from connection configuration maps.
 */
public final class ConnectionConfigUtils {

    private ConnectionConfigUtils() {
    }

    public static String getString(Map<String, Object> config, String key) {
        Object value = config.get(key);
        return value == null ? null : value.toString();
    }

    public static Integer getInteger(Map<String, Object> config, String key) {
        Object value = config.get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(value.toString());
        }
        catch (NumberFormatException e) {
            return null;
        }
    }

    public static boolean getBoolean(Map<String, Object> config, String key, boolean defaultValue) {
        Object value = config.get(key);
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Boolean b) {
            return b;
        }
        return Boolean.parseBoolean(value.toString());
    }

    public static boolean isBlank(String value) {
        return Strings.isNullOrBlank(value);
    }
}
