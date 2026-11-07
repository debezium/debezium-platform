/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.alert;

import io.debezium.platform.data.model.AlertRuleEntity;

/**
 * Domain event fired synchronously, inside the deleting transaction, right before an alert rule is
 * deleted.
 *
 * <p>Deleting a rule removes its alert states with it, but its alert events only lose their rule
 * reference. Observers use this event to finish what depends on the rule while it still exists, such
 * as resolving its firing alerts.</p>
 *
 * @param rule the rule about to be deleted
 */
public record AlertRuleDeleting(AlertRuleEntity rule) {
}
