/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.discovery;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.util.List;

import org.jboss.logging.Logger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SshConfigParserTest {

    private SshConfigParser parser;

    @BeforeEach
    void setUp() {
        parser = new SshConfigParser(Logger.getLogger(SshConfigParser.class));
    }

    // ── TEST 1: Standard whitespace delimiter ──────────────────────────────

    @Test
    void testStandardWhitespaceDelimiterEntry() {
        String config = """
                Host db-server-1
                    HostName 192.168.1.10
                    User ubuntu
                    Port 22
                    IdentityFile ~/.ssh/db-server-1.key
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(1);
        SshHostEntry entry = entries.get(0);
        assertThat(entry.alias()).isEqualTo("db-server-1");
        assertThat(entry.hostname()).isEqualTo("192.168.1.10");
        assertThat(entry.user()).isEqualTo("ubuntu");
        assertThat(entry.port()).isEqualTo(22);
        assertThat(entry.identityFile()).isEqualTo("~/.ssh/db-server-1.key");
    }

    // ── TEST 2: Equals delimiter ───────────────────────────────────────────

    @Test
    void testEqualsDelimiterEntry() {
        String config = """
                Host db-server-2
                    HostName=192.168.1.20
                    User=deploy
                    Port=22
                    IdentityFile=/home/admin/.ssh/key.pem
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(1);
        SshHostEntry entry = entries.get(0);
        assertThat(entry.hostname()).isEqualTo("192.168.1.20");
        assertThat(entry.user()).isEqualTo("deploy");
        assertThat(entry.port()).isEqualTo(22);
        assertThat(entry.identityFile()).isEqualTo("/home/admin/.ssh/key.pem");
    }

    // ── TEST 3: Equals with surrounding spaces ─────────────────────────────

    @Test
    void testEqualsWithSpacesDelimiterEntry() {
        String config = """
                Host db-server-3
                    Port = 22
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).port()).isEqualTo(22);
    }

    // ── TEST 4: Inline comment stripped ─────────────────────────────────────

    @Test
    void testInlineCommentStripped() {
        String config = """
                Host db-server-1
                    User deploy # production
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).user()).isEqualTo("deploy");
    }

    // ── TEST 5: Quoted path with spaces ─────────────────────────────────────

    @Test
    void testQuotedPathWithSpaces() {
        String config = """
                Host db-server-1
                    IdentityFile "/opt/keys/my server key.pem"
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).identityFile()).isEqualTo("/opt/keys/my server key.pem");
    }

    // ── TEST 6: Wildcard * skipped ──────────────────────────────────────────

    @Test
    void testWildcardStarSkipped() {
        String config = """
                Host *
                    ServerAliveInterval 60
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).isEmpty();
    }

    // ── TEST 7: Partial wildcard * skipped ──────────────────────────────────

    @Test
    void testWildcardPartialStarSkipped() {
        String config = """
                Host db-*
                    HostName 10.0.0.1
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).isEmpty();
    }

    // ── TEST 8: Wildcard ? skipped ──────────────────────────────────────────

    @Test
    void testWildcardQuestionMarkSkipped() {
        String config = """
                Host db-?
                    HostName 10.0.0.1
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).isEmpty();
    }

    // ── TEST 9: Multiple hosts returned in order ────────────────────────────

    @Test
    void testMultipleHostsReturnedInOrder() {
        String config = """
                Host alpha
                    HostName 10.0.0.1

                Host beta
                    HostName 10.0.0.2

                Host gamma
                    HostName 10.0.0.3
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(3);
        assertThat(entries.get(0).alias()).isEqualTo("alpha");
        assertThat(entries.get(1).alias()).isEqualTo("beta");
        assertThat(entries.get(2).alias()).isEqualTo("gamma");
    }

    // ── TEST 10: Malformed line skipped gracefully ──────────────────────────

    @Test
    void testMalformedLineSkippedGracefully() {
        String config = """
                Host db-server-1
                    HostName 192.168.1.10
                    ThisIsCompletelyWrong!!!
                    User ubuntu
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(1);
        SshHostEntry entry = entries.get(0);
        assertThat(entry.hostname()).isEqualTo("192.168.1.10");
        assertThat(entry.user()).isEqualTo("ubuntu");
    }

    // ── TEST 11: Case-insensitive keyword Host ──────────────────────────────

    @Test
    void testCaseInsensitiveKeywordHost() {
        String config = """
                HOST db-server-1
                    HostName 10.0.0.1
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).alias()).isEqualTo("db-server-1");
    }

    // ── TEST 12: Case-insensitive keyword HostName ──────────────────────────

    @Test
    void testCaseInsensitiveKeywordHostname() {
        String config = """
                Host db-server-1
                    HOSTNAME 192.168.1.10
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).hostname()).isEqualTo("192.168.1.10");
    }

    // ── TEST 13: Case-insensitive keyword User ──────────────────────────────

    @Test
    void testCaseInsensitiveKeywordUser() {
        String config = """
                Host db-server-1
                    USER ubuntu
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).user()).isEqualTo("ubuntu");
    }

    // ── TEST 14: Default port when absent ───────────────────────────────────

    @Test
    void testDefaultPortWhenAbsent() {
        String config = """
                Host db-server-1
                    HostName 10.0.0.1
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).port()).isEqualTo(22);
    }

    // ── TEST 15: Invalid port falls back to default ─────────────────────────

    @Test
    void testInvalidPortFallsBackToDefault() {
        String config = """
                Host db-server-1
                    Port notanumber
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).port()).isEqualTo(22);
    }

    // ── TEST 16: Port out of range ──────────────────────────────────────────

    @Test
    void testPortOutOfRange() {
        String config = """
                Host db-server-1
                    Port 99999
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).port()).isEqualTo(22);
    }

    // ── TEST 17: Empty content returns empty list ───────────────────────────

    @Test
    void testEmptyContentReturnsEmptyList() {
        List<SshHostEntry> entries = parser.parseContent("");

        assertThat(entries).isNotNull().isEmpty();
    }

    // ── TEST 18: Only comments returns empty list ───────────────────────────

    @Test
    void testOnlyCommentsReturnsEmptyList() {
        String config = "# This is a comment\n# Another comment";

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).isEmpty();
    }

    // ── TEST 19: Unknown keywords silently ignored ──────────────────────────

    @Test
    void testUnknownKeywordsIgnored() {
        String config = """
                Host db-server-1
                    HostName 10.0.0.1
                    StrictHostKeyChecking no
                    ServerAliveInterval 60
                    ForwardAgent yes
                    User ubuntu

                Host db-server-2
                     HostName 10.0.0.2
                     User deploy
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(2);
        assertThat(entries.get(0).hostname()).isEqualTo("10.0.0.1");
        assertThat(entries.get(0).user()).isEqualTo("ubuntu");
    }

    // ── TEST 20: Host with only alias ───────────────────────────────────────

    @Test
    void testHostWithOnlyAlias() {
        String config = """
                Host minimal-server
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(1);
        SshHostEntry entry = entries.get(0);
        assertThat(entry.alias()).isEqualTo("minimal-server");
        assertThat(entry.hostname()).isNull();
        assertThat(entry.user()).isNull();
        assertThat(entry.port()).isEqualTo(22);
        assertThat(entry.identityFile()).isNull();
    }

    // ── TEST 21: Mixed wildcard and real hosts ──────────────────────────────

    @Test
    void testMixedWildcardAndRealHosts() {
        String config = """
                Host *
                    ServerAliveInterval 60

                Host real-server
                    HostName 10.0.0.1

                Host db-?
                    HostName 10.0.0.2
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).alias()).isEqualTo("real-server");
    }

    // ── TEST 22: Duplicate alias returns all ─────────────────────────────────

    @Test
    void testDuplicateAliasReturnsAll() {
        String config = """
                Host db-server-1
                    HostName 10.0.0.1

                Host db-server-1
                    HostName 10.0.0.2
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(2);
        assertThat(entries.get(0).alias()).isEqualTo("db-server-1");
        assertThat(entries.get(1).alias()).isEqualTo("db-server-1");
        assertThat(entries.get(0).hostname()).isEqualTo("10.0.0.1");
        assertThat(entries.get(1).hostname()).isEqualTo("10.0.0.2");
    }

    // ── TEST 23: Full example from spec ─────────────────────────────────────

    @Test
    void testFullExampleFromSpec() {
        String config = """
                # Global settings
                Host *
                    ServerAliveInterval 60

                Host db-server-1
                    HostName 192.168.1.10
                    User ubuntu
                    Port 22
                    IdentityFile ~/.ssh/db-server-1.key

                Host db-server-2
                    HostName=192.168.1.20
                    User=deploy
                    Port=2222
                    IdentityFile=/home/admin/.ssh/db-server-2.key

                Host db-server-3
                    HostName 192.168.1.30
                    User deploy # production server
                    IdentityFile "/opt/keys/db server 3.key"
                """;

        List<SshHostEntry> entries = parser.parseContent(config);

        assertThat(entries).hasSize(3);

        // db-server-1
        SshHostEntry e1 = entries.get(0);
        assertThat(e1.alias()).isEqualTo("db-server-1");
        assertThat(e1.hostname()).isEqualTo("192.168.1.10");
        assertThat(e1.user()).isEqualTo("ubuntu");
        assertThat(e1.port()).isEqualTo(22);
        assertThat(e1.identityFile()).isEqualTo("~/.ssh/db-server-1.key");

        // db-server-2
        SshHostEntry e2 = entries.get(1);
        assertThat(e2.alias()).isEqualTo("db-server-2");
        assertThat(e2.hostname()).isEqualTo("192.168.1.20");
        assertThat(e2.user()).isEqualTo("deploy");
        assertThat(e2.port()).isEqualTo(2222);
        assertThat(e2.identityFile()).isEqualTo("/home/admin/.ssh/db-server-2.key");

        // db-server-3
        SshHostEntry e3 = entries.get(2);
        assertThat(e3.alias()).isEqualTo("db-server-3");
        assertThat(e3.hostname()).isEqualTo("192.168.1.30");
        assertThat(e3.user()).isEqualTo("deploy");
        assertThat(e3.port()).isEqualTo(22);
        assertThat(e3.identityFile()).isEqualTo("/opt/keys/db server 3.key");
    }

    // ── TEST 24: Parse from Path (fixture file) ─────────────────────────────

    @Test
    void testParsePath() throws Exception {
        Path configPath = Path.of(getClass().getClassLoader()
                .getResource("ssh-config/valid-multi-host.config").toURI());

        List<SshHostEntry> entries = parser.parse(configPath);

        // Host * is skipped → 2 entries
        assertThat(entries).hasSize(2);

        SshHostEntry e1 = entries.get(0);
        assertThat(e1.alias()).isEqualTo("db-server-1");
        assertThat(e1.hostname()).isEqualTo("192.168.1.10");
        assertThat(e1.user()).isEqualTo("ubuntu");
        assertThat(e1.port()).isEqualTo(22);
        assertThat(e1.identityFile()).isEqualTo("~/.ssh/db-server-1.key");

        SshHostEntry e2 = entries.get(1);
        assertThat(e2.alias()).isEqualTo("db-server-2");
        assertThat(e2.hostname()).isEqualTo("192.168.1.20");
        assertThat(e2.user()).isEqualTo("deploy");
        assertThat(e2.port()).isEqualTo(2222);
        assertThat(e2.identityFile()).isEqualTo("~/.ssh/db-server-2.key");
    }
}
