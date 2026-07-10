/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.discovery;

import java.io.IOException;
import java.nio.file.ClosedWatchServiceException;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardWatchEventKinds;
import java.nio.file.WatchEvent;
import java.nio.file.WatchKey;
import java.nio.file.WatchService;
import java.nio.file.attribute.PosixFilePermission;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import io.debezium.platform.domain.HostStatusService;
import io.debezium.platform.domain.views.HostStatus;
import io.debezium.platform.environment.host.provisioning.HostProvisioningService;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;
import io.quarkus.scheduler.Scheduled;

/**
 * Monitors the OpenSSH {@code ~/.ssh/config} file for changes and reconciles
 * host state in the database.
 *
 * <p>Uses Java NIO {@link WatchService} to detect file changes, with a
 * 2-second debounce to coalesce rapid edits. A {@link Scheduled} periodic
 * fallback runs every 5 minutes to catch events that {@code WatchService}
 * may miss on NFS mounts and Kubernetes ConfigMap volumes (which use an
 * atomic symlink-swap rather than {@code ENTRY_MODIFY} events).
 *
 * <p>This bean is active in both operator and host deployment modes. The
 * {@code debezium.deployment.mode} runtime guard at the start of each
 * {@code @Observes} and {@code @Scheduled} method ensures no file-system
 * operations are attempted in operator mode, where {@code ~/.ssh/config}
 * may not exist.
 *
 * <p>Reconciliation logic:
 * <ul>
 *   <li>Host in file, not in DB → create {@link HostStatus} with
 *       status {@code PENDING}, trigger Ansible provisioning</li>
 *   <li>Host in DB, not in file → mark status {@code REMOVED}</li>
 *   <li>Host in both, hostname changed → update entity, re-trigger provisioning</li>
 * </ul>
 */
@ApplicationScoped
public class SshConfigWatcherService {

    private static final String HOST_DEPLOYMENT_MODE = "host";
    private static final long DEBOUNCE_DELAY_SECONDS = 2;
    private static final long WATCH_POLL_TIMEOUT_SECONDS = 30;
    private static final long SHUTDOWN_TIMEOUT_SECONDS = 5;
    private static final String HOME_TILDE = "~";
    private static final String USER_HOME_PROPERTY = "user.home";

    private static final Set<PosixFilePermission> INSECURE_PERMISSIONS = Set.of(
            PosixFilePermission.GROUP_READ,
            PosixFilePermission.GROUP_WRITE,
            PosixFilePermission.OTHERS_READ,
            PosixFilePermission.OTHERS_WRITE);

    @ConfigProperty(name = "debezium.deployment.mode", defaultValue = "operator")
    String deploymentMode;

    @ConfigProperty(name = "debezium.host.ssh-config-path", defaultValue = "~/.ssh/config")
    String sshConfigPathRaw;

    private final Logger logger;
    private final SshConfigParser parser;
    private final HostStatusService hostStatusService;
    private final HostProvisioningService provisioningService;
    private final HostReconciliationPlanBuilder planBuilder;
    private final ScheduledExecutorService debounceExecutor;

    private Path sshConfigPath;
    private Path watchDirectory;
    private Path configFileName;
    private WatchService watchService;
    private volatile ScheduledFuture<?> pendingReconciliation;
    private volatile boolean running;
    private Thread watchThread;

