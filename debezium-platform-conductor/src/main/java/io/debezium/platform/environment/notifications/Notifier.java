/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.notifications;

import io.debezium.platform.data.model.ChannelType;
import io.debezium.platform.data.model.NotificationChannelEntity;

public interface Notifier {

    String CONFIG_URL = "url";
    String CONFIG_METHOD = "method";
    String CONFIG_HEADERS = "headers";
    String CONFIG_RECIPIENTS = "recipients";
    String CONFIG_SUBJECT_TEMPLATE = "subjectTemplate";

    ChannelType type();

    NotificationResult send(AlertNotification notification, NotificationChannelEntity channel);
}
