/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.discovery;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.IntStream;

import jakarta.enterprise.context.ApplicationScoped;

import org.jboss.logging.Logger;

/**
 * Parses an OpenSSH {@code ~/.ssh/config} file into a list of {@link SshHostEntry} records.
 *
 * <p>This is a pure, stateless parser with no database access, no SSH connectivity, and no
 * file-watching behavior. It reads text and produces structured data — nothing more.
 *
 * <p>The public API is {@link #parse(Path)}, which reads a file and delegates to the
 * package-visible {@link #parseLines(List)} method. The separation exists so that
 * unit tests can call {@code parseContent} directly with string literals, avoiding the
 * overhead of temporary files.
 *
 * <p>Parsing rules follow the {@code ssh_config(5)} specification:
 * <ul>
 *   <li>Keywords are case-insensitive; values are case-sensitive</li>
 *   <li>Both whitespace and {@code =} are valid keyword-value delimiters</li>
 *   <li>Inline comments (OpenSSH 8.5+) are stripped from values</li>
 *   <li>Quoted values have surrounding double-quotes removed</li>
 *   <li>Wildcard Host entries ({@code *}, {@code ?}, {@code !}) are skipped</li>
 * </ul>
 */
@ApplicationScoped
public class SshConfigParser {

    private static final int DEFAULT_PORT = 22;
    private static final int MIN_PORT = 1;
    private static final int MAX_PORT = 65535;
    private static final char EQUALS_DELIMITER = '=';
    private static final char COMMENT_CHAR = '#';
    private static final char QUOTE_CHAR = '"';
    private static final String WILDCARD_CHARS = "*?!";
    private static final String HOST_KEYWORD = "host";

    private final Logger logger;

    public SshConfigParser(Logger logger) {
        this.logger = logger;
    }

    /**
     * Parses the SSH config file at the given path.
     *
     * @param configFilePath path to the SSH config file
     * @return list of parsed host entries, never null
     * @throws IOException if the file cannot be read
     */
    public List<SshHostEntry> parse(Path configFilePath) throws IOException {
        logger.debugv("Parsing SSH config file: {0}", configFilePath);
        List<String> lines = Files.readAllLines(configFilePath);
        List<SshHostEntry> hostEntries = parseLines(lines);
        logger.debugv("Found {0} host entries in SSH config", hostEntries.size());
        return hostEntries;
    }

    /**
     * Parses the given SSH config content string into host entries.
     * Package-visible for unit test access.
     */
    List<SshHostEntry> parseContent(String content) {
        return parseLines(Arrays.asList(content.split("\n", -1)));
    }

    /**
     * Core parsing logic that operates on a list of lines.
     * Streams each raw line through {@link #parseLine(String)} to extract keyword-value
     * pairs, then groups them into host entries via {@link #buildHostEntries(List)}.
     */
    private List<SshHostEntry> parseLines(List<String> lines) {
        List<ParsedLine> parsedLines = lines.stream()
                .map(this::parseLine)
                .flatMap(Optional::stream)
                .toList();

        return buildHostEntries(parsedLines);
    }

    /**
     * Parses a single raw line into a keyword-value pair.
     * Returns empty for blank lines, comments, and malformed lines.
     */
    private Optional<ParsedLine> parseLine(String rawLine) {
        String stripped = rawLine.strip();

        if (isBlankOrComment(stripped)) {
            return Optional.empty();
        }

        int splitIndex = findDelimiterIndex(stripped);
        if (splitIndex < 0) {
            logger.warnv("Malformed line in SSH config (no keyword-value delimiter): {0}", stripped);
            return Optional.empty();
        }

        String keyword = stripped.substring(0, splitIndex).strip().toLowerCase();
        String rawValue = stripped.substring(splitIndex + 1).strip();

        if (!rawValue.isEmpty() && rawValue.charAt(0) == EQUALS_DELIMITER) {
            rawValue = rawValue.substring(1).strip();
        }

        if (rawValue.isEmpty()) {
            logger.warnv("Malformed line in SSH config (empty value): {0}", stripped);
            return Optional.empty();
        }

        String value = stripInlineComment(rawValue);
        value = stripQuotes(value);

        return Optional.of(new ParsedLine(keyword, value));
    }

