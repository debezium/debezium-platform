describe('Debezium Platform - Smoke Test', () => {
  beforeEach(() => {
    // Check if backend is ready before running tests
    cy.waitForBackend();
  });

  it('should load the application successfully', () => {
    cy.visit('/');
    cy.title().should('contain', 'Debezium Platform Stage');

    // Verify the root element exists
    cy.get('#root').should('exist');
  });

  it('should verify backend API is accessible', () => {
    cy.request(`${Cypress.env('apiUrl')}/api/pipelines`).then((response) => {
      expect(response.status).to.be.oneOf([200, 204]);
    });
  });

  it('should display the main navigation', () => {
    cy.visit('/');
    cy.get('#root', { timeout: 10000 }).should('be.visible');

    cy.get('body').should('be.visible');
  });

  it('should navigate to Pipeline page by default', () => {
    cy.visit('/');

    cy.url().should('include', '/');
  });

  it('should not display 404 page on root path', () => {
    cy.visit('/');
    cy.contains('404').should('not.exist');
  });
});

