/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.File;
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import jakarta.annotation.security.PermitAll;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;

import org.junit.jupiter.api.Test;

import io.debezium.doc.FixFor;
import io.quarkus.security.Authenticated;
import io.quarkus.security.PermissionsAllowed;

/**
 * Structural guard for fail-closed enforcement (debezium/dbz#3003): every JAX-RS method in
 * {@code io.debezium.platform.api} must declare a permission, or be on a short, explicit
 * exemption list carrying an alternative annotation instead.
 *
 * <p>With {@code quarkus.security.jaxrs.deny-unannotated-endpoints=true}, a bare method already
 * behaves as {@code @DenyAll} at runtime. This test exists so a missing declaration fails the
 * build rather than surfacing later as "why does this new endpoint always return 403".
 *
 * <p>Discovers resource classes by scanning the compiled {@code io.debezium.platform.api}
 * package directory for top-level classes carrying {@code @Path}, rather than enumerating them
 * by hand, so a newly added resource is covered automatically.
 */
class EndpointPermissionCoverageTest {

    private static final List<Class<? extends Annotation>> HTTP_METHOD_ANNOTATIONS = List.of(
            GET.class, POST.class, PUT.class, DELETE.class, PATCH.class);

    /**
     * {@code SimpleClassName#methodName} entries exempt from {@code @PermissionsAllowed}.
     * Each must carry {@code @Authenticated} or {@code @PermitAll} instead; see
     * {@link #exemptMethodsCarryAnExplicitAlternativeAnnotation()}. Adding a third entry
     * requires editing this test deliberately.
     */
    private static final Set<String> EXEMPT = Set.of(
            "SnapshotNotificationReceiver#ingest",
            "IdentityResource#me");

    @Test
    @FixFor("debezium/dbz#3003")
    void everyJaxRsMethodDeclaresAPermissionOrIsExplicitlyExempt() throws Exception {
        List<String> undeclared = new ArrayList<>();

        for (Class<?> resource : discoverResourceClasses()) {
            for (Method method : resource.getDeclaredMethods()) {
                if (!isJaxRsEndpoint(method)) {
                    continue;
                }
                String qualifiedName = qualifiedName(resource, method);
                if (method.isAnnotationPresent(PermissionsAllowed.class)) {
                    continue;
                }
                if (EXEMPT.contains(qualifiedName) && hasAlternativeAnnotation(method)) {
                    continue;
                }
                undeclared.add(qualifiedName);
            }
        }

        assertThat(undeclared)
                .as("JAX-RS methods with neither @PermissionsAllowed nor an explicit, exempted alternative")
                .isEmpty();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void exemptMethodsCarryAnExplicitAlternativeAnnotation() throws Exception {
        // With deny-unannotated-endpoints=true, a bare method is @DenyAll: an exempt endpoint
        // left bare would be silently broken (not silently open), so the exemption list only
        // ever records methods that already carry an explicit alternative.
        for (Class<?> resource : discoverResourceClasses()) {
            for (Method method : resource.getDeclaredMethods()) {
                String qualifiedName = qualifiedName(resource, method);
                if (EXEMPT.contains(qualifiedName)) {
                    assertThat(hasAlternativeAnnotation(method))
                            .as("%s is exempt but carries neither @Authenticated nor @PermitAll", qualifiedName)
                            .isTrue();
                }
            }
        }
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void exemptionListIsExactlyTwoEntries() {
        assertThat(EXEMPT).containsExactlyInAnyOrder("SnapshotNotificationReceiver#ingest", "IdentityResource#me");
    }

    private static boolean isJaxRsEndpoint(Method method) {
        for (Class<? extends Annotation> annotation : HTTP_METHOD_ANNOTATIONS) {
            if (method.isAnnotationPresent(annotation)) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasAlternativeAnnotation(Method method) {
        return method.isAnnotationPresent(Authenticated.class) || method.isAnnotationPresent(PermitAll.class);
    }

    private static String qualifiedName(Class<?> resource, Method method) {
        return resource.getSimpleName() + "#" + method.getName();
    }

    /**
     * Every top-level, {@code @Path}-annotated class compiled alongside {@link SourceResource}
     * (i.e. every JAX-RS resource in {@code io.debezium.platform.api}, not its {@code dto} or
     * {@code mapper} subpackages).
     */
    private static List<Class<?>> discoverResourceClasses() throws URISyntaxException, ClassNotFoundException {
        Class<?> anchor = SourceResource.class;
        File classesRoot = new File(anchor.getProtectionDomain().getCodeSource().getLocation().toURI());
        File packageDir = new File(classesRoot, anchor.getPackageName().replace('.', '/'));

        List<Class<?>> resources = new ArrayList<>();
        File[] files = packageDir.listFiles((dir, name) -> name.endsWith(".class"));
        if (files == null) {
            return resources;
        }
        for (File file : files) {
            String simpleName = file.getName().substring(0, file.getName().length() - ".class".length());
            if (simpleName.contains("$")) {
                continue;
            }
            Class<?> candidate = Class.forName(anchor.getPackageName() + "." + simpleName);
            if (candidate.isAnnotationPresent(Path.class)) {
                resources.add(candidate);
            }
        }
        return resources;
    }
}
