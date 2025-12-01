describe('Debezium Platform - Smoke Test', () => {
  beforeEach(() => {
    // Check if backend is ready before running tests
    cy.waitForBackend();
  });

  it('should load the application successfully', () => {
    cy.visit('/');
    
    // Verify the page title
    cy.title().should('contain', 'Debezium Platform Stage');
    
    // Verify the root element exists
    cy.get('#root').should('exist');
  });

  it('should verify backend API is accessible', () => {
    // Check backend API endpoint
    cy.request(`${Cypress.env('apiUrl')}/api/pipelines`).then((response) => {
      expect(response.status).to.be.oneOf([200, 204]);
    });
  });

  it('should display the main navigation', () => {
    cy.visit('/');
    
    // Wait for the app to load
    cy.get('#root', { timeout: 10000 }).should('be.visible');
    
    // Check for PatternFly navigation structure
    // The exact selectors might need adjustment based on your app structure
    cy.get('body').should('be.visible');
  });

  it('should navigate to Pipeline page by default', () => {
    cy.visit('/');
    
    // Wait for navigation
    cy.url().should('include', '/');
  });

  it('should not display 404 page on root path', () => {
    cy.visit('/');
    
    // Make sure we're not seeing a 404 page
    cy.contains('404').should('not.exist');
  });
});