    /**
     * Groups parsed keyword-value lines into host entries, handling wildcards,
     * duplicates, and invalid ports.
     */
    private List<SshHostEntry> buildHostEntries(List<ParsedLine> parsedLines) {
        List<SshHostEntry> hostEntries = new ArrayList<>();
        Set<String> seenAliases = new HashSet<>();
        HostBlock current = new HostBlock();

        for (ParsedLine parsed : parsedLines) {
            if (isHostLine(parsed.keyword())) {
                if (current.hasAlias()) {
                    hostEntries.add(current.toSshHostEntry());
                }

                if (isWildcard(parsed.value())) {
                    logger.warnv("Skipping wildcard Host entry: {0}", parsed.value());
                    current.reset();
                    continue;
                }

                if (!seenAliases.add(parsed.value())) {
                    logger.warnv("Skipping duplicate Host alias: {0}", parsed.value());
                    current.reset();
                    continue;
                }

                current.startNew(parsed.value());
            }
            else if (current.hasAlias()) {
                switch (parsed.keyword()) {
                    case "hostname" -> current.hostname = parsed.value();
                    case "user" -> current.user = parsed.value();
                    case "port" -> {
                        int port = parsePort(parsed.value());
                        if (port < 0) {
                            logger.warnv("Skipping host entry ''{0}'' due to invalid port: {1}", current.alias, parsed.value());
                            current.reset();
                        }
                        else {
                            current.port = port;
                        }
                    }
                    case "identityfile" -> current.identityFile = parsed.value();
                    default -> {
                    }
                }
            }
        }

        if (current.hasAlias()) {
            hostEntries.add(current.toSshHostEntry());
        }

        return hostEntries;
    }

    private boolean isBlankOrComment(String line) {
        return line.isEmpty() || line.charAt(0) == COMMENT_CHAR;
    }

    private boolean isHostLine(String keyword) {
        return HOST_KEYWORD.equals(keyword);
    }

    /**
     * Finds the index of the first delimiter (whitespace or '=') in the line.
     * Returns -1 if no delimiter is found.
     */
    private int findDelimiterIndex(String line) {
        return IntStream.range(0, line.length())
                .filter(i -> line.charAt(i) == EQUALS_DELIMITER || Character.isWhitespace(line.charAt(i)))
                .findFirst()
                .orElse(-1);
    }

    /**
     * Strips an inline comment from the value. An inline comment starts at the first
     * '#' that is not inside double quotes.
     *
     * <p>Example: {@code "deploy # production"} becomes {@code "deploy"}.
     * <p>Example: {@code "\"path with # in it\""} preserves the '#' inside quotes.
     */
    private String stripInlineComment(String value) {
        boolean inQuotes = false;
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == QUOTE_CHAR) {
                inQuotes = !inQuotes;
            }
            else if (c == COMMENT_CHAR && !inQuotes) {
                return value.substring(0, i).strip();
            }
        }
        return value;
    }

    /**
     * Strips surrounding double quotes from a value if present.
     */
    private String stripQuotes(String value) {
        if (value.length() >= 2 && value.charAt(0) == QUOTE_CHAR && value.charAt(value.length() - 1) == QUOTE_CHAR) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    /**
     * Returns true if the host alias contains wildcard characters.
     */
    private boolean isWildcard(String alias) {
        return alias.chars().anyMatch(c -> WILDCARD_CHARS.indexOf(c) >= 0);
    }

    /**
     * Parses a port string into an integer. Returns -1 if the value is not
     * a valid integer or is outside the allowed range (1-65535).
     */
    private int parsePort(String value) {
        try {
            int port = Integer.parseInt(value);
            if (port < MIN_PORT || port > MAX_PORT) {
                logger.warnv("Port value out of range (1-65535): {0}", value);
                return -1;
            }
            return port;
        }
        catch (NumberFormatException e) {
            logger.warnv("Invalid port value: {0}", value);
            return -1;
        }
    }

    /**
     * Represents a parsed keyword-value pair from a single SSH config line.
     */
    private record ParsedLine(String keyword, String value) {
    }

    /**
     * Mutable accumulator for the fields of a single Host block during parsing.
     * Encapsulates the reset and conversion logic to avoid repeating field
     * assignments across the parser.
     */
    private static class HostBlock {
        private String alias;
        private String hostname;
        private String user;
        private int port = DEFAULT_PORT;
        private String identityFile;

        boolean hasAlias() {
            return alias != null;
        }

        void startNew(String alias) {
            reset();
            this.alias = alias;
        }

        void reset() {
            alias = null;
            hostname = null;
            user = null;
            port = DEFAULT_PORT;
            identityFile = null;
        }

        SshHostEntry toSshHostEntry() {
            return new SshHostEntry(alias, hostname, user, port, identityFile);
        }
    }
}
