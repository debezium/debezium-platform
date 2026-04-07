package io.debezium.platform.api.dto;

import java.util.Map;

public record VaultResponse(
        Long id,
        String name,
        boolean plaintext,
        Map<String, String> items) {
}
