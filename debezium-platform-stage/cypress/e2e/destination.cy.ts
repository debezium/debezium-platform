describe('Destination Management', () => {
  beforeEach(() => {
    cy.waitForBackend();
    cy.visit('/destination');
  });

  describe('Destination Catalog', () => {
    it('should display the destination catalog page', () => {
      cy.visit('/destination/catalog');
      cy.url().should('include', '/destination/catalog');
      // TODO: Add assertions for catalog grid/cards
    });

    it('should display available destination connectors', () => {
      cy.visit('/destination/catalog');
      // TODO: Verify destination connector types are displayed
      // Examples: Kafka, PostgreSQL, Elasticsearch, etc.
    });

    it('should filter destinations by type or category', () => {
      cy.visit('/destination/catalog');
      // TODO: Use filter/search functionality
      // TODO: Verify filtered results
    });
  });

  describe('Create Destination', () => {
    it('should navigate to create destination page from catalog', () => {
      cy.visit('/destination/catalog');
      // TODO: Click on a destination type card
      // TODO: Verify navigation to create destination form
    });

    it('should display create destination form', () => {
      cy.visit('/destination/create_destination');
      // TODO: Verify form fields are displayed
      // - Name field
      // - Description field
      // - Connection details
      // - Configuration options
    });

    it('should validate required fields', () => {
      cy.visit('/destination/create_destination');
      // TODO: Try to submit empty form
      // TODO: Verify validation error messages
    });

    it('should test connection before creating', () => {
      // TODO: Fill in connection details
      // TODO: Click "Test Connection" button
      // TODO: Verify connection test result
    });

    it('should successfully create a new destination', () => {
      // TODO: Fill in the destination form with valid data
      // TODO: Submit the form
      // TODO: Verify success message
      // TODO: Verify redirect to destination list or details page
    });

    it('should handle API errors gracefully', () => {
      // TODO: Mock API error response
      // TODO: Fill in form and submit
      // TODO: Verify error message is displayed
    });

    it('should support different destination types', () => {
      // TODO: Test creating destinations of different types
      // - Message queue (Kafka)
      // - Database
      // - Cloud storage
    });
  });

  describe('Destination List', () => {
    it('should display list of destinations', () => {
      cy.visit('/destination');
      // TODO: Verify destinations are displayed in a table or grid
    });

    it('should show destination status', () => {
      // TODO: Verify status indicators (running, stopped, error)
    });

    it('should allow searching/filtering destinations', () => {
      // TODO: Use search/filter functionality
      // TODO: Verify filtered results
    });

    it('should navigate to destination details on click', () => {
      // TODO: Click on a destination item
      // TODO: Verify navigation to details page
    });
  });

  describe('Edit Destination', () => {
    it('should display edit destination form', () => {
      // TODO: Navigate to existing destination
      // TODO: Click edit button
      // TODO: Verify form is pre-populated with existing data
    });

    it('should successfully update destination', () => {
      // TODO: Modify destination fields
      // TODO: Submit the form
      // TODO: Verify success message
      // TODO: Verify changes are saved
    });

    it('should re-test connection after editing', () => {
      // TODO: Edit connection details
      // TODO: Click "Test Connection" button
      // TODO: Verify new connection test result
    });
  });

  describe('Delete Destination', () => {
    it('should show confirmation dialog before deleting', () => {
      // TODO: Click delete button
      // TODO: Verify confirmation modal appears
    });

    it('should warn if destination is used in pipelines', () => {
      // TODO: Try to delete destination that's in use
      // TODO: Verify warning message
    });

    it('should successfully delete destination', () => {
      // TODO: Click delete and confirm
      // TODO: Verify success message
      // TODO: Verify destination is removed from list
    });
  });
});

/**
 * Regression: form save must send type, schema, and vaults from the GET response.
 * Backend DestinationRequest requires type and schema (@NotEmpty); omitting them broke edit.
 * Isolated from the main suite so we do not pre-visit the destination list.
 */
describe('Destination edit PUT payload (regression)', () => {
  beforeEach(() => {
    cy.waitForBackend();
  });

  it('should send type, schema, and vaults on destination edit (form editor)', () => {
    const destinationId = 424242;
    const mockDestination = {
      id: destinationId,
      name: 'e2e-mock-destination',
      description: 'e2e description',
      type: 'kafka',
      schema: 'e2e.test.schema.required',
      vaults: [{ id: 7, name: 'e2e-vault' }],
      connection: { id: 99, name: 'e2e-mock-connection' },
      config: {
        'bootstrap.servers': 'localhost:9092',
      },
    };

    cy.intercept('GET', `**/api/destinations/${destinationId}`, {
      statusCode: 200,
      body: mockDestination,
    }).as('getDestinationForEdit');

    cy.intercept('PUT', `**/api/destinations/${destinationId}`, (req) => {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      expect(body, 'PUT must include backend-required immutable fields').to.include.keys(
        'type',
        'schema',
        'vaults',
        'name',
        'config'
      );
      expect(body.type).to.eq(mockDestination.type);
      expect(body.schema).to.eq(mockDestination.schema);
      expect(body.vaults).to.deep.eq(mockDestination.vaults);
      req.reply({
        statusCode: 200,
        body: {
          ...mockDestination,
          name: body.name,
          description: body.description,
          config: body.config,
          connection: body.connection,
        },
      });
    }).as('putDestinationEdit');

    cy.visit(`/destination/${destinationId}`);
    cy.wait('@getDestinationForEdit');

    cy.get('#destination-name').should('have.value', mockDestination.name);
    cy.get('#destination-description').clear().type(' updated');

    cy.contains('button', 'Save changes').click();
    cy.contains('button', 'Confirm').click();

    cy.wait('@putDestinationEdit');
    cy.contains('edited successfully', { matchCase: false }).should('be.visible');
  });
});

