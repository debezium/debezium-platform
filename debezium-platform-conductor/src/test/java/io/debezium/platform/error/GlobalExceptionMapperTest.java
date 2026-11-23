/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.error;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.SQLException;
import java.util.List;

import jakarta.ws.rs.core.Response;

import org.hibernate.exception.ConstraintViolationException;
import org.hibernate.exception.ConstraintViolationException.ConstraintKind;
import org.junit.jupiter.api.Test;

import io.debezium.platform.error.GlobalExceptionMapper.ErrorResponse;

class GlobalExceptionMapperTest {

    private final GlobalExceptionMapper mapper = new GlobalExceptionMapper();

    @Test
    void uniqueViolationIsReportedAsAlreadyExists() {
        Response response = mapper.mapHibernateConstraintViolationException(violation(ConstraintKind.UNIQUE, "pipeline_name_key"));

        assertThat(response.getStatus()).isEqualTo(409);
        assertThat(response.getEntity()).isEqualTo(new ErrorResponse("Already exists", List.of("Pipeline with this name already exists")));
    }

    @Test
    void uniqueViolationOnAnotherColumnIsNotReportedAsDuplicateName() {
        Response response = mapper.mapHibernateConstraintViolationException(violation(ConstraintKind.UNIQUE, "active_snapshot_pipeline_id_key"));

        assertThat(response.getStatus()).isEqualTo(409);
        assertThat(response.getEntity())
                .isEqualTo(new ErrorResponse("Already exists", List.of("UNIQUE constraint violated: active_snapshot_pipeline_id_key")));
    }

    @Test
    void notNullViolationIsNotReportedAsAlreadyExists() {
        Response response = mapper.mapHibernateConstraintViolationException(violation(ConstraintKind.NOT_NULL, "for_duration"));

        assertThat(response.getStatus()).isEqualTo(400);
        assertThat(response.getEntity()).isEqualTo(new ErrorResponse("Constraint violation", List.of("NOT_NULL constraint violated: for_duration")));
    }

    private static ConstraintViolationException violation(ConstraintKind kind, String constraintName) {
        return new ConstraintViolationException("could not execute statement", new SQLException("constraint violated"), "insert into t", kind, constraintName);
    }
}
