/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.error;

import java.util.List;

import jakarta.validation.ConstraintViolationException;
import jakarta.ws.rs.NotSupportedException;
import jakarta.ws.rs.core.Response;

import org.jboss.resteasy.reactive.server.ServerExceptionMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class GlobalExceptionMapper {

    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionMapper.class);

    @ServerExceptionMapper(RuntimeException.class)
    public Response mapRuntimeException(RuntimeException ex) {

        LOGGER.error("Error while processing request", ex);
        // Try to unwrap a ConstraintViolationException
        // Seems that Bean Validation on REST object don't work with Blazebit views.
        Throwable cause = ex;
        while (cause != null) {
            if (cause instanceof ConstraintViolationException cve) {
                List<String> violations = cve.getConstraintViolations().stream()
                        .map(cv -> String.format(
                                "%s: %s [%s]",
                                cv.getPropertyPath(),
                                cv.getMessage(),
                                cv.getMessageTemplate()))
                        .toList();

                ErrorResponse response = new ErrorResponse("Validation failed", violations);
                return Response.status(Response.Status.BAD_REQUEST).entity(response).build();
            }
            cause = cause.getCause();
        }

        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(new ErrorResponse("An unexpected error happened", List.of(ex.getMessage())))
                .build();
    }

    @ServerExceptionMapper(NotFoundException.class)
    public Response mapNotFoundException(NotFoundException ex) {

        LOGGER.error("Error while processing request", ex);

        return Response.status(Response.Status.NOT_FOUND)
                .entity(new ErrorResponse("resource not found", List.of(ex.getMessage())))
                .build();
    }

    @ServerExceptionMapper(NotSupportedException.class)
    public Response mapNotSupportedException(NotSupportedException ex) {

        LOGGER.error("Error while processing request", ex);

        return Response.status(Response.Status.BAD_REQUEST)
                .entity(new ErrorResponse("resource not found", List.of(ex.getMessage())))
                .build();
    }

    @ServerExceptionMapper(IllegalArgumentException.class)
    public Response mapIllegalArgumentExceptionException(IllegalArgumentException ex) {

        LOGGER.error("Error while processing request", ex);

        return Response.status(Response.Status.BAD_REQUEST)
                .entity(new ErrorResponse("resource not found", List.of(ex.getMessage())))
                .build();
    }

    public record ErrorResponse(String error, List<String> details) {
        public ErrorResponse(String error) {
            this(error, List.of());
        }
    }
}
