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
      /**
       * Visit with guided UI suppressed: main walkthrough (FlowSelector) + page Joyride tours.
       * Sets localStorage before the app bundle runs so GuidedTourProvider mounts with tours off.
       * @example cy.visitWithTourDisabled('/source/catalog')
       */
      visitWithTourDisabled(url: string): Chainable<void>;
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

Cypress.Commands.add('visitWithTourDisabled', (url: string) => {
  cy.visit(url, {
    onBeforeLoad(win) {
      // Main GuidedTour FlowSelector (basic/advanced) shows when walkthrough is not completed.
      win.localStorage.setItem('dbz-walkthrough-completed', 'true');
      win.localStorage.setItem('dbz-page-tours-disabled', 'true');
    },
  });
});

export {};

