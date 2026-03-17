package io.debezium.platform.environment.connection.destination.pulsar;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.pulsar.client.admin.PulsarAdmin;
import org.apache.pulsar.client.admin.PulsarAdminBuilder;

@ApplicationScoped
public class DefaultPulsarAdminProvider implements PulsarAdminProvider{
    @Override
    public PulsarAdminBuilder builder() {
        return PulsarAdmin.builder();
    }
}
