/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.error;

public class NotFoundException extends RuntimeException {

    private final long id;

    public NotFoundException(Long id) {
        super("Invalid resource with id: " + id);
        this.id = id;
    }

    public long getId() {
        return id;
    }
}
