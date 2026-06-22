/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;

/**
 * Tracks the state of a remote host discovered from {@code ~/.ssh/config}.
 *
 * <p>Each row represents a single SSH host alias. The {@code sshAlias} column has a UNIQUE
 * constraint because it is the natural key — it maps directly to a {@code Host} block in the
 * SSH config file, and there can only be one block per alias.</p>
 *
 * <p><strong>No {@code pipelineCount} column exists on this entity.</strong> Host load is
 * intentionally calculated via a live {@code COUNT(*)} query on {@code host_deployment}
 * inside a {@code PESSIMISTIC_WRITE} lock to prevent counter drift under concurrent writes.</p>
 */
@Entity(name = "host_status")
public class HostStatusEntity {

    @Id
    @GeneratedValue
    private Long id;

    @Column(unique = true, nullable = false)
    private String sshAlias;

    @Column(nullable = false)
    private String hostname;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProvisioningStatus provisioningStatus;

    @Column(columnDefinition = "TEXT")
    private String provisioningReport;

    @Column(nullable = false)
    private int agentPort;

    private String agentToken;

    private Instant lastCheckedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSshAlias() {
        return sshAlias;
    }

    public void setSshAlias(String sshAlias) {
        this.sshAlias = sshAlias;
    }

    public String getHostname() {
        return hostname;
    }

    public void setHostname(String hostname) {
        this.hostname = hostname;
    }

    public ProvisioningStatus getProvisioningStatus() {
        return provisioningStatus;
    }

    public void setProvisioningStatus(ProvisioningStatus provisioningStatus) {
        this.provisioningStatus = provisioningStatus;
    }

    public String getProvisioningReport() {
        return provisioningReport;
    }

    public void setProvisioningReport(String provisioningReport) {
        this.provisioningReport = provisioningReport;
    }

    public int getAgentPort() {
        return agentPort;
    }

    public void setAgentPort(int agentPort) {
        this.agentPort = agentPort;
    }

    public String getAgentToken() {
        return agentToken;
    }

    public void setAgentToken(String agentToken) {
        this.agentToken = agentToken;
    }

    public Instant getLastCheckedAt() {
        return lastCheckedAt;
    }

    public void setLastCheckedAt(Instant lastCheckedAt) {
        this.lastCheckedAt = lastCheckedAt;
    }
}
