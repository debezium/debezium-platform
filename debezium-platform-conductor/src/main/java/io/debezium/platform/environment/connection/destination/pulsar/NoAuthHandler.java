package io.debezium.platform.environment.connection.destination.pulsar;

import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.apache.pulsar.client.admin.PulsarAdminBuilder;
import org.apache.pulsar.client.api.PulsarClientException;

@Named("NONE")
@ApplicationScoped
public class NoAuthHandler implements PulsarAuthHandler {
    @Override
    public void configure(PulsarAdminBuilder builder, Map<String, Object> config) throws PulsarClientException {
        // Nothing to configure
    }

    @Override
    public void validate(Map<String, Object> config) throws IllegalArgumentException {
        // Nothing to validate
    }
}
