
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import "@testing-library/jest-dom";

import { server } from "../../__mocks__/server";

// Establish API mocking before all tests.
beforeAll(() => server.listen());

afterEach(() => {
  // Reset any request handlers that we may add during the tests,
  // so they don't affect other tests.
  server.resetHandlers();
  // runs a clean after each test case (e.g. clearing jsdom)
  cleanup();
});

// Clean up after the tests are finished.
afterAll(() => server.close());

// runs a clean after each test case (e.g. clearing jsdom)
// afterEach(() => {
//   cleanup();
// })
