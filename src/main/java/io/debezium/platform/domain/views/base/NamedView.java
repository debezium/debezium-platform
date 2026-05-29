package io.debezium.platform.domain.views.base;

import jakarta.validation.constraints.NotEmpty;

public interface NamedView extends IdView {
    @NotEmpty
    String getName();
}
