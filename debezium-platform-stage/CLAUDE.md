# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Debezium Platform Stage UI is a React + TypeScript single-page application for managing Debezium deployments. It communicates with the [debezium-platform-conductor](https://github.com/debezium/debezium-platform-conductor) backend REST API.

**Tech Stack:**
- React 19 + TypeScript
- Vite (build tool)
- PatternFly (UI component library)
- React Query (data fetching)
- Jotai (state management)
- React Hook Form + Yup (form handling & validation)
- Vitest (unit testing)
- Cypress (E2E testing)
- MSW (API mocking in tests)
- i18next (internationalization)

## Development Commands

```bash
# Install dependencies (Node.js 24.x required)
yarn

# Start dev server (http://localhost:3000)
yarn dev

# Run with custom backend URL
CONDUCTOR_URL=http://platform.debezium.io/ yarn dev

# Production build (outputs to dist/)
yarn build

# Preview production build
yarn preview

# Run unit tests (Vitest)
yarn test

# Generate test coverage report
yarn coverage

# Run linter
yarn lint

# Type check
yarn type-check

# Run E2E tests interactively
yarn e2e

# Run E2E tests in CI mode (headless)
yarn e2e:ci

# Open Cypress test runner (requires dev server running)
yarn cypress:open

# Run all Cypress tests headless
yarn cypress:run
```

## Running with Backend

Start the full development stack (conductor + PostgreSQL):

```bash
# Using Docker
docker compose up -d

# Using Podman
podman compose up -d

# Stop containers
docker compose down  # or podman compose down
```

Backend API runs on port 8080. PostgreSQL runs on port 5432. Stage UI runs on port 3000.

## Architecture

### Directory Structure

```
src/
├── apis/           # API client functions and TypeScript types
├── appLayout/      # App shell (header, sidebar, breadcrumb, notifications)
├── assets/         # Images, icons, static files
├── components/     # Reusable UI components
├── features/       # Feature-specific modules
├── hooks/          # Custom React hooks
├── pages/          # Page components organized by domain:
│   ├── Source/          # Source management pages
│   ├── Destination/     # Destination management pages
│   ├── Pipeline/        # Pipeline management pages
│   ├── Transforms/      # Transform management pages
│   ├── Connection/      # Connection management pages
│   └── Vault/           # Vault management pages
├── stories/        # Storybook stories
├── styles/         # Global styles
├── utils/          # Utility functions and helpers
├── App.tsx         # Root component with context providers
├── AppRoutes.tsx   # Routes wrapper
├── route.tsx       # Route configuration
└── main.tsx        # Application entry point
```

### Routing

Routes are centrally defined in `src/route.tsx`. Each route has:
- `path`: URL path
- `component`: Page component
- `navSection`: Groups routes in navigation
- `label`: Navigation label (omit to exclude from sidebar)
- `icon`: Navigation icon (PatternFly icon)
- `title`: Page title

### Context Providers

The app uses nested context providers in `App.tsx`:
1. **AppContextProvider** (`appLayout/AppContext.tsx`) - Global app state
2. **NotificationProvider** (`appLayout/AppNotificationContext.tsx`) - Toast notifications
3. **GuidedTourProvider** (`components/GuidedTourContext.tsx`) - User onboarding tours

### API Layer

API functions are in `src/apis/apis.tsx`:
- `createPost<T>()` - POST requests for creating resources
- `editPut<T>()` - PUT requests for updating resources
- `fetchData<T>()` - GET requests
- `deleteData()` - DELETE requests
- `fetchDataCall<T>()` - GET with detailed error handling

Backend URL configuration is in `src/config.ts` via `getBackendUrl()`:
1. Checks `window.__ENV__.CONDUCTOR_URL` (runtime injection for Docker)
2. Falls back to `import.meta.env.CONDUCTOR_URL` (build-time from Vite)
3. Defaults to `http://localhost:8080`

Vite proxies `/api` requests to the backend URL (configured in `vite.config.ts`).

### State Management

- **React Query** (`react-query`) for server state caching and data fetching
- **Jotai** for client-side state atoms
- Context API for app-wide state (navigation, notifications)

### Form Handling

Forms use React Hook Form with Yup schema validation. Common pattern:
```tsx
const schema = yup.object().shape({ /* validation rules */ });
const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: yupResolver(schema)
});
```

## Testing

### Unit Tests (Vitest)

- Test files: `*.test.tsx` or `*.test.ts` in `src/`
- Setup files: `vitest.setup.ts` (global), `src/__test__/unit/setup.ts` (test-specific)
- Mocks: `src/__mocks__/` (MSW handlers, component mocks)
- Fixtures: `src/__fixtures__/` (test data)
- Coverage thresholds: 80% for statements, branches, functions, and lines

**Testing utilities** (`src/__test__/test-utils.tsx`):
- Custom render functions with providers
- Query client setup for React Query tests

**MSW (Mock Service Worker)** handles API mocking. Server setup in `src/__mocks__/server.ts`.

**Run single test:**
```bash
yarn test src/components/MyComponent.test.tsx
```

### E2E Tests (Cypress)

- Test files: `cypress/e2e/*.cy.ts`
- Fixtures: `cypress/fixtures/`
- Configuration: `cypress.config.ts`

**Prerequisites:** Backend must be running (conductor + PostgreSQL):
```bash
cd ../debezium-platform-conductor/dev
docker compose up -d
```

Wait 30-60 seconds for services to start, then run tests.

## Code Patterns

### PatternFly Components

Use PatternFly components from `@patternfly/react-core` for consistency:
- `Page`, `PageSection` for layout
- `Card`, `CardBody` for content containers
- `Table` or `@patternfly/react-table` for data tables
- `Form`, `FormGroup` for forms
- `Button`, `Modal`, `Alert`, etc.

Import PatternFly CSS in components:
```tsx
import '@patternfly/react-core/dist/styles/base.css';
```

### Internationalization

Use `react-i18next` for all user-facing text:
```tsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();
return <h1>{t('page.title')}</h1>;
```

Translation files are in `public/locales/`.

### Type Safety

All API responses have TypeScript types in `src/apis/apis.tsx`:
- `Source`, `Destination`, `Pipeline`, `Transform`, `Connection`, `Vault`
- `Payload` types for POST/PUT requests
- `ApiResponse<T>` for API function return types

## Environment Variables

Set in `.env` file:
- `CONDUCTOR_URL` - Backend API URL (default: `http://localhost:8080`)
- `VITE_PORT` - Dev server port (default: `3000`)

For Docker deployments, environment variables are injected at runtime via `inject-env.sh` script.

## Common Tasks

**Add a new page:**
1. Create component in `src/pages/{Domain}/{PageName}.tsx`
2. Add route to `src/route.tsx`
3. Export from `src/pages/{Domain}/index.ts`

**Add a new API endpoint:**
1. Add TypeScript types to `src/apis/apis.tsx` or `src/apis/types.tsx`
2. Create API function using `createPost`, `fetchData`, etc.
3. Use with React Query in components

**Add a new reusable component:**
1. Create in `src/components/{ComponentName}.tsx`
2. Add tests in `src/components/{ComponentName}.test.tsx`
3. Add styles in `src/components/{ComponentName}.css` if needed

**Update test mocks:**
1. Add MSW handlers to `src/__mocks__/handlers.ts`
2. Add fixture data to `src/__fixtures__/`
