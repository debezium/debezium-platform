# Cypress E2E Testing - Quick Start Guide

This guide will help you quickly set up and run Cypress E2E tests for the Debezium Platform Stage UI.

## 🚀 Quick Start (3 Steps)

### Step 1: Start the Backend

```bash
# Navigate to the conductor directory
cd ../debezium-platform-conductor/dev

# Start PostgreSQL and Conductor API using Docker Compose
docker compose up -d

# Verify services are running
docker compose ps
```

**Expected Output:**
- PostgreSQL on port 5432
- Conductor API on port 8080

Wait ~30-60 seconds for services to fully initialize.

### Step 2: Verify Backend is Ready

```bash
# Check backend API
curl http://localhost:8080/api/pipelines
```

You should see a `200 OK` response with API data.

### Step 3: Run Cypress Tests

```bash
# Navigate back to the stage directory
cd /Users/ishukla/Desktop/Work/debezium-platform/debezium-platform-stage

# Option A: Run tests interactively (RECOMMENDED for first time)
# This will start the dev server AND open Cypress UI
yarn e2e

# Option B: Run tests in headless mode (for CI/CD)
yarn e2e:ci

# Option C: Manual control (advanced)
# Terminal 1: Start dev server
yarn dev

# Terminal 2 (in another terminal): Open Cypress
yarn cypress:open
```

## 📁 What Was Added

### New Files Created

```
debezium-platform-stage/
├── cypress.config.ts              # Cypress configuration
├── cypress/
│   ├── e2e/
│   │   ├── smoke.cy.ts           # Basic smoke tests
│   │   └── navigation.cy.ts      # Navigation tests
│   ├── support/
│   │   ├── commands.ts           # Custom Cypress commands
│   │   └── e2e.ts                # Test setup
│   ├── fixtures/
│   │   └── example.json          # Sample test data
│   ├── tsconfig.json             # TypeScript config for Cypress
│   └── README.md                 # Detailed documentation
├── E2E_TESTING_GUIDE.md          # This file
```

### Updated Files

- **package.json**: Added Cypress dependencies and test scripts
- **.gitignore**: Added Cypress artifacts (videos, screenshots)
- **README.md**: Added E2E testing section

## 🧪 Available Test Scripts

```bash
# Interactive mode - opens Cypress UI
yarn cypress:open

# Headless mode - runs all tests
yarn cypress:run

# Specific browser
yarn cypress:run:chrome
yarn cypress:run:firefox

# Auto-start dev server + tests
yarn e2e         # Interactive
yarn e2e:ci      # Headless (for CI)
```

## 📋 Current Test Coverage

### Smoke Tests (`smoke.cy.ts`)
- ✅ Application loads successfully
- ✅ Backend API is accessible
- ✅ Main navigation displays
- ✅ Default route navigation works
- ✅ No 404 errors on root path

### Navigation Tests (`navigation.cy.ts`)
- ✅ Navigate to Source page
- ✅ Navigate to Transform page
- ✅ Navigate to Destination page
- ✅ Navigate to Connections page
- ✅ Navigate to Vaults page
- ✅ 404 page displays for invalid routes

## 🎯 Custom Commands

### `cy.waitForBackend()`

Waits for the backend API to be ready before running tests.

```typescript
beforeEach(() => {
  cy.waitForBackend();  // Ensures backend is healthy
  cy.visit('/');
});
```

## ⚙️ Configuration

### CORS and Web Security

Cypress is configured to disable web security for local development to avoid CORS issues when the UI (localhost:3000) accesses the backend API (localhost:8080).

This configuration automatically applies the same behavior as running Chrome manually with:

```bash
open -na "Google Chrome" --args --disable-web-security --user-data-dir="/tmp/chrome-dev"
```

The `cypress.config.ts` file handles this for all browsers:
- **Chrome/Edge**: Launches with `--disable-web-security` flag
- **Electron**: Disables `webSecurity` preference  
- **Firefox**: Relaxes strict origin policy
- **Global**: Sets `chromeWebSecurity: false`

**⚠️ Important**: This is only for local development testing. Production environments should have proper CORS headers configured on the backend.

## 🐛 Troubleshooting

### Backend Not Ready

**Problem:** Tests fail with connection errors

**Solution:**
```bash
# Check if services are running
docker compose ps

# Check logs
docker compose logs conductor

# Check if API is responding
curl http://localhost:8080/api/pipelines

# Restart if needed
docker compose restart
```

### Port Conflicts

**Problem:** Port 3000 or 8080 already in use

**Solution:**
```bash
# Check what's using the port
lsof -i :3000
lsof -i :8080

# Kill the process or stop other services
```

### Tests Timing Out

**Problem:** Tests are slow or hanging

**Solution:**
1. Ensure backend is fully initialized (wait longer)
2. Check network requests in Cypress UI (Network tab)
3. Increase timeout in specific tests:
```typescript
cy.get('[data-testid="element"]', { timeout: 10000 })
```

### Cypress Not Opening

**Problem:** `yarn cypress:open` doesn't open UI

**Solution:**
```bash
# Verify Cypress installation
npx cypress verify

# Clear Cypress cache and reinstall
npx cypress cache clear
yarn install --force
```

## 📖 Writing New Tests

### Basic Test Structure

```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    cy.waitForBackend();
    cy.visit('/your-route');
  });

  it('should perform expected behavior', () => {
    // Arrange
    cy.get('[data-testid="button"]').should('exist');
    
    // Act
    cy.get('[data-testid="button"]').click();
    
    // Assert
    cy.url().should('include', '/expected-path');
    cy.contains('Expected Text').should('be.visible');
  });
});
```

### Best Practices

1. **Use data-testid attributes** in components:
```tsx
<button data-testid="create-pipeline-btn">Create</button>
```

2. **Wait for backend** before each test:
```typescript
beforeEach(() => {
  cy.waitForBackend();
});
```

3. **Use explicit assertions**:
```typescript
// Good
cy.get('[data-testid="title"]').should('be.visible');

// Avoid
cy.get('[data-testid="title"]');
```

4. **Test user flows, not implementation**:
```typescript
// Good - tests user behavior
it('should create a new pipeline', () => {
  cy.get('[data-testid="create-btn"]').click();
  cy.get('[data-testid="name-input"]').type('My Pipeline');
  cy.get('[data-testid="submit-btn"]').click();
  cy.contains('Pipeline created').should('be.visible');
});

// Avoid - tests implementation details
it('should call createPipeline API', () => {
  // Testing internal API calls
});
```

## 🔄 CI/CD Integration

Add this to your CI pipeline (e.g., GitHub Actions):

```yaml
- name: Start Backend
  run: |
    cd debezium-platform-conductor/dev
    docker compose up -d
    
- name: Wait for Backend
  run: |
    timeout 60 bash -c 'until curl -f http://localhost:8080/q/health/ready; do sleep 2; done'
    
- name: Run E2E Tests
  run: |
    cd debezium-platform-stage
    yarn install
    yarn e2e:ci
```

## 📚 Additional Resources

- [Cypress Documentation](https://docs.cypress.io/)
- [Cypress Best Practices](https://docs.cypress.io/guides/references/best-practices)
- [Detailed Testing Guide](./cypress/README.md)

## ✅ Next Steps

1. Add more test coverage for critical user flows
2. Add data-testid attributes to key UI elements
3. Create page object models for complex pages
4. Add API mocking for isolated UI testing
5. Integrate with CI/CD pipeline

---

**Need Help?** Check the [detailed documentation](./cypress/README.md) or reach out to the team!

