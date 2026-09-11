/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.provisioning;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;

import org.jboss.logging.Logger;

import io.debezium.platform.domain.HostStatusService;
import io.debezium.platform.environment.host.config.HostConfigGroup;
import io.debezium.platform.environment.host.provisioning.HostProvisioner.ProvisionResult;
import io.debezium.util.Threads;
import io.quarkus.runtime.ShutdownEvent;

/**
 * Orchestrates host provisioning lifecycle using a {@link HostProvisioner}
 * strategy.
 *
 * <p>This service is a thin orchestrator that manages:
 * <ul>
 *   <li>Status transitions: PENDING → PROVISIONING → READY or FAILED</li>
 *   <li>Token generation for Host Agent authentication</li>
 *   <li>Thread pool isolation for blocking provisioner calls</li>
 *   <li>Graceful shutdown of the executor pool</li>
 * </ul>
 *
 * <p>The actual execution mechanism (Ansible, Terraform, etc.) is delegated
 * to the injected {@link HostProvisioner} implementation, following the
 * Strategy Pattern suggested in code review.
 *
 * <p>Each provisioning run is submitted to a dedicated fixed-size thread pool
 * (configurable via {@code platform.host.executor-pool-size}) to isolate
 * the blocking provisioner calls from the Quarkus reactive threads and
 * {@code ForkJoinPool.commonPool()}.
 *
 * <p>Database updates go through {@link HostStatusService}, which extends
 * {@code AbstractService} and uses the Blaze-Persistence entity view layer
 * — the same pattern used by {@code PipelineService}, {@code VaultService},
 * and {@code ConnectionService}.
 *
 * <p>The bearer token for Host Agent authentication is generated in Java
 * <em>before</em> invoking the provisioner and passed as an argument.
 * Only after a successful run is the token committed to the database,
 * keeping DB and remote-host state from ever observably diverging.
 *
 * @see HostProvisioner
 * @see AnsibleHostProvisioner
 * @see HostStatusService
 * @see io.debezium.platform.environment.host.discovery.SshConfigWatcherService
 *
 * @author Divyanshu Kumar Nayak
 */
@ApplicationScoped
public class HostProvisioningService {

    private final Logger logger;
    private final HostStatusService hostStatusService;
    private final HostProvisioner provisioner;
    private final HostConfigGroup hostConfig;
    private final ExecutorService ansibleExecutor;

    public HostProvisioningService(Logger logger,
                                   HostStatusService hostStatusService,
                                   HostProvisioner provisioner,
                                   HostConfigGroup hostConfig) {
        this.logger = logger;
        this.hostStatusService = hostStatusService;
        this.provisioner = provisioner;
        this.hostConfig = hostConfig;

        this.ansibleExecutor = Threads.newFixedThreadPool(
                HostProvisioningService.class, "conductor", "provisioner",
                hostConfig.executorPoolSize());
    }

    /**
     * Graceful shutdown of the provisioner executor pool, mirroring the
     * shutdown discipline in {@code SshConfigWatcherService.onStop()}.
     */
    void onStop(@Observes ShutdownEvent ev) {
        ansibleExecutor.shutdown();
        try {
            if (!ansibleExecutor.awaitTermination(hostConfig.shutdownTimeoutSeconds(), TimeUnit.SECONDS)) {
                ansibleExecutor.shutdownNow();
            }
        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Triggers provisioning for the given SSH host alias.
     *
     * <p>Sets {@code HostStatusEntity} status:
     * PENDING → PROVISIONING → READY or FAILED.
     *
     * <p>The actual provisioner call is submitted to the dedicated executor
     * pool so this method returns immediately without blocking the caller.
     *
     * @param sshAlias the SSH config alias identifying the target host
     */
    public void provision(String sshAlias) {
        ansibleExecutor.submit(() -> executeProvisioningPlaybook(sshAlias));
    }

    /**
     * Triggers deprovisioning (agent removal and cleanup) for the given host.
     *
     * <p>Runs the teardown via the provisioner. Submitted to the same
     * dedicated executor pool.
     *
     * @param sshAlias the SSH config alias identifying the target host
     */
    public void deprovision(String sshAlias) {
        ansibleExecutor.submit(() -> executeDeprovisioningPlaybook(sshAlias));
    }

    /**
     * Executes provisioning for a single host.
     *
     * <p>Token is generated before the provisioner call and passed as an
     * argument. Only committed to DB after a successful result.
     */
    private void executeProvisioningPlaybook(String sshAlias) {
        String agentToken = UUID.randomUUID().toString();
        Instant provisioningStarted = Instant.now();

        hostStatusService.markProvisioning(sshAlias);
        logger.infov("Starting provisioning for host {0}", sshAlias);

        ProvisionResult result = provisioner.provision(sshAlias, agentToken);

        Duration elapsed = Duration.between(provisioningStarted, Instant.now());

        switch (result) {
            case ProvisionResult.Success success -> {
                hostStatusService.markReady(sshAlias, agentToken);
                logger.infov("Provisioning completed successfully for host {0} in {1}",
                        sshAlias, formatDuration(elapsed));
            }

            case ProvisionResult.Failure failure -> {
                hostStatusService.markFailed(sshAlias, failure.report());
                logger.errorv("Provisioning failed for host {0} after {1}: {2}",
                        sshAlias, formatDuration(elapsed), failure.report());
            }
        }
    }

    /**
     * Executes deprovisioning for a single host.
     * Does not change provisioning status — the caller is responsible for
     * marking the host as REMOVED via {@code HostStatusService.markHostRemoved()}.
     */
    private void executeDeprovisioningPlaybook(String sshAlias) {
        Instant deprovisioningStarted = Instant.now();
        logger.infov("Starting deprovisioning for host {0}", sshAlias);

        ProvisionResult result = provisioner.deprovision(sshAlias);

        Duration elapsed = Duration.between(deprovisioningStarted, Instant.now());

        switch (result) {
            case ProvisionResult.Success ignored ->
                logger.infov("Host {0} deprovisioned successfully in {1}",
                        sshAlias, formatDuration(elapsed));

            case ProvisionResult.Failure failure ->
                logger.errorv("Deprovisioning failed for host {0} after {1}: {2}",
                        sshAlias, formatDuration(elapsed), failure.report());
        }
    }

    private static String formatDuration(Duration d) {
        long minutes = d.toMinutes();
        long seconds = d.minusMinutes(minutes).getSeconds();
        return minutes > 0 ? minutes + "m " + seconds + "s" : seconds + "s";
    }
}
