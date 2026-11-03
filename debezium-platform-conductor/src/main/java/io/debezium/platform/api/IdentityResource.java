/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static jakarta.ws.rs.core.MediaType.APPLICATION_JSON;

import java.security.Principal;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.Response;

import org.eclipse.microprofile.jwt.JsonWebToken;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import io.debezium.platform.api.dto.IdentityResponse;
import io.debezium.platform.config.SecurityConfigGroup;
import io.debezium.platform.config.security.Permission;
import io.debezium.platform.config.security.PermissionAugmentor;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;

/**
 * Reports the caller's identity and effective permissions (debezium/dbz#3003). The UI and the
 * CLI cannot compute permissions themselves: the role-to-permission mapping is deployment
 * configuration neither has visibility into.
 *
 * <p>Requires authentication but no permission: any authenticated caller may ask who they are.
 * Exempt from {@code @PermissionsAllowed} on {@code EndpointPermissionCoverageTest}'s list, with
 * {@code @Authenticated} carried explicitly so the endpoint is not left bare.
 */
@Tag(name = "identity")
@Path("/me")
public class IdentityResource {

    private final SecurityIdentity identity;
    private final SecurityConfigGroup config;

    public IdentityResource(SecurityIdentity identity, SecurityConfigGroup config) {
        this.identity = identity;
        this.config = config;
    }

    @Operation(summary = "Returns the caller's identity and effective permissions")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = IdentityResponse.class, required = true)))
    @Authenticated
    @GET
    public Response me() {
        if (!config.enabled()) {
            // No identity and no permission set exist to report; stating the mode explicitly is
            // what lets a client distinguish this from "authenticated but holding nothing".
            return Response.ok(IdentityResponse.disabled()).build();
        }

        Principal principal = identity.getPrincipal();
        String subject = principal.getName();
        String username = subject;
        String email = null;
        if (principal instanceof JsonWebToken jwt) {
            String preferredUsername = jwt.getClaim("preferred_username");
            if (preferredUsername != null) {
                username = preferredUsername;
            }
            email = jwt.getClaim("email");
        }

        Set<String> permissions = grantedPermissionIds();

        return Response.ok(new IdentityResponse(true, subject, username, email, identity.getRoles(), permissions))
                .build();
    }

    @SuppressWarnings("unchecked")
    private Set<String> grantedPermissionIds() {
        Object attribute = identity.getAttribute(PermissionAugmentor.PERMISSIONS_ATTRIBUTE);
        Set<Permission> granted = attribute == null ? Set.of() : (Set<Permission>) attribute;
        return granted.stream().map(Permission::id).collect(Collectors.toUnmodifiableSet());
    }
}
