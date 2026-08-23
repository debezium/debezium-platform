/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.provisioning;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Copies content to a file on the remote host via the Ansible {@code copy} module.
 *
 * <p>Content is written to a local temp file and uploaded via {@code src=}
 * to avoid single-quote injection issues with the {@code content=} argument.
 * The temp file path is exposed via {@link #tempFile()} so the runner can
 * clean it up after execution.
 *
 * <p>Example: {@code ansible <host> -m copy -a "src=/tmp/xyz dest=/opt/config mode=0644"}
 */
public final class CopyCommand implements AnsibleCommand {

    private final String content;
    private final String destPath;
    private Path tempFilePath;

    public CopyCommand(String content, String destPath) {
        this.content = content;
        this.destPath = destPath;
    }

    @Override
    public String module() {
        return "copy";
    }

    @Override
    public String buildArgs() throws IOException {
        tempFilePath = Files.createTempFile("debezium-config-", ".properties");
        Files.writeString(tempFilePath, content, StandardCharsets.UTF_8);
        return "src=" + tempFilePath.toAbsolutePath() + " dest=" + destPath + " mode=0644";
    }

    @Override
    public Path tempFile() {
        return tempFilePath;
    }
}
