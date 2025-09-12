/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.dto;

import java.util.List;

public record SchemaNode(String name, List<CollectionNode> collections, int collectionCount) {

    public SchemaNode(String name) {
        this(name, List.of(), 0);
    }
}
