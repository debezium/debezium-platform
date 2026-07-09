/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.discovery;

import java.util.List;

/**
 * Immutable result of comparing SSH config file state against database state.
 *
 * <p>Produced by
 * {@link SshConfigWatcherService#buildReconciliationPlan(List, List)}
 * — a pure function with zero side effects and zero database access.
 *
 * @param toAdd    hosts present in the file but not in the database
 * @param toRemove aliases of hosts present in the database but not in the file
 * @param toUpdate hosts present in both but with a changed hostname
 */
record ReconciliationPlan(
        List<SshHostEntry> toAdd,
        List<String> toRemove,
        List<SshHostEntry> toUpdate) {
}
