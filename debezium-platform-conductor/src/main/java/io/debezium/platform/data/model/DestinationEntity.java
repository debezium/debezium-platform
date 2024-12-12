package io.debezium.platform.data.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@Entity(name = "Destination")
@Getter
@Setter
public class DestinationEntity {
    @Id
    @GeneratedValue
    private Long id;
    @NotEmpty
    @Column(unique = true, nullable = false)
    private String name;
    private String description;
    @NotEmpty
    @Column(nullable = false)
    private String type;
    @NotEmpty
    @Column(nullable = false)
    private String schema;
    @ManyToMany
    @JoinTable(joinColumns = @JoinColumn(name = "destination_id"), inverseJoinColumns = @JoinColumn(name = "vault_id"))
    private Set<VaultEntity> vaults = new HashSet<>();
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> config;
}