    public SshConfigWatcherService(Logger logger,
                                   SshConfigParser parser,
                                   HostStatusService hostStatusService,
                                   HostProvisioningService provisioningService) {
        this.logger = logger;
        this.parser = parser;
        this.hostStatusService = hostStatusService;
        this.provisioningService = provisioningService;
        this.planBuilder = new HostReconciliationPlanBuilder();
        this.debounceExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "ssh-config-debounce");
            t.setDaemon(true);
            return t;
        });
    }

    /**
     * Initializes the file watcher on application startup.
     * Guarded by deployment mode — does nothing in operator mode.
     */
    void onStart(@Observes StartupEvent ev) {
        if (!isHostMode()) {
            return;
        }

        resolveSshConfigPath();

        if (!Files.exists(sshConfigPath)) {
            logger.errorv("SSH config file not found at {0}. "
                    + "Host mode requires a valid SSH config file. "
                    + "Watcher will not start — the periodic fallback will retry every 5 minutes.",
                    sshConfigPath);
            return;
        }

        try {
            watchService = FileSystems.getDefault().newWatchService();
            watchDirectory.register(watchService,
                    StandardWatchEventKinds.ENTRY_MODIFY,
                    StandardWatchEventKinds.ENTRY_CREATE,
                    StandardWatchEventKinds.ENTRY_DELETE);
        }
        catch (IOException e) {
            logger.errorv(e, "Failed to register WatchService on {0} — file watcher will not start",
                    watchDirectory);
            return;
        }

        reconcile();

        running = true;
        watchThread = new Thread(this::watchLoop, "ssh-config-watcher");
        watchThread.setDaemon(true);
        watchThread.start();
        logger.info("SSH config file watcher started");
    }

    /**
     * Cleans up the file watcher on application shutdown.
     */
    void onStop(@Observes ShutdownEvent ev) {
        if (!isHostMode()) {
            return;
        }

        running = false;

        if (watchThread != null) {
            watchThread.interrupt();
        }

        if (watchService != null) {
            try {
                watchService.close();
            }
            catch (IOException e) {
                logger.warnv(e, "Error closing WatchService");
            }
        }

        debounceExecutor.shutdown();
        try {
            if (!debounceExecutor.awaitTermination(SHUTDOWN_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                debounceExecutor.shutdownNow();
            }
        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        logger.info("SSH config file watcher stopped");
    }

    /**
     * Periodic fallback reconciliation. Catches events that {@link WatchService}
     * may miss on NFS mounts or Kubernetes ConfigMap volumes.
     *
     * <p>The {@code delayed = "5m"} prevents a race condition with the initial
     * reconciliation that runs in {@link #onStart}.
     */
    @Scheduled(every = "5m", delayed = "5m")
    void scheduledReconciliation() {
        if (!isHostMode()) {
            return;
        }

        if (sshConfigPath == null) {
            resolveSshConfigPath();
        }

        logger.debug("Periodic SSH config reconciliation triggered");
        reconcile();
    }

    /**
     * Background watch loop. Runs in a dedicated daemon thread.
     *
     * <p>Uses {@link WatchService#poll(long, TimeUnit)} (not {@code take()})
     * so the loop can check the {@code running} flag and exit cleanly on shutdown.
     */
    private void watchLoop() {
        while (running) {
            WatchKey key;
            try {
                key = watchService.poll(WATCH_POLL_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            }
            catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
            catch (ClosedWatchServiceException e) {
                break;
            }

            if (key != null) {
                boolean configFileAffected = false;

                for (WatchEvent<?> event : key.pollEvents()) {
                    if (event.kind() == StandardWatchEventKinds.OVERFLOW) {
                        logger.warn("WatchService OVERFLOW — triggering full reconciliation");
                        configFileAffected = true;
                        break;
                    }

                    @SuppressWarnings("unchecked")
                    WatchEvent<Path> pathEvent = (WatchEvent<Path>) event;
                    Path changedFile = pathEvent.context();

                    if (changedFile.equals(configFileName)) {
                        logger.debugv("SSH config file event: {0} — {1}",
                                event.kind().name(), changedFile);
                        configFileAffected = true;
                    }
                }

                if (configFileAffected) {
                    scheduleReconciliation();
                }

                boolean valid = key.reset();
                if (!valid) {
                    logger.errorv("Watch directory {0} was deleted — SSH config watcher stopping",
                            watchDirectory);
                    break;
                }
            }
        }
    }

    /**
     * Schedules a reconciliation after the debounce delay. Cancels any pending
     * reconciliation so that multiple rapid file events result in exactly
     * one reconciliation run.
     */
    private void scheduleReconciliation() {
        ScheduledFuture<?> existing = pendingReconciliation;
        if (existing != null && !existing.isDone()) {
            existing.cancel(false);
        }
        pendingReconciliation = debounceExecutor.schedule(
                this::reconcile, DEBOUNCE_DELAY_SECONDS, TimeUnit.SECONDS);
    }

    /**
     * Core reconciliation logic. Called from three places:
     * <ol>
     *   <li>{@link #onStart} — immediately on application startup</li>
     *   <li>{@link #watchLoop} — via {@link #scheduleReconciliation}, after file change + debounce</li>
     *   <li>{@link #scheduledReconciliation} — every 5 minutes as fallback</li>
     * </ol>
     */
    private void reconcile() {
        logger.infov("Reconciling hosts from SSH config at {0}", sshConfigPath);

        List<SshHostEntry> fileHosts;
        try {
            fileHosts = parser.parse(sshConfigPath);
        }
        catch (IOException e) {
            logger.errorv(e, "Failed to parse SSH config at {0} — skipping reconciliation",
                    sshConfigPath);
            return;
        }

        validateKeyPermissions(fileHosts);

        List<HostStatus> dbHosts = hostStatusService.findAllActiveHosts();

        ReconciliationPlan plan = planBuilder.buildPlan(fileHosts, dbHosts);

        plan.toAdd().forEach(entry -> {
            hostStatusService.createPendingHost(entry.alias(), planBuilder.resolveHostname(entry));
            provisioningService.provision(entry.alias());
        });

        plan.toRemove().forEach(hostStatusService::markHostRemoved);

        plan.toUpdate().forEach(entry -> {
            hostStatusService.updateHostDetails(entry.alias(), entry.hostname());
            provisioningService.provision(entry.alias());
        });

        logger.infov("Reconciliation complete: {0} added, {1} removed, {2} updated",
                plan.toAdd().size(), plan.toRemove().size(), plan.toUpdate().size());
    }

    /**
     * Validates POSIX permissions on SSH identity files referenced by the config.
     * Logs an error for keys that are too permissive (OpenSSH rejects them).
     */
    private void validateKeyPermissions(List<SshHostEntry> hosts) {
        for (SshHostEntry host : hosts) {
            if (host.identityFile() == null) {
                continue;
            }

            String expandedPath = host.identityFile().replace(HOME_TILDE,
                    System.getProperty(USER_HOME_PROPERTY));
            Path keyPath = Path.of(expandedPath);

            if (!Files.exists(keyPath)) {
                logger.warnv("SSH identity file not found: {0} (referenced by host '{1}')",
                        keyPath, host.alias());
                continue;
            }

            try {
                Set<PosixFilePermission> permissions = Files.getPosixFilePermissions(keyPath);
                boolean tooOpen = permissions.stream().anyMatch(INSECURE_PERMISSIONS::contains);
                if (tooOpen) {
                    logger.errorv("SSH key {0} has permissions that are too open. "
                            + "OpenSSH will reject this key. Fix with: chmod 600 {0}", keyPath);
                }
                else {
                    logger.debugv("SSH key {0} permissions OK", keyPath);
                }
            }
            catch (UnsupportedOperationException e) {
                logger.debug("POSIX permission check not supported — skipping key validation");
            }
            catch (IOException e) {
                logger.warnv(e, "Failed to check permissions on SSH key: {0}", keyPath);
            }
        }
    }

    private boolean isHostMode() {
        return HOST_DEPLOYMENT_MODE.equals(deploymentMode);
    }

    private void resolveSshConfigPath() {
        String expanded = sshConfigPathRaw.replace(HOME_TILDE, System.getProperty(USER_HOME_PROPERTY));
        sshConfigPath = Path.of(expanded);
        watchDirectory = sshConfigPath.getParent();
        configFileName = sshConfigPath.getFileName();
    }
}
