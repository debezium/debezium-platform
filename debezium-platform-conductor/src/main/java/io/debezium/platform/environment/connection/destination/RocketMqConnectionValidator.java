/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination;

import java.time.Duration;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.apache.rocketmq.acl.common.AclClientRPCHook;
import org.apache.rocketmq.acl.common.SessionCredentials;
import org.apache.rocketmq.client.producer.DefaultMQProducer;
import org.apache.rocketmq.remoting.RPCHook;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.ConnectionConfigUtils;
import io.debezium.platform.environment.connection.ConnectionValidator;
import io.debezium.util.Strings;

/**
 * Implementation of {@link ConnectionValidator} for Apache RocketMQ connections.
 * <p>
 * The validation is performed against the RocketMQ name server, which is the entry point
 * used by the Debezium Server RocketMQ sink. Connectivity is verified by issuing a topic
 * list request, which forces an actual round trip to the name server.
 * </p>
 *
 * <p>
 * The validation process includes:
 * <ul>
 *   <li>Name server address presence check</li>
 *   <li>ACL credentials consistency check, when ACL is enabled</li>
 *   <li>Name server reachability and, when ACL is enabled, credentials verification</li>
 * </ul>
 * </p>
 */
@Named("APACHE_ROCKETMQ")
@ApplicationScoped
public class RocketMqConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(RocketMqConnectionValidator.class);

    private static final String NAME_SRV_ADDR = "producer.name.srv.addr";
    private static final String PRODUCER_GROUP = "producer.group";
    private static final String ACL_ENABLED = "producer.acl.enabled";
    private static final String ACCESS_KEY = "producer.access.key";
    private static final String SECRET_KEY = "producer.secret.key";

    private static final String DEFAULT_PRODUCER_GROUP = "debezium";

    private final int defaultConnectionTimeoutSeconds;

    public RocketMqConnectionValidator(@ConfigProperty(name = "destinations.rocketmq.connection.timeout", defaultValue = "60") int defaultConnectionTimeoutSeconds) {
        this.defaultConnectionTimeoutSeconds = defaultConnectionTimeoutSeconds;
    }

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        if (connectionConfig == null) {
            return ConnectionValidationResult.failed("Connection configuration cannot be null");
        }

        LOGGER.debug("Starting RocketMQ connection validation for connection: {}", connectionConfig.getName());

        Map<String, Object> config = connectionConfig.getConfig();
        String nameSrvAddr = ConnectionConfigUtils.getString(config, NAME_SRV_ADDR);

        if (Strings.isNullOrBlank(nameSrvAddr)) {
            return ConnectionValidationResult.failed("Name server address must be specified");
        }

        boolean aclEnabled = ConnectionConfigUtils.getBoolean(config, ACL_ENABLED, false);
        String accessKey = ConnectionConfigUtils.getString(config, ACCESS_KEY);
        String secretKey = ConnectionConfigUtils.getString(config, SECRET_KEY);

        if (aclEnabled && (Strings.isNullOrBlank(accessKey) || Strings.isNullOrBlank(secretKey))) {
            return ConnectionValidationResult.failed("Access key and secret key must be specified when ACL is enabled");
        }

        String producerGroup = ConnectionConfigUtils.getString(config, PRODUCER_GROUP);
        if (Strings.isNullOrBlank(producerGroup)) {
            producerGroup = DEFAULT_PRODUCER_GROUP;
        }

        RPCHook rpcHook = aclEnabled ? new AclClientRPCHook(new SessionCredentials(accessKey, secretKey)) : null;

        return performConnectionValidation(nameSrvAddr, producerGroup, rpcHook);
    }

    /**
     * Performs the actual connection validation by starting a producer against the given
     * name server and requesting the topic list from it.
     *
     * @param nameSrvAddr the RocketMQ name server address list
     * @param producerGroup the producer group used to identify the client
     * @param rpcHook the ACL hook to sign the requests with, or {@code null} when ACL is disabled
     * @return ConnectionValidationResult indicating success or failure
     */
    private ConnectionValidationResult performConnectionValidation(String nameSrvAddr, String producerGroup, RPCHook rpcHook) {
        int timeoutMillis = (int) Duration.ofSeconds(defaultConnectionTimeoutSeconds).toMillis();

        DefaultMQProducer producer = new DefaultMQProducer(producerGroup, rpcHook);
        producer.setNamesrvAddr(nameSrvAddr);
        producer.setMqClientApiTimeout(timeoutMillis);

        try {
            producer.start();

            LOGGER.debug("Requesting topic list from RocketMQ name server at {}", nameSrvAddr);
            producer.getDefaultMQProducerImpl()
                    .getmQClientFactory()
                    .getMQClientAPIImpl()
                    .getTopicListFromNameServer(timeoutMillis);

            LOGGER.debug("Successfully connected to RocketMQ name server at {}", nameSrvAddr);
            return ConnectionValidationResult.successful();
        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOGGER.warn("RocketMQ connection validation was interrupted", e);
            return ConnectionValidationResult.failed("Connection validation was interrupted");
        }
        catch (Exception e) {
            LOGGER.warn("Failed to connect to RocketMQ name server at {}", nameSrvAddr, e);
            return ConnectionValidationResult.failed("Failed to connect to RocketMQ name server at " + nameSrvAddr + ": " + e.getMessage());
        }
        finally {
            try {
                producer.shutdown();
            }
            catch (Exception e) {
                LOGGER.warn("Error shutting down RocketMQ producer", e);
            }
        }
    }
}
