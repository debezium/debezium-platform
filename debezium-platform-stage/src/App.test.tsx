import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import App from "./App";
import { QueryClient, QueryClientProvider } from "react-query";

test("renders the App", () => {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );

  const dbzLogo = screen.getByAltText("Debezium Logo");
  expect(dbzLogo).toBeInTheDocument();
});
