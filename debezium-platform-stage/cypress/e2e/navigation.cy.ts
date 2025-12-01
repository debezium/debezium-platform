describe('Debezium Platform - Navigation', () => {
  beforeEach(() => {
    // Check if backend is ready before running tests
    cy.waitForBackend();
    cy.visit('/');
  });

  it('should navigate to different sections', () => {
    // Test navigation to Source page
    cy.visit('/source');
    cy.url().should('include', '/source');
    cy.title().should('contain', 'Source');

    // Test navigation to Transform page
    cy.visit('/transform');
    cy.url().should('include', '/transform');
    cy.title().should('contain', 'Transform');

    // Test navigation to Destination page
    cy.visit('/destination');
    cy.url().should('include', '/destination');
    cy.title().should('contain', 'Destination');

    // Test navigation to Connections page
    cy.visit('/connections');
    cy.url().should('include', '/connections');
    cy.title().should('contain', 'Connections');

    // Test navigation to Vaults page
    cy.visit('/vaults');
    cy.url().should('include', '/vaults');
    cy.title().should('contain', 'Vaults');
  });

  it('should display 404 page for invalid routes', () => {
    cy.visit('/invalid-route-that-does-not-exist');
    cy.url().should('include', '/invalid-route-that-does-not-exist');
    // Check if 404 content is displayed
    cy.contains('404').should('exist');
  });

  it('should navigate to Pipeline page', () => {
    cy.visit('/pipeline');
    cy.url().should('include', '/pipeline');
    cy.title().should('contain', 'Pipeline');
  });
});

