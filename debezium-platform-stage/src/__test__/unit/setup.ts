
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import "@testing-library/jest-dom";

// Mock localStorage before importing MSW
const localStorageMock = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null,
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

import { server } from "../../__mocks__/server";

// Mock window.matchMedia 
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});

// Establish API mocking before all tests.
// Configure to suppress warnings for WebSocket connections (they're mocked separately)
beforeAll(() => server.listen({
  onUnhandledRequest: (request, print) => {
    // Suppress warnings for WebSocket connections
    const url = request.url;
    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      return; // Don't warn for WebSocket connections
    }
    
    // For HTTP/HTTPS requests, show the default warning
    print.warning();
  },
}));

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
