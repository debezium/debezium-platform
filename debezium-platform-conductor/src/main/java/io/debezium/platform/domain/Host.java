/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import io.debezium.platform.data.model.HostStatusEntity;

/**
 * Lightweight domain representation of a remote host.
 *
 * <p>Carries only the fields that business logic outside the persistence
 * layer actually needs — {@code id} for identification and {@code sshAlias}
 * for SSH connectivity. This prevents JPA entity details (lazy-loading,
 * column mappings, Hibernate proxies) from leaking into strategy and
 * controller layers.
 *
 * @see HostStatusEntity
 */
public record Host(Long id, String sshAlias) {

    /**
     * Maps a JPA entity to its domain representation.
     */
    public static Host from(HostStatusEntity entity) {
        return new Host(entity.getId(), entity.getSshAlias());
    }
}
