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

@Entity(name = "source")
@Getter
@Setter
public class SourceEntity {
    @Id
    @GeneratedValue
    private Long id;
    @NotEmpty
    @Column(unique = true, nullable = false)
    public String name;
    private String description;
    @NotEmpty
    @Column(nullable = false)
    public String type;
    @NotEmpty
    @Column(nullable = false)
    public String schema;
    @ManyToMany
    @JoinTable(joinColumns = @JoinColumn(name = "source_id"), inverseJoinColumns = @JoinColumn(name = "vault_id"))
    public Set<VaultEntity> vaults = new HashSet<>();
    @JdbcTypeCode(SqlTypes.JSON)
    public Map<String, Object> config;
}
