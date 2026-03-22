/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.OrderColumn;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import io.debezium.platform.validation.ValidationPatterns;

@Entity(name = "pipeline")
public class PipelineEntity {
    @Id
    @GeneratedValue
    private Long id;
    @NotEmpty
    @Size(max = 253, message = "Pipeline name must be 253 characters or fewer")
    @Pattern(regexp = ValidationPatterns.RFC_1123_SUBDOMAIN, message = "Pipeline name must be a lowercase RFC 1123 subdomain")
    @Column(unique = true, nullable = false)
    private String name;
    private String description;
    @ManyToOne
    private SourceEntity source;
    @ManyToOne
    private DestinationEntity destination;
    @ManyToMany
    @JoinTable(joinColumns = @JoinColumn(name = "pipeline_id"), inverseJoinColumns = @JoinColumn(name = "transform_id"))
    @OrderColumn
    private List<TransformEntity> transforms = new LinkedList<>();

    @ElementCollection
    @CollectionTable(name = "pipeline_log_levels", joinColumns = @JoinColumn(name = "pipeline_id"))
    @MapKeyColumn(name = "category")
    @Column(name = "level")
    private Map<String, String> logLevels = new HashMap<>();

    @NotEmpty
    @Column(name = "default_log_level")
    private String defaultLogLevel = "info";

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public SourceEntity getSource() {
        return source;
    }

    public void setSource(SourceEntity source) {
        this.source = source;
    }

    public DestinationEntity getDestination() {
        return destination;
    }

    public void setDestination(DestinationEntity destination) {
        this.destination = destination;
    }

    public List<TransformEntity> getTransforms() {
        return transforms;
    }

    public void setTransforms(List<TransformEntity> transforms) {
        this.transforms = transforms;
    }

    public String getDefaultLogLevel() {
        return defaultLogLevel;
    }

    public void setDefaultLogLevel(String defaultLogLevel) {
        this.defaultLogLevel = defaultLogLevel;
    }

    public Map<String, String> getLogLevels() {
        return logLevels;
    }

    public void setLogLevels(Map<String, String> logLevels) {
        this.logLevels = logLevels;
    }
}
