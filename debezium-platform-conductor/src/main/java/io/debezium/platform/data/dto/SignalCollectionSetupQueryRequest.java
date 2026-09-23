package io.debezium.platform.data.dto;

import jakarta.validation.constraints.NotEmpty;

public record SignalCollectionSetupQueryRequest (
    @NotEmpty String connectorType,
    @NotEmpty String fullyQualifiedCollectionName
)
{}