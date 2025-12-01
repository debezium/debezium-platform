# Cypress E2E Testing

This directory contains end-to-end tests for the Debezium Platform Stage UI using Cypress.

## Prerequisites

Before running the tests, ensure you have:

1. **Backend Running**: The Conductor backend must be running
2. **UI Application**: The Vite dev server must be running on port 3000

## Running Tests

### Step 1: Start the Backend

From the `debezium-platform-conductor/dev` directory:

```bash
cd ../debezium-platform-conductor/dev
docker compose up -d
```

This will start:
- PostgreSQL database on port 5432
- Conductor API on port 8080

Wait for the services to be fully ready (usually takes 30-60 seconds).

### Step 2: Install Dependencies (First Time Only)

From the `debezium-platform-stage` directory:

```bash
yarn install
```

### Step 3: Run the Tests

#### Option A: Interactive Mode (Recommended for Development)

Open Cypress Test Runner with the UI dev server:

```bash
yarn e2e
```

This command will:
1. Start the Vite dev server on port 3000
2. Open the Cypress Test Runner UI
3. Allow you to select and run tests interactively

#### Option B: Run Cypress Test Runner Manually

If you already have the dev server running:

```bash
# Terminal 1: Start dev server
yarn dev

# Terminal 2: Open Cypress
yarn cypress:open
```

#### Option C: Headless Mode (For CI/CD)

Run all tests in headless mode:

```bash
# With automatic dev server start
yarn e2e:ci

# Or manually with dev server already running
yarn cypress:run
```

#### Option D: Specific Browser

Run tests in a specific browser:

```bash
yarn cypress:run:chrome   # Chrome browser
yarn cypress:run:firefox  # Firefox browser
```

## Test Structure

```
cypress/
├── e2e/                    # Test files
│   ├── smoke.cy.ts        # Basic smoke tests
│   └── navigation.cy.ts   # Navigation tests
├── fixtures/              # Test data
├── support/               # Custom commands and configuration
│   ├── commands.ts        # Custom Cypress commands
│   └── e2e.ts            # Test setup and configuration
├── tsconfig.json          # TypeScript configuration
└── README.md             # This file
```

## Writing Tests

### Basic Test Structure

```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    cy.waitForBackend();  // Ensure backend is ready
    cy.visit('/');
  });

  it('should do something', () => {
    cy.get('[data-testid="element"]').should('be.visible');
    cy.contains('Expected Text').click();
    cy.url().should('include', '/expected-path');
  });
});
```

### Custom Commands

We have custom commands available:

- `cy.waitForBackend()` - Waits for the backend API to be ready

## Configuration

### CORS and Web Security

For local development, Cypress is configured to disable web security to avoid CORS issues when accessing the backend API. This is configured in `cypress.config.ts`:

- **Chrome/Edge**: Launches with `--disable-web-security` flag
- **Electron**: Disables `webSecurity` preference
- **Firefox**: Disables strict origin policy
- Global setting: `chromeWebSecurity: false`

**Note**: This is only for local development testing. In production environments, proper CORS configuration should be set on the backend.

### Environment Variables

Environment variables can be accessed via `Cypress.env()`:

- `apiUrl` - Backend API URL (default: http://localhost:8080)

## Debugging

- Use `.only` to run a single test: `it.only('should...')`
- Use `.skip` to skip a test: `it.skip('should...')`
- Use `cy.pause()` to pause test execution in interactive mode
- Screenshots are automatically taken on test failures

## Troubleshooting

### Backend not ready

If tests fail with connection errors:
1. Ensure Docker Compose is running: `docker compose ps`
2. Check backend API: `curl http://localhost:8080/api/pipelines`
3. Check logs: `docker compose logs conductor`

### Port conflicts

If port 3000 or 8080 is already in use:
- Stop other services using those ports
- Or modify the ports in compose.yml and vite.config.ts

### Tests timing out

If tests are slow or timing out:
- Increase timeout in test: `cy.get('[data-testid="element"]', { timeout: 10000 })`
- Check network tab in Cypress Test Runner for slow API calls
- Ensure backend database has started properly

