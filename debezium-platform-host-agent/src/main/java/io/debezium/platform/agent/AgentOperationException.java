/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.agent;

/**
 * Signals a failed Host Agent container operation.
 */
public class AgentOperationException extends RuntimeException {

    public AgentOperationException(String message) {
        super(message);
    }

    public AgentOperationException(String message, Throwable cause) {
        super(message, cause);
    }
}
