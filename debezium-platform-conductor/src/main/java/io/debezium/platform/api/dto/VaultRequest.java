package io.debezium.platform.api.dto;

import java.util.Map;

import jakarta.validation.constraints.NotEmpty;

public record VaultRequest(
        @NotEmpty String name,
        boolean plaintext,
        Map<String, String> items) {
}
