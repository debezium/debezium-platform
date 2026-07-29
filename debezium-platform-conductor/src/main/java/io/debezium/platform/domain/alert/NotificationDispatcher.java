/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.alert;

import jakarta.enterprise.context.ApplicationScoped;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.platform.data.model.AlertEventEntity;
import io.debezium.platform.data.model.AlertRuleEntity;

@ApplicationScoped
public class NotificationDispatcher {

    private static final Logger LOGGER = LoggerFactory.getLogger(NotificationDispatcher.class);

    public void dispatch(AlertRuleEntity rule, AlertEventEntity event) {
        String state = event.getResolvedAt() == null ? "FIRED" : "RESOLVED";
        LOGGER.info("Alert {} for rule '{}' on pipeline '{}' (severity={})",
                state, rule.getName(), event.getPipelineId(), event.getSeverity());
    }
}
