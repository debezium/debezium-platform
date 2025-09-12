/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.dto;

import java.util.List;

public record CatalogNode(String name, List<SchemaNode> schemas, int totalCollections) {

    public CatalogNode(String name) {
        this(name, List.of(), 0);
    }
}
