/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.provisioning;

/**
 * Thrown when an Ansible ad-hoc command fails due to a <em>transient</em>
 * infrastructure issue — SSH connection timeout, network unreachable,
 * privilege escalation prompt, or similar.
 *
 * <p>This exception is <strong>not</strong> thrown for <em>definitive</em>
 * command failures such as {@code "No such object"} from {@code docker inspect}
 * — those indicate a real state (container genuinely gone) and should be
 * handled as normal results, not retried.
 *
 * <p>Used as the retriable exception type for {@link io.debezium.util.RetryingRunnable},
 * following the same pattern as
 * {@code io.fabric8.kubernetes.client.KubernetesClientException} in
 * {@code OutboxParentEventConsumer}.
 *
 * @see io.debezium.util.RetryingRunnable
 */
public class AnsibleCommandException extends RuntimeException {

    public AnsibleCommandException(String message) {
        super(message);
    }

    public AnsibleCommandException(String message, Throwable cause) {
        super(message, cause);
    }
}
