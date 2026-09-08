/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import java.util.HashMap;
import java.util.Map;

/** Test configuration that activates the Host Agent runtime. */
public class AgentRuntimeTestProfile extends HostModeTestProfile {

    @Override
    public Map<String, String> getConfigOverrides() {
        Map<String, String> overrides = new HashMap<>(super.getConfigOverrides());
        overrides.put("platform.host.container-runtime", "agent");
        return overrides;
    }
}
