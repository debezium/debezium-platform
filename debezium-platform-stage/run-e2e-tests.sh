#!/bin/bash

# Debezium Platform Stage - E2E Test Runner
# This script automates the process of running Cypress E2E tests

set -e

CONDUCTOR_DIR="../debezium-platform-conductor/dev"
BACKEND_URL="http://localhost:8080"
BACKEND_API_URL="$BACKEND_URL/api/pipelines"
MAX_WAIT=60

echo "🚀 Debezium Platform Stage - E2E Test Runner"
echo "=============================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if backend is ready
check_backend() {
    echo "⏳ Checking if backend is ready..."
    
    if curl -s "$BACKEND_API_URL" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is ready!${NC}"
        return 0
    else
        return 1
    fi
}

# Function to wait for backend
wait_for_backend() {
    local elapsed=0
    echo "⏳ Waiting for backend to be ready (max ${MAX_WAIT}s)..."
    
    while [ $elapsed -lt $MAX_WAIT ]; do
        if check_backend; then
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
        echo "   ... still waiting ($elapsed/${MAX_WAIT}s)"
    done
    
    echo -e "${RED}❌ Backend did not become ready in time${NC}"
    return 1
}

# Check if docker/podman is available
if command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
elif command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
else
    echo -e "${RED}❌ Neither docker nor podman is installed${NC}"
    exit 1
fi

echo "Using container runtime: $CONTAINER_CMD"
echo ""

# Step 1: Check if backend is already running
echo "📋 Step 1: Checking backend status..."
if check_backend; then
    echo -e "${GREEN}✅ Backend is already running${NC}"
else
    echo -e "${YELLOW}⚠️  Backend is not running. Starting it now...${NC}"
    
    # Check if conductor directory exists
    if [ ! -d "$CONDUCTOR_DIR" ]; then
        echo -e "${RED}❌ Conductor directory not found: $CONDUCTOR_DIR${NC}"
        echo "Please ensure you have the debezium-platform-conductor repository cloned"
        exit 1
    fi
    
    # Start backend services
    echo "Starting backend services..."
    cd "$CONDUCTOR_DIR"
    $CONTAINER_CMD compose up -d
    cd - > /dev/null
    
    # Wait for backend to be ready
    if ! wait_for_backend; then
        echo -e "${RED}❌ Failed to start backend${NC}"
        echo "Check logs with: cd $CONDUCTOR_DIR && $CONTAINER_CMD compose logs"
        exit 1
    fi
fi

echo ""

# Step 2: Run Cypress tests
echo "📋 Step 2: Running Cypress E2E tests..."
echo ""

# Check for command line arguments
if [ "$1" = "--headless" ] || [ "$1" = "-h" ]; then
    echo "Running tests in headless mode..."
    yarn e2e:ci
elif [ "$1" = "--chrome" ]; then
    echo "Running tests in Chrome browser..."
    yarn cypress:run:chrome
elif [ "$1" = "--firefox" ]; then
    echo "Running tests in Firefox browser..."
    yarn cypress:run:firefox
else
    echo "Opening Cypress Test Runner (interactive mode)..."
    echo "Tip: Use --headless, --chrome, or --firefox flags to run in different modes"
    yarn e2e
fi

# Capture exit code
TEST_EXIT_CODE=$?

echo ""
echo "=============================================="
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Tests completed successfully!${NC}"
else
    echo -e "${RED}❌ Tests failed with exit code: $TEST_EXIT_CODE${NC}"
fi

exit $TEST_EXIT_CODE

