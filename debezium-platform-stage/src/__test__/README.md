# UI test harness (`debezium-platform-stage`)

## Shared `render`

Use `render` from `src/__test__/unit/test-utils.tsx` for component tests so the tree matches production defaults where it matters:

- `QueryClientProvider` (shared `testQueryClient`, cleared after each test in `unit/setup.ts`)
- `MemoryRouter` with configurable `initialEntries` (default `['/']`)
- `GuidedTourProvider` and `I18nextProvider` (bundled English namespaces used by tests, including `connection` for connection-page strings)

### Options

| Option | Use when |
|--------|----------|
| `withMemoryRouter: false` | Rendering `<App />` (it already wraps `BrowserRouter`). |
| `withSuspense: true` | Same as `main.tsx` around `App` for lazy-loaded subtrees. |
| `initialEntries: ['/some/path']` | Components that read location (e.g. breadcrumbs). |
| `queryClient: new QueryClient(...)` | Rare: isolate cache behavior from the shared client. |

Import `screen`, `fireEvent`, `waitFor`, etc. from `@testing-library/react` as usual.

## Mocking data: React Query vs MSW

**Mock `useQuery` / `useMutation` (and related hooks)** when you only care about **UI states** (loading, empty, error) and want **minimal moving parts**. Example: `src/pages/Pipeline/Pipelines.test.tsx` mocks `useQuery` and asserts table and filters.

**Use MSW** when you want the component under test to run **real fetch / client code** and only replace the network. Better for **integration-style** coverage of hooks wired to `axios` or shared API helpers. Examples: `PipelineOverview.test.tsx`, `PipelineLog.test.tsx` (with per-test `server.use(...)` overrides).

You can combine approaches (e.g. MSW for HTTP and local `vi.mock` for a heavy child), but prefer **one primary strategy per file** so failures are easier to reason about.

## Global test setup

`vitest.setup.ts` installs a minimal `WebSocket` before MSW loads. `src/__test__/unit/setup.ts` registers MSW, RTL `cleanup`, and `testQueryClient.clear()`. Some MSW WebSocket passthrough paths may still log errors in `PipelineLog` tests without failing the run; tightening that is separate from this harness.

## CI

The stage GitHub workflow runs `yarn coverage` (tests plus coverage) after `yarn build`, uploads the `coverage/` directory as the `stage-coverage` artifact (HTML, JSON, lcov), and enforces baseline thresholds from `vite.config.ts` (ratchet over time).
