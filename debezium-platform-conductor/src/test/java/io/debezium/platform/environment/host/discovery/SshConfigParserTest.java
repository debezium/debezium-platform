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

    @Test
    void testStandardWhitespaceDelimiterEntry() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("whitespace-delimiter.config"));

        assertThat(entries).hasSize(1);
        SshHostEntry entry = entries.get(0);
        assertThat(entry.alias()).isEqualTo("db-server-1");
        assertThat(entry.hostname()).isEqualTo("192.168.1.10");
        assertThat(entry.user()).isEqualTo("ubuntu");
        assertThat(entry.port()).isEqualTo(22);
        assertThat(entry.identityFile()).isEqualTo("~/.ssh/db-server-1.key");
    }

    @Test
    void testEqualsDelimiterEntry() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("equals-delimiter.config"));

        assertThat(entries).hasSize(1);
        SshHostEntry entry = entries.get(0);
        assertThat(entry.hostname()).isEqualTo("192.168.1.20");
        assertThat(entry.user()).isEqualTo("deploy");
        assertThat(entry.port()).isEqualTo(22);
        assertThat(entry.identityFile()).isEqualTo("/home/admin/.ssh/key.pem");
    }

    @Test
    void testEqualsWithSpacesDelimiterEntry() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("equals-with-spaces.config"));

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).port()).isEqualTo(22);
    }

    @Test
    void testInlineCommentStripped() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("inline-comment.config"));

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).user()).isEqualTo("deploy");
    }

    @Test
    void testQuotedPathWithSpaces() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("quoted-path.config"));

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).identityFile()).isEqualTo("/opt/keys/my server key.pem");
    }

    @Test
    void testWildcardStarSkipped() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("wildcard-star.config"));

        assertThat(entries).isEmpty();
    }

    @Test
    void testWildcardPartialStarSkipped() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("wildcard-partial.config"));

        assertThat(entries).isEmpty();
    }

    @Test
    void testWildcardQuestionMarkSkipped() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("wildcard-question.config"));

        assertThat(entries).isEmpty();
    }

    @Test
    void testMultipleHostsReturnedInOrder() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("multiple-hosts.config"));

        assertThat(entries).hasSize(3);
        assertThat(entries.get(0).alias()).isEqualTo("alpha");
        assertThat(entries.get(1).alias()).isEqualTo("beta");
        assertThat(entries.get(2).alias()).isEqualTo("gamma");
    }

    @Test
    void testMalformedLineSkippedGracefully() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("malformed-line.config"));

        assertThat(entries).hasSize(1);
        SshHostEntry entry = entries.get(0);
        assertThat(entry.hostname()).isEqualTo("192.168.1.10");
        assertThat(entry.user()).isEqualTo("ubuntu");
    }

    @Test
    void testCaseInsensitiveKeywordHost() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("case-insensitive-host.config"));

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).alias()).isEqualTo("db-server-1");
    }

    @Test
    void testCaseInsensitiveKeywordHostname() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("case-insensitive-hostname.config"));

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).hostname()).isEqualTo("192.168.1.10");
    }

    @Test
    void testCaseInsensitiveKeywordUser() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("case-insensitive-user.config"));

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).user()).isEqualTo("ubuntu");
    }

    @Test
    void testDefaultPortWhenAbsent() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("default-port.config"));

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).port()).isEqualTo(22);
    }

    @Test
    void testInvalidPortSkipsEntry() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("invalid-port.config"));

        assertThat(entries).isEmpty();
    }

    @Test
    void testPortOutOfRangeSkipsEntry() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("port-out-of-range.config"));

        assertThat(entries).isEmpty();
    }

    @Test
    void testEmptyContentReturnsEmptyList() throws Exception {
        List<SshHostEntry> entries = parser.parseContent("");

        assertThat(entries).isNotNull().isEmpty();
    }

    @Test
    void testOnlyCommentsReturnsEmptyList() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("only-comments.config"));

        assertThat(entries).isEmpty();
    }

    @Test
    void testUnknownKeywordsIgnored() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("unknown-keywords.config"));

        assertThat(entries).hasSize(2);
        assertThat(entries.get(0).hostname()).isEqualTo("10.0.0.1");
        assertThat(entries.get(0).user()).isEqualTo("ubuntu");
    }

    @Test
    void testHostWithOnlyAlias() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("alias-only.config"));

        assertThat(entries).hasSize(1);
        SshHostEntry entry = entries.get(0);
        assertThat(entry.alias()).isEqualTo("minimal-server");
        assertThat(entry.hostname()).isNull();
        assertThat(entry.user()).isNull();
        assertThat(entry.port()).isEqualTo(22);
        assertThat(entry.identityFile()).isNull();
    }

    @Test
    void testMixedWildcardAndRealHosts() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("mixed-wildcard.config"));

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).alias()).isEqualTo("real-server");
    }

    @Test
    void testDuplicateAliasSkipped() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("duplicate-alias.config"));

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).alias()).isEqualTo("db-server-1");
        assertThat(entries.get(0).hostname()).isEqualTo("10.0.0.1");
    }

    @Test
    void testFullExampleFromSpec() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("full-example.config"));

        assertThat(entries).hasSize(3);

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
        assertThat(e2.identityFile()).isEqualTo("/home/admin/.ssh/db-server-2.key");

        SshHostEntry e3 = entries.get(2);
        assertThat(e3.alias()).isEqualTo("db-server-3");
        assertThat(e3.hostname()).isEqualTo("192.168.1.30");
        assertThat(e3.user()).isEqualTo("deploy");
        assertThat(e3.port()).isEqualTo(22);
        assertThat(e3.identityFile()).isEqualTo("/opt/keys/db server 3.key");
    }

    @Test
    void testParsePath() throws Exception {
        List<SshHostEntry> entries = parser.parse(configPath("valid-multi-host.config"));

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

    private Path configPath(String filename) throws Exception {
        return Path.of(getClass().getClassLoader()
                .getResource("ssh-config/" + filename).toURI());
    }
}
