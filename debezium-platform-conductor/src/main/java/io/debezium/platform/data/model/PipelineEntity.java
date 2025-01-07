/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

import java.util.LinkedList;
import java.util.List;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.validation.constraints.NotEmpty;

import lombok.Getter;
import lombok.Setter;

@Entity(name = "pipeline")
@Getter
@Setter
public class PipelineEntity {
    @Id
    @GeneratedValue
    private Long id;
    @NotEmpty
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
    @NotEmpty
    private String logLevel = "info";
}
