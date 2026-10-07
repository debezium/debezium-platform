#!/bin/sh

# Fail fast: on OpenShift the container runs as an arbitrary UID, and a
# permission error here must stop the pod instead of serving a UI that
# silently falls back to http://localhost:8080.
set -e

# Create a configuration file with environment variables
echo "window.__ENV__ = {
  CONDUCTOR_URL: '${CONDUCTOR_URL}'
};" > /app/dist/env-config.js

# Inject the script into index.html
sed -i '/<head>/a <script src="/env-config.js"></script>' /app/dist/index.html

# Start the serve command
serve -s /app/dist -l 3000 --single