/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.discovery;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.StringReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import jakarta.enterprise.context.ApplicationScoped;

import org.jboss.logging.Logger;

/**
 * Parses an OpenSSH {@code ~/.ssh/config} file into a list of {@link SshHostEntry} records.
 *
 * <p>This is a pure, stateless parser with no database access, no SSH connectivity, and no
 * file-watching behavior. It reads text and produces structured data — nothing more.
 *
 * <p>The public API is {@link #parse(Path)}, which reads a file and delegates to the
 * package-visible {@link #parseContent(String)} method. The separation exists so that
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
        String content = Files.readString(configFilePath);
        List<SshHostEntry> entries = parseContent(content);
        logger.debugv("Found {0} host entries in SSH config", entries.size());
        return entries;
    }

    /**
     * Parses the given SSH config content string into host entries.
     * Package-visible for unit test access.
     */
    List<SshHostEntry> parseContent(String content) {
        List<SshHostEntry> result = new ArrayList<>();
        Set<String> seenAliases = new HashSet<>();

        // Current block state
        String currentAlias = null;
        String currentHostname = null;
        String currentUser = null;
        int currentPort = DEFAULT_PORT;
        String currentIdentityFile = null;

        try (BufferedReader reader = new BufferedReader(new StringReader(content))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();

                // Rule 1: skip blank lines and full-line comments
                if (trimmed.isEmpty() || trimmed.charAt(0) == '#') {
                    continue;
                }

                // Rule 2: split into keyword and value
                String keyword;
                String value;
                int splitIndex = findDelimiterIndex(trimmed);
                if (splitIndex < 0) {
                    // No delimiter found — malformed line
                    logger.warnv("Malformed line in SSH config (no keyword-value delimiter): {0}", trimmed);
                    continue;
                }

                keyword = trimmed.substring(0, splitIndex).trim().toLowerCase();
                // Skip past the delimiter character and trim
                String rawValue = trimmed.substring(splitIndex + 1).trim();

                // Handle mixed delimiter: "Key = Value" splits at the space, leaving "= Value".
                // Strip the leading '=' and re-trim so all three forms produce the same value:
                // "Port 22" → rawValue = "22"
                // "Port=22" → rawValue = "22"
                // "Port = 22" → rawValue = "= 22" → strip '=' → "22"
                if (!rawValue.isEmpty() && rawValue.charAt(0) == '=') {
                    rawValue = rawValue.substring(1).trim();
                }

                if (rawValue.isEmpty()) {
                    logger.warnv("Malformed line in SSH config (empty value): {0}", trimmed);
                    continue;
                }

                // Rule 3: strip inline comments (unquoted '#')
                value = stripInlineComment(rawValue);

                // Rule 4: strip surrounding quotes
                value = stripQuotes(value);

                // Rule 5: keyword is already lowercased above

                if ("host".equals(keyword)) {
                    // Flush the previous block if there is one
                    if (currentAlias != null) {
                        result.add(new SshHostEntry(currentAlias, currentHostname,
                                currentUser, currentPort, currentIdentityFile));
                    }

                    // Rule 7: check for wildcards
                    if (isWildcard(value)) {
                        logger.warnv("Skipping wildcard Host entry: {0}", value);
                        currentAlias = null;
                        currentHostname = null;
                        currentUser = null;
                        currentPort = DEFAULT_PORT;
                        currentIdentityFile = null;
                        continue;
                    }

                    // Rule 11: duplicate alias detection
                    if (!seenAliases.add(value)) {
                        logger.warnv("Duplicate Host alias found: {0}", value);
                    }

                    // Start a new block
                    currentAlias = value;
                    currentHostname = null;
                    currentUser = null;
                    currentPort = DEFAULT_PORT;
                    currentIdentityFile = null;
                }
                else if (currentAlias != null) {
                    // Rule 8: only process recognized keywords within a host block
                    switch (keyword) {
                        case "hostname":
                            currentHostname = value;
                            break;
                        case "user":
                            currentUser = value;
                            break;
                        case "port":
                            currentPort = parsePort(value);
                            break;
                        case "identityfile":
                            currentIdentityFile = value;
                            break;
                        default:
                            // Unknown keywords are silently ignored (Rule 8)
                            break;
                    }
                }
                // If currentAlias is null, we're inside a skipped wildcard block — ignore
            }
        }
        catch (IOException e) {
            // StringReader never throws IOException, but the compiler requires handling it
            throw new IllegalStateException("Unexpected IOException reading from string", e);
        }

        // Flush the last block
        if (currentAlias != null) {
            result.add(new SshHostEntry(currentAlias, currentHostname,
                    currentUser, currentPort, currentIdentityFile));
        }

        return result;
    }

    /**
     * Finds the index of the first delimiter (whitespace or '=') in the line.
     * Returns -1 if no delimiter is found.
     */
    private int findDelimiterIndex(String line) {
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '=' || Character.isWhitespace(c)) {
                return i;
            }
        }
        return -1;
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
            if (c == '"') {
                inQuotes = !inQuotes;
            }
            else if (c == '#' && !inQuotes) {
                return value.substring(0, i).trim();
            }
        }
        return value;
    }

    /**
     * Strips surrounding double quotes from a value if present.
     */
    private String stripQuotes(String value) {
        if (value.length() >= 2 && value.charAt(0) == '"' && value.charAt(value.length() - 1) == '"') {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    /**
     * Returns true if the host alias contains wildcard characters (*, ?, !).
     */
    private boolean isWildcard(String alias) {
        for (int i = 0; i < alias.length(); i++) {
            char c = alias.charAt(i);
            if (c == '*' || c == '?' || c == '!') {
                return true;
            }
        }
        return false;
    }

    /**
     * Parses a port string into an integer, falling back to the default port (22)
     * if the value is not a valid integer or is outside the allowed range.
     */
    private int parsePort(String value) {
        try {
            int port = Integer.parseInt(value);
            if (port < MIN_PORT || port > MAX_PORT) {
                logger.warnv("Port value out of range (1-65535): {0}, using default {1}", value, DEFAULT_PORT);
                return DEFAULT_PORT;
            }
            return port;
        }
        catch (NumberFormatException e) {
            logger.warnv("Invalid port value: {0}, using default {1}", value, DEFAULT_PORT);
            return DEFAULT_PORT;
        }
    }
}
