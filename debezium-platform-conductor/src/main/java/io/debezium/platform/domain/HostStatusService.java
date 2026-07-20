/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static jakarta.transaction.Transactional.TxType.REQUIRES_NEW;
import static jakarta.transaction.Transactional.TxType.SUPPORTS;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

import org.jboss.logging.Logger;

import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;
import com.blazebit.persistence.view.EntityViewSetting;

import io.debezium.platform.data.model.HostStatusEntity;
import io.debezium.platform.data.model.ProvisioningStatus;
import io.debezium.platform.domain.views.HostStatus;
import io.debezium.platform.domain.views.refs.HostStatusReference;

/**
 * Service for managing {@link HostStatusEntity} lifecycle via the
 * Blaze-Persistence entity view layer.
 *
 * <p>Extends {@link AbstractService} to inherit standard CRUD operations
 * ({@code list}, {@code create}, {@code update}, {@code delete}, {@code findById})
 * and adds host-specific queries needed by the SSH config watcher's
 * reconciliation logic.
 */
@ApplicationScoped
public class HostStatusService extends AbstractService<HostStatusEntity, HostStatus, HostStatusReference> {

    private static final int DEFAULT_AGENT_PORT = 8090;

    private static final Logger logger = Logger.getLogger(HostStatusService.class);

    public HostStatusService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm) {
        super(HostStatusEntity.class, HostStatus.class, HostStatusReference.class, em, cbf, evm);
    }

    /**
     * Returns all host views whose provisioning status is not
     * {@link ProvisioningStatus#REMOVED}.
     */
    @Transactional(SUPPORTS)
    public List<HostStatus> findAllActiveHosts() {
        return evm.applySetting(
                EntityViewSetting.create(HostStatus.class),
                cb().where("provisioningStatus").notEq(ProvisioningStatus.REMOVED)).getResultList();
    }

    /**
     * Finds a host by its SSH config alias.
     *
     * @param alias the {@code Host} alias from {@code ~/.ssh/config}
     * @return the matching view, or empty if no host with that alias exists
     */
    @Transactional(SUPPORTS)
    public Optional<HostStatus> findBySshAlias(String alias) {
        List<HostStatus> results = evm.applySetting(
                EntityViewSetting.create(HostStatus.class),
                cb().where("sshAlias").eq(alias)).getResultList();
        return results.stream().findFirst();
    }

    /**
     * Creates a new host with {@link ProvisioningStatus#PENDING}.
     *
     * @param alias    the SSH config alias (natural key)
     * @param hostname the resolved hostname or IP address
     */
    public void createPendingHost(String alias, String hostname) {
        HostStatus view = createEmpty();
        view.setSshAlias(alias);
        view.setHostname(hostname);
        view.setProvisioningStatus(ProvisioningStatus.PENDING);
        view.setAgentPort(DEFAULT_AGENT_PORT);
        view.setLastCheckedAt(Instant.now());
        create(view);
        logger.infov("Created pending host: {0}", alias);
    }

    /**
     * Marks the host with the given alias as {@link ProvisioningStatus#REMOVED}.
     *
     * @param alias the SSH config alias
     */
    public void markHostRemoved(String alias) {
        findBySshAlias(alias).ifPresent(host -> {
            host.setProvisioningStatus(ProvisioningStatus.REMOVED);
            update(host);
            logger.infov("Marked host as REMOVED: {0}", alias);
        });
    }

    /**
     * Updates the cached hostname and resets status to
     * {@link ProvisioningStatus#PENDING} so the host gets re-provisioned.
     *
     * @param alias       the SSH config alias
     * @param newHostname the new hostname or IP address
     */
    public void updateHostDetails(String alias, String newHostname) {
        findBySshAlias(alias).ifPresent(host -> {
            host.setHostname(newHostname);
            host.setProvisioningStatus(ProvisioningStatus.PENDING);
            host.setLastCheckedAt(Instant.now());
            update(host);
            logger.infov("Updated host details and reset to PENDING: {0}", alias);
        });
    }

    /**
     * Transitions a host to {@code PROVISIONING} and clears any stale report
     * or token from a previous provisioning attempt.
     * Uses an independent transaction so this state is isolated.
     *
     * @param sshAlias the SSH config alias identifying the target host
     */
    @Transactional(REQUIRES_NEW)
    public void markProvisioning(String sshAlias) {
        findBySshAlias(sshAlias).ifPresent(host -> {
            host.setProvisioningStatus(ProvisioningStatus.PROVISIONING);
            host.setProvisioningReport(null);
            host.setAgentToken(null);
            host.setLastCheckedAt(Instant.now());
            update(host);
        });
    }

    /**
     * Transitions a host to {@code READY} and saves the generated bearer token.
     * Uses an independent transaction.
     *
     * @param sshAlias   the SSH config alias identifying the target host
     * @param agentToken the bearer token generated for Agent API authentication
     */
    @Transactional(REQUIRES_NEW)
    public void markReady(String sshAlias, String agentToken) {
        findBySshAlias(sshAlias).ifPresent(host -> {
            host.setProvisioningStatus(ProvisioningStatus.READY);
            host.setAgentToken(agentToken);
            host.setProvisioningReport(null);
            host.setLastCheckedAt(Instant.now());
            update(host);
        });
    }

    /**
     * Transitions a host to {@code FAILED} and saves the Ansible output.
     * Uses an independent transaction so the failure report is never lost
     * to an outer transaction rollback.
     *
     * @param sshAlias           the SSH config alias identifying the target host
     * @param provisioningReport the captured (and token-redacted) Ansible output
     */
    @Transactional(REQUIRES_NEW)
    public void markFailed(String sshAlias, String provisioningReport) {
        findBySshAlias(sshAlias).ifPresent(host -> {
            host.setProvisioningStatus(ProvisioningStatus.FAILED);
            host.setProvisioningReport(provisioningReport);
            host.setLastCheckedAt(Instant.now());
            update(host);
        });
    }
}
