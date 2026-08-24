/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.notifications;

import io.debezium.DebeziumException;

/**
 * Signals a retriable webhook delivery failure (non-2xx response or I/O error).
 */
final class WebhookDeliveryException extends DebeziumException {

    private static final long serialVersionUID = 1L;

    WebhookDeliveryException(String message) {
        super(message);
    }

    WebhookDeliveryException(String message, Throwable cause) {
        super(message, cause);
    }
}
