import type { ReactElement, ReactNode } from "react";
import { Suspense } from "react";
import {
  render as rtlRender,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  MemoryRouter,
  type MemoryRouterProps,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "react-query";
import { GuidedTourProvider } from "../../components/GuidedTourContext";

import commonEN from "../../../public/locales/en/common.json";
import pipelineEN from "../../../public/locales/en/pipeline.json";
import sourceEN from "../../../public/locales/en/source.json";
import destinationEN from "../../../public/locales/en/destination.json";
import transformEN from "../../../public/locales/en/transform.json";
import statusMessageEN from "../../../public/locales/en/statusMessage.json";
import vaultEN from "../../../public/locales/en/vault.json";
import connectionEN from "../../../public/locales/en/connection.json";
import tourEN from "../../../public/locales/en/tour.json";

i18n.use(initReactI18next).init({
  lng: "en",
  defaultNS: "common",
  resources: {
    en: {
      common: commonEN,
      pipeline: pipelineEN,
      source: sourceEN,
      destination: destinationEN,
      transform: transformEN,
      statusMessage: statusMessageEN,
      vault: vaultEN,
      connection: connectionEN,
      tour: tourEN,
    },
  },
});

/** Shared client; cleared in `src/__test__/unit/setup.ts` after each test. */
export const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

export type AppRenderOptions = Omit<RenderOptions, "wrapper"> & {
  /**
   * When false, omit MemoryRouter (e.g. full `<App />` already includes BrowserRouter).
   * Default true.
   */
  withMemoryRouter?: boolean;
  /** Passed to MemoryRouter when `withMemoryRouter` is true. Default `['/']`. */
  initialEntries?: MemoryRouterProps["initialEntries"];
  /** Override the default shared QueryClient for a single test. */
  queryClient?: QueryClient;
  /** Wrap the tree in Suspense (mirrors `main.tsx` around `App`). Default false. */
  withSuspense?: boolean;
};

function render(
  ui: ReactElement,
  {
    withMemoryRouter = true,
    initialEntries = ["/"],
    queryClient = testQueryClient,
    withSuspense = false,
    ...renderOptions
  }: AppRenderOptions = {},
): RenderResult {
  const content = withSuspense ? (
    <Suspense fallback={null}>{ui}</Suspense>
  ) : (
    ui
  );

  function RouterShell({ children }: { children: ReactNode }) {
    if (!withMemoryRouter) {
      return <>{children}</>;
    }
    return (
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    );
  }

  function AllProviders({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <RouterShell>
          <GuidedTourProvider>
            <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
          </GuidedTourProvider>
        </RouterShell>
      </QueryClientProvider>
    );
  }

  return rtlRender(content, {
    wrapper: AllProviders,
    ...renderOptions,
  });
}

export { render };
