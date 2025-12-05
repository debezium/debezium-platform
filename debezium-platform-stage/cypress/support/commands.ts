/// <reference types="cypress" />

// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to wait for API health check
       * @example cy.waitForBackend()
       */
      waitForBackend(): Chainable<void>;
    }
  }
}

// Custom command to check if backend is ready
Cypress.Commands.add('waitForBackend', () => {
  const apiUrl = Cypress.env('apiUrl');
  cy.request({
    url: `${apiUrl}/api/pipelines`,
    timeout: 30000,
    failOnStatusCode: false,
  }).then((response) => {
    // Accept 200 (success) or other non-error status codes
    if (response.status < 200 || response.status >= 500) {
      cy.wait(2000);
      cy.waitForBackend();
    }
  });
});

export {};

