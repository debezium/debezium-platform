/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AuthResourceTest {

    @Test
    void loginRedirectAcceptsOnlyLocalPaths() {
        assertThat(AuthResource.isLocalPath("/pipelines?x=1")).isTrue();
        assertThat(AuthResource.isLocalPath(null)).isFalse();
        assertThat(AuthResource.isLocalPath("https://evil.com")).isFalse();
        assertThat(AuthResource.isLocalPath("//evil.com")).isFalse();
        assertThat(AuthResource.isLocalPath("/\\evil.com")).isFalse();
    }
}
