/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.monitoring;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.util.List;
import java.util.Map;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;
import io.smallrye.certs.CertificateFiles;
import io.smallrye.certs.CertificateGenerator;
import io.smallrye.certs.CertificateRequest;
import io.smallrye.certs.Format;
import io.smallrye.certs.PemCertificateFiles;
import io.smallrye.certs.Pkcs12CertificateFiles;

import okhttp3.mockwebserver.MockWebServer;

/**
 * Stands in for a Prometheus that is only reachable over TLS, with a certificate no default trust
 * store knows, and with a bearer token read from a file: what the conductor faces on OpenShift.
 * <p>
 * The server is a {@link MockWebServer}, so a test decides what each query returns and inspects
 * the request the conductor sent. The server and the token file are injected into the fields of
 * the test class with matching types.
 * </p>
 */
public class SecuredPrometheusTestResource implements QuarkusTestResourceLifecycleManager {

    public static final String INITIAL_TOKEN = "initial-token";

    private static final String KEY_STORE_PASSWORD = "secret";

    private MockWebServer server;
    private Path workDir;
    private Path tokenFile;

    @Override
    public Map<String, String> start() {
        try {
            workDir = Files.createTempDirectory("secured-prometheus");

            // A self-signed certificate for localhost, as a key store for the server and as a PEM
            // file for the conductor to trust.
            List<CertificateFiles> certificates = new CertificateGenerator(workDir, true).generate(
                    new CertificateRequest()
                            .withName("prometheus")
                            .withFormats(List.of(Format.PKCS12, Format.PEM))
                            .withPassword(KEY_STORE_PASSWORD));
            Pkcs12CertificateFiles keyStore = find(certificates, Pkcs12CertificateFiles.class);
            PemCertificateFiles pem = find(certificates, PemCertificateFiles.class);

            server = new MockWebServer();
            server.useHttps(sslContext(keyStore.keyStoreFile()).getSocketFactory(), false);
            server.start();

            tokenFile = workDir.resolve("token");
            Files.writeString(tokenFile, INITIAL_TOKEN);

            return Map.of(
                    "quarkus.rest-client.prometheus-api.url", "https://localhost:" + server.getPort(),
                    "quarkus.tls.prometheus.trust-store.pem.certs", pem.trustFile().toString(),
                    "monitoring.prometheus.auth.bearer-token-file", tokenFile.toString());
        }
        catch (Exception e) {
            throw new RuntimeException("Failed to start the secured Prometheus stand-in", e);
        }
    }

    @Override
    public void inject(TestInjector testInjector) {
        testInjector.injectIntoFields(server, new TestInjector.MatchesType(MockWebServer.class));
        testInjector.injectIntoFields(tokenFile, new TestInjector.MatchesType(Path.class));
    }

    @Override
    public void stop() {
        try {
            if (server != null) {
                server.shutdown();
            }
            if (workDir != null) {
                try (var files = Files.list(workDir)) {
                    for (Path file : files.toList()) {
                        Files.deleteIfExists(file);
                    }
                }
                Files.deleteIfExists(workDir);
            }
        }
        catch (IOException e) {
            throw new RuntimeException("Failed to stop the secured Prometheus stand-in", e);
        }
    }

    private static SSLContext sslContext(Path keyStoreFile) throws Exception {
        KeyStore keyStore = KeyStore.getInstance("PKCS12");
        try (InputStream in = Files.newInputStream(keyStoreFile)) {
            keyStore.load(in, KEY_STORE_PASSWORD.toCharArray());
        }
        KeyManagerFactory keyManagers = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        keyManagers.init(keyStore, KEY_STORE_PASSWORD.toCharArray());

        SSLContext context = SSLContext.getInstance("TLS");
        context.init(keyManagers.getKeyManagers(), null, null);
        return context;
    }

    private static <T extends CertificateFiles> T find(List<CertificateFiles> certificates, Class<T> type) {
        return certificates.stream()
                .filter(type::isInstance)
                .map(type::cast)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No " + type.getSimpleName() + " generated"));
    }
}
