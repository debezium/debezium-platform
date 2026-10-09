package io.debezium.platform.data.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record SignalCollectionSetupQueryRequest(
        @NotEmpty String connectorType,
        @NotNull String fullyQualifiedCollectionName) {
}