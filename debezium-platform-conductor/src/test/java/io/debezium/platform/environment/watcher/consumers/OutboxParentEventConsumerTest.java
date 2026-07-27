/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.watcher.consumers;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.function.Consumer;

import jakarta.enterprise.inject.Instance;

import org.apache.kafka.connect.data.Schema;
import org.apache.kafka.connect.data.SchemaBuilder;
import org.apache.kafka.connect.data.Struct;
import org.apache.kafka.connect.source.SourceRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import io.debezium.doc.FixFor;
import io.debezium.engine.ChangeEvent;
import io.debezium.platform.environment.watcher.config.OutboxConfigGroup;
import io.debezium.platform.environment.watcher.config.WatcherConfigGroup;
import io.fabric8.kubernetes.client.KubernetesClientException;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OutboxParentEventConsumerTest {

    private static final Schema EVENT_SCHEMA = SchemaBuilder.struct()
            .field("aggregatetype", Schema.STRING_SCHEMA)
            .field("aggregateid", Schema.STRING_SCHEMA)
            .field("type", Schema.STRING_SCHEMA)
            .field("payload", Schema.STRING_SCHEMA)
            .build();

    @Mock
    OutboxConfigGroup outbox;

    @Mock(answer = Answers.RETURNS_DEEP_STUBS)
    WatcherConfigGroup watcherConfig;

    @Mock
    EnvironmentEventConsumer<?> eventConsumer;

    @SuppressWarnings("unchecked")
    Instance<EnvironmentEventConsumer<?>> eventConsumers = mock(Instance.class);

    OutboxParentEventConsumer consumer;

    @BeforeEach
    void setUp() {
        when(outbox.aggregateColumn()).thenReturn("aggregatetype");
        when(outbox.aggregateIdColumn()).thenReturn("aggregateid");
        when(outbox.typeColumn()).thenReturn("type");
        when(watcherConfig.retry().maxRetries()).thenReturn(3);
        doAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            Consumer<EnvironmentEventConsumer<?>> action = invocation.getArgument(0);
            action.accept(eventConsumer);
            return null;
        }).when(eventConsumers).forEach(any());

        consumer = new OutboxParentEventConsumer(outbox, watcherConfig, eventConsumers);
    }

    @Test
    @FixFor("debezium/dbz#2136")
    void successfulEventConsumption() {
        consumer.accept(createEvent("pipeline", "42", "CREATE", "{\"name\":\"test\"}"));

        verify(eventConsumer, times(1)).consume(eq("pipeline"), eq("CREATE"), eq(42L), eq("{\"name\":\"test\"}"));
        verify(eventConsumer, never()).onError(anyString(), anyString(), anyString(), any());
    }

    @Test
    @FixFor("debezium/dbz#2136")
    void retriableExceptionRetriesAndSucceeds() {
        doThrow(new KubernetesClientException("transient"))
                .doNothing()
                .when(eventConsumer).consume(anyString(), anyString(), anyLong(), anyString());

        consumer.accept(createEvent("pipeline", "42", "CREATE", "{}"));

        verify(eventConsumer, times(2)).consume(eq("pipeline"), eq("CREATE"), eq(42L), eq("{}"));
        verify(eventConsumer, never()).onError(anyString(), anyString(), anyString(), any());
    }

    @Test
    @FixFor("debezium/dbz#2136")
    void retriableExceptionExhaustsRetries() {
        doThrow(new KubernetesClientException("persistent"))
                .when(eventConsumer).consume(anyString(), anyString(), anyLong(), anyString());

        consumer.accept(createEvent("pipeline", "42", "CREATE", "{}"));

        verify(eventConsumer, times(4)).consume(eq("pipeline"), eq("CREATE"), eq(42L), eq("{}"));
        verify(eventConsumer).onError(eq("42"), eq("pipeline"), eq("CREATE"), any(KubernetesClientException.class));
    }

    @Test
    @FixFor("debezium/dbz#2136")
    void nonRetriableExceptionSkipsImmediately() {
        doThrow(new NullPointerException("non-retriable"))
                .when(eventConsumer).consume(anyString(), anyString(), anyLong(), anyString());

        consumer.accept(createEvent("pipeline", "42", "CREATE", "{}"));

        verify(eventConsumer, times(1)).consume(eq("pipeline"), eq("CREATE"), eq(42L), eq("{}"));
        verify(eventConsumer).onError(eq("42"), eq("pipeline"), eq("CREATE"), any(NullPointerException.class));
    }

    @Test
    @FixFor("debezium/dbz#2136")
    void nullValueIsIgnored() {
        @SuppressWarnings("unchecked")
        ChangeEvent<SourceRecord, SourceRecord> event = mock(ChangeEvent.class);
        SourceRecord sourceRecord = mock(SourceRecord.class);
        when(event.value()).thenReturn(sourceRecord);
        when(sourceRecord.value()).thenReturn(null);

        consumer.accept(event);

        verify(eventConsumer, never()).consume(anyString(), anyString(), anyLong(), anyString());
    }

    @SuppressWarnings("unchecked")
    private ChangeEvent<SourceRecord, SourceRecord> createEvent(String aggregateType, String aggregateId,
                                                                String eventType, String payload) {
        Struct struct = new Struct(EVENT_SCHEMA)
                .put("aggregatetype", aggregateType)
                .put("aggregateid", aggregateId)
                .put("type", eventType)
                .put("payload", payload);

        ChangeEvent<SourceRecord, SourceRecord> event = mock(ChangeEvent.class);
        SourceRecord sourceRecord = mock(SourceRecord.class);
        when(event.value()).thenReturn(sourceRecord);
        when(sourceRecord.value()).thenReturn(struct);
        return event;
    }
}
