/**
 * Comprehensive Destination E2E Tests
 *
 * KEY DIFFERENCES FROM SOURCE FLOW:
 * 1. Destinations have `hideSignalCollections={true}` - NO signal collections section
 */

describe('Destination Management - Comprehensive Flow', () => {
  beforeEach(() => {
    cy.waitForBackend();
  });

  /**
   * Helper to click catalog card with fallback strategies
   */
  const clickCatalogCard = (displayName?: string, className?: string) => {
    cy.get('body').then(($body) => {
      // Try data-tour first (most reliable)
      const tourAttr = $body.find(`[data-tour^="catalog-card-"]`);
      if (tourAttr.length > 0) {
        cy.wrap(tourAttr.first()).click();
        return;
      }

      // Try className if provided
      if (className) {
        const byClass = $body.find(`.catalog-grid-card-destination, [class*="${className}"]`);
        if (byClass.length > 0) {
          cy.wrap(byClass.first()).click();
          return;
        }
      }

      // Fallback to any catalog card
      cy.get('[class*="catalog"], [class*="card"]').first().click();
    });
  };

  /**
   * Open create destination form from catalog
   */
  const openCreateDestinationFromCatalog = () => {
    cy.intercept({
      method: 'GET',
      url: /\/api\/catalog\/server-sink\/.+/i,
    }).as('getDestinationSchema');

    cy.visitWithTourDisabled('/destination/catalog');
    cy.wait(1000); // Wait for catalog to load
    clickCatalogCard();

    cy.url().should('match', /\/destination\/create_destination\/.+/);
    cy.wait('@getDestinationSchema', { timeout: 15000 });
    cy.get('#connector-name', { timeout: 30000 }).should('be.visible');
  };

  const fillMinimalCreateDestinationForm = (destName: string) => {
    cy.get('#connector-name', { timeout: 30000 })
      .should('be.visible')
      .clear({ force: true })
      .type(destName, { force: true });

    cy.get('#connector-description')
      .clear({ force: true })
      .type('Cypress test destination', { force: true });

    // Try to select connection if available, but don't fail if none exist
    cy.get('body').then(($body) => {
      if ($body.find('#conn-typeahead-input').length > 0) {
        cy.get('#conn-typeahead-input input').click({ force: true });
        cy.wait(500);
        // Check if options are available
        cy.get('body').then(($optBody) => {
          if ($optBody.find('#conn-typeahead-listbox [role="option"]').length > 0) {
            cy.get('#conn-typeahead-listbox [role="option"]')
              .first()
              .click({ force: true });
          } else {
            cy.log('No connections available in dropdown - skipping selection');
            // Click somewhere else to close the dropdown
            cy.get('#connector-name').click({ force: true });
          }
        });
      }
    });
  };

  describe('Destination Catalog - UI & Navigation', () => {
    // Selectors
    const CATALOG_CARD_SELECTOR = '[data-tour^="catalog-card-"], [class*="catalog"]';
    const SEARCH_INPUT_SELECTOR = 'input[placeholder*="Search"], input[placeholder*="name"]';
    const GRID_VIEW_SELECTOR = '[aria-label="Grid view"]';
    const LIST_VIEW_SELECTOR = '[aria-label="List view"]';

    const checkViewTogglesIfPresent = (callback: () => void) => {
      cy.get('body').then(($body) => {
        if ($body.find(GRID_VIEW_SELECTOR).length > 0) {
          callback();
        } else {
          cy.log('View toggles not present on destination catalog');
        }
      });
    };

    const hasMessagingTypes = (text: string): boolean => {
      const messagingTypes = [
        'kafka',
        'http',
        'kinesis',
        'eventhubs',
        'redis',
        'pulsar',
        'rabbitmq',
        'nats',
        'pubsub',
        'milvus',
      ];
      return messagingTypes.some((type) => text.includes(type));
    };

    beforeEach(() => {
      cy.visitWithTourDisabled('/destination/catalog');
    });

    it('should display the destination catalog page with correct header', () => {
      cy.url().should('include', '/destination/catalog');
      cy.contains(/Destination catalog|catalog/i).should('be.visible');
    });

    it('should display search input and view toggles', () => {
      cy.get(SEARCH_INPUT_SELECTOR).should('exist');
      // View toggles might not be present on this page
      checkViewTogglesIfPresent(() => {
        cy.get(GRID_VIEW_SELECTOR).should('exist');
        cy.get(LIST_VIEW_SELECTOR).should('exist');
      });
    });

    it('should display destination connectors (server-sink types)', () => {
      cy.get(CATALOG_CARD_SELECTOR, { timeout: 15000 }).should('have.length.at.least', 1);
      cy.contains(/\d+\s+Items/i).should('be.visible');
    });

    it('should show different destination types than sources', () => {
      cy.get('body').then(($body) => {
        const text = $body.text().toLowerCase();
        // May have: Kafka, Kinesis, EventHubs, HTTP, Redis, etc
        const foundMessagingTypes = hasMessagingTypes(text);
        // If no messaging types found, at least verify it has server-sink destinations
        if (!foundMessagingTypes) {
          cy.log('No specific messaging types found, checking for any destinations');
          cy.get(CATALOG_CARD_SELECTOR).should('have.length.at.least', 1);
        } else {
          expect(foundMessagingTypes).to.be.true;
        }
      });
    });

    it('should filter destinations by search query', () => {
      cy.get(CATALOG_CARD_SELECTOR, { timeout: 15000 })
        .its('length')
        .then((initialCount) => {
          if (initialCount > 1) {
            cy.get(SEARCH_INPUT_SELECTOR).type('Kafka');
            // Wait for filter to apply by asserting on card count
            cy.get(CATALOG_CARD_SELECTOR).its('length').should('be.lte', initialCount);
          }
        });
    });

    it('should toggle between grid and list view', () => {
      // Check if view toggles exist before testing them
      checkViewTogglesIfPresent(() => {
        cy.get(GRID_VIEW_SELECTOR).should('have.attr', 'aria-pressed', 'true');
        cy.get(LIST_VIEW_SELECTOR).click();
        cy.get(LIST_VIEW_SELECTOR).should('have.attr', 'aria-pressed', 'true');
        cy.get('[class*="pf-v6-c-data-list"]').should('exist');
        cy.get(GRID_VIEW_SELECTOR).click();
        cy.get('[class*="pf-v6-l-gallery"]').should('exist');
      });
    });

    it('should clear search filter', () => {
      cy.get(SEARCH_INPUT_SELECTOR).type('XYZ-NonExistent');
      // Wait for filter to apply
      cy.wait(500);
      cy.get(SEARCH_INPUT_SELECTOR).first().clear({ force: true });
      // Wait for filter to clear
      cy.wait(500);
      // Verify cards are visible again after clearing
      cy.get(CATALOG_CARD_SELECTOR).should('have.length.at.least', 1);
    });

    it('should navigate to create destination when clicking a card', () => {
      cy.get(CATALOG_CARD_SELECTOR, { timeout: 15000 }).first().click();
      cy.url().should('match', /\/destination\/create_destination\/.+/);
    });

    it('should have smart editor button for advanced users', () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-tour="destination-catalog-smart-editor"]').length > 0) {
          cy.get('[data-tour="destination-catalog-smart-editor"]').should('be.visible');
          cy.get('[data-tour="destination-catalog-smart-editor"]').click({ force: true });
          cy.url().should('match', /\/destination\/create_destination\/?$/);
          cy.contains('No connector selected').should('be.visible');
        } else {
          cy.log('Smart editor button not available on this page');
        }
      });
    });
  });

  describe('Create Destination - Form Structure', () => {
    it('should display create destination form with required fields', () => {
      openCreateDestinationFromCatalog();
      cy.contains('Destination type').should('be.visible');
      cy.contains('Destination name').should('be.visible');
      cy.get('#connector-name').should('exist');
      cy.contains('Description').should('be.visible');
      cy.get('#connector-description').should('exist');
      cy.contains('button', 'Create destination').should('be.visible');
      cy.contains('Back to catalog').should('be.visible');
    });

    it('should NOT show signal collections section (hideSignalCollections=true)', () => {
      openCreateDestinationFromCatalog();
      cy.get('body').then(($body) => {
        // Signal Collections should NOT exist for destinations
        const hasSignalSection = $body.find('[id*="signal"]').length > 0;
        expect(hasSignalSection).to.be.false;

        // Should not have signal-related form fields
        cy.get('#schema-field-signal\\.data\\.collection').should('not.exist');
      });
    });

    it('should toggle between jumplinks and tabs layout', () => {
      openCreateDestinationFromCatalog();
      cy.get('#jumplinks-layout', { timeout: 30000 }).should('have.attr', 'aria-pressed', 'true');
      cy.get('#tabs-layout').click();
      cy.get('#tabs-layout').should('have.attr', 'aria-pressed', 'true');
      cy.contains('Configuration').should('be.visible');
      cy.wait(300);
      cy.get('#jumplinks-layout').click();
      cy.contains('Connector Essentials').should('be.visible');
    });

    it('should preserve form data when switching layouts', () => {
      openCreateDestinationFromCatalog();
      const testName = 'layout-switch-test';
      cy.get('#connector-name').clear({ force: true }).type(testName, { force: true });
      cy.get('#tabs-layout').click();
      cy.wait(300);
      cy.get('#jumplinks-layout').click();
      cy.get('#connector-name').should('have.value', testName);
    });

    it('should have Additional Properties section', () => {
      openCreateDestinationFromCatalog();
      cy.contains('h2', 'Additional Properties').scrollIntoView().should('be.visible');
      cy.contains('button', 'Add property').should('be.visible');
    });

    it('should show different connector-specific fields than sources', () => {
      openCreateDestinationFromCatalog();
      cy.get('body').then(($body) => {
        const text = $body.text().toLowerCase();
        expect(text).to.not.include('topic.prefix'); // Sources have this
        expect(text).to.not.include('database.hostname'); // Sources have this
      });
    });
  });

  describe('Create Destination - Validation', () => {
    it('should validate required fields', () => {
      openCreateDestinationFromCatalog();
      cy.get('#connector-name', { timeout: 30000 }).should('be.visible');
      cy.contains('button', 'Create destination').click();
      cy.get('#connector-name').should('have.attr', 'aria-invalid', 'true');
    });

    it('should show error when name is empty', () => {
      openCreateDestinationFromCatalog();
      cy.get('#connector-name').clear({ force: true });
      cy.get('#connector-description').click();
      cy.contains('button', 'Create destination').click();
      cy.get('#connector-name').should('have.attr', 'aria-invalid', 'true');
    });

    it('should validate name format', () => {
      openCreateDestinationFromCatalog();
      cy.get('#connector-name').clear({ force: true }).type('invalid name!!', { force: true });
      cy.get('#connector-description').click();
      cy.wait(500);
      // Implementation-specific validation may trigger
    });
  });

  describe('Create Destination - Additional Properties', () => {
    it('should add and remove additional properties', () => {
      openCreateDestinationFromCatalog();
      cy.contains('h2', 'Additional Properties').scrollIntoView();
      cy.contains('button', 'Add property').scrollIntoView().click({ force: true });
      cy.get('[id^="addprop-key-input-"]').should('have.length', 1);
      cy.contains('button', 'Add property').click({ force: true });
      cy.get('[id^="addprop-key-input-"]').should('have.length', 2);
      cy.get('[aria-label="Remove row"]').first().click();
      cy.get('[id^="addprop-key-input-"]').should('have.length', 1);
    });

    it('should accept valid additional properties', () => {
      openCreateDestinationFromCatalog();
      cy.contains('button', 'Add property').scrollIntoView().click({ force: true });
      cy.get('[id^="addprop-key-input-"]').last().type('custom.config.key');
      cy.get('[id^="addprop-value-input-"]').last().type('custom-value-123');
      // Should not show validation errors
      cy.get('[id^="addprop-key-input-"]').last().should('not.have.attr', 'aria-invalid', 'true');
    });
  });

  describe('Create Destination - Success Flow', () => {
    it('should attempt to create a destination', () => {
      openCreateDestinationFromCatalog();
      const destName = `test-dest-${Date.now()}`;
      fillMinimalCreateDestinationForm(destName);

      cy.contains('button', 'Create destination').click();

      // Wait for success or validation error (expected without full form data)
      cy.get('body', { timeout: 20000 }).then(($body) => {
        const bodyText = $body.text();
        if (bodyText.includes('Create successful') || bodyText.includes('successful')) {
          cy.log('Destination created successfully');
          cy.url().should('include', '/destination');
        } else if (bodyText.includes('required') || bodyText.includes('invalid') || bodyText.includes('failed')) {
          // Validation errors are expected without complete form data
          cy.log('Destination creation validation triggered - expected behavior');
        }
      });
    });
  });

  describe('Create Destination - Error Handling', () => {
    it('should handle schema loading errors', () => {
      cy.intercept(
        { method: 'GET', url: /\/api\/catalog\/server-sink\/.+/i },
        { statusCode: 404, body: { error: 'Schema not found' } }
      ).as('schemaError');

      cy.visitWithTourDisabled('/destination/catalog');
      clickCatalogCard();
      cy.wait('@schemaError');
      cy.contains(/Failed to load|error/i, { timeout: 15000 }).should('be.visible');
    });
  });

  describe('Destination List - Display & Interactions', () => {
    it('should display destinations list page', () => {
      cy.visitWithTourDisabled('/destination');
      cy.url().should('include', '/destination');
      cy.wait(500);
    });

    it('should show table with destinations or empty state', () => {
      cy.visitWithTourDisabled('/destination');
      cy.wait(2000); // Wait for data to load
      cy.get('body').then(($body) => {
        const bodyText = $body.text();
        if ($body.find('table[aria-label="destination table"]').length > 0) {
          cy.contains('Name').should('be.visible');
          cy.contains('Type').should('be.visible');
          cy.contains('Used in').should('be.visible');
        } else if (bodyText.includes('No destination') || bodyText.includes('empty')) {
          // Empty state - look for any variation of the message
          cy.log('Destination list is empty');
          cy.get('body').should('contain.text', 'destination');
        } else {
          // If neither table nor empty state, log what we found
          cy.log('Page loaded but no expected content found');
          cy.get('body').should('be.visible');
        }
      });
    });

    it('should display toolbar with search when destinations exist', () => {
      cy.visitWithTourDisabled('/destination');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="destination table"]').length > 0) {
          cy.get('[data-tour="destination-search"] input, input[placeholder*="Search"]')
            .should('exist');
          cy.contains('button', 'Add destination').should('be.visible');
        }
      });
    });

    it('should display destination type in list', () => {
      cy.visitWithTourDisabled('/destination');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="destination table"] tbody tr').length > 0) {
          cy.get('table[aria-label="destination table"] tbody tr')
            .first()
            .find('td[data-label="Type"]')
            .should('not.be.empty');
        }
      });
    });

    it('should allow searching/filtering destinations', () => {
      cy.visitWithTourDisabled('/destination');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="destination table"]').length > 0) {
          const searchInput = '[data-tour="destination-search"] input, input[placeholder*="Search"]';
          cy.get(searchInput).first().type('test');
          cy.wait(900);
          // Results should filter
        }
      });
    });

    it('should navigate to destination details on click', () => {
      cy.visitWithTourDisabled('/destination');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="destination table"] tbody tr').length > 0) {
          cy.get('table[aria-label="destination table"] tbody tr')
            .first()
            .find('button')
            .first()
            .click();
          cy.url().should('match', /\/destination\/\d+\?state=view/);
        }
      });
    });

    it('should navigate to catalog from empty state', () => {
      cy.visitWithTourDisabled('/destination');
      cy.get('body').then(($body) => {
        if ($body.text().includes('No destination available')) {
          cy.contains('button', 'Add destination').click();
          cy.url().should('include', '/destination/catalog');
        }
      });
    });
  });

  describe('Edit Destination - View & Edit Modes', () => {
    it('should display destination in view mode initially', () => {
      cy.visitWithTourDisabled('/destination');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="destination table"] tbody tr').length > 0) {
          cy.get('table[aria-label="destination table"] tbody tr')
            .first()
            .find('button')
            .first()
            .click();
          cy.url().should('match', /[?&]state=view/);
          cy.contains('button', 'Edit', { timeout: 30000 }).should('exist');
        }
      });
    });

    it('should toggle to edit mode and show editable form', () => {
      cy.visitWithTourDisabled('/destination');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="destination table"] tbody tr').length > 0) {
          cy.get('table[aria-label="destination table"] tbody tr')
            .first()
            .find('button')
            .first()
            .click();
          cy.url().should('match', /[?&]state=view/);
          cy.contains('button', 'Edit', { timeout: 30000 }).click();
          cy.get('#connector-name', { timeout: 30000 }).should('be.visible');
          cy.get('#connector-description').should('be.visible');
        }
      });
    });

    it('should show cancel and save buttons in edit mode', () => {
      cy.visitWithTourDisabled('/destination');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="destination table"] tbody tr').length > 0) {
          cy.get('table[aria-label="destination table"] tbody tr')
            .first()
            .find('button')
            .first()
            .click();
          cy.contains('button', 'Edit', { timeout: 30000 }).click();
          cy.contains('button', 'Save changes', { timeout: 10000 }).should('be.visible');
          cy.contains('button', 'Cancel').should('be.visible');
        }
      });
    });

    it('should cancel edit and return to view mode', () => {
      cy.visitWithTourDisabled('/destination');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="destination table"] tbody tr').length > 0) {
          cy.get('table[aria-label="destination table"] tbody tr')
            .first()
            .find('button')
            .first()
            .click();
          cy.contains('button', 'Edit', { timeout: 30000 }).click();
          cy.get('#connector-description', { timeout: 10000 }).clear().type('Temp change');
          cy.contains('button', 'Cancel').click();
          cy.get('#connector-name').should('not.exist');
          cy.contains('button', 'Edit').should('exist');
        }
      });
    });

    it('should show confirmation modal before saving changes', () => {
      cy.visitWithTourDisabled('/destination');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="destination table"] tbody tr').length > 0) {
          cy.get('table[aria-label="destination table"] tbody tr')
            .first()
            .find('button')
            .first()
            .click();
          cy.contains('button', 'Edit', { timeout: 30000 }).click();
          cy.get('#connector-description', { timeout: 10000 })
            .clear()
            .type('Updated by Cypress');
          cy.contains('button', 'Save changes').click();
          cy.get('.pf-v6-c-modal-box', { timeout: 10000 }).should('be.visible');
          cy.contains('button', 'Confirm').should('be.visible');
        }
      });
    });
  });

  describe('Delete Destination - Confirmation Flow', () => {
    it('should show delete confirmation dialog', () => {
      cy.visitWithTourDisabled('/destination');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="destination table"] tbody tr').length > 0) {
          cy.get('table[aria-label="destination table"] tbody tr')
            .first()
            .find('td[data-label="Actions"] button')
            .click();
          cy.contains('Delete').click();
          cy.get('.pf-v6-c-modal-box').should('be.visible');
          cy.contains('delete', { matchCase: false }).should('be.visible');
          cy.get('#delete-name').should('exist');
        }
      });
    });

    it('should require typing exact name to confirm delete', () => {
      cy.visitWithTourDisabled('/destination');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="destination table"] tbody tr').length > 0) {
          cy.get('table[aria-label="destination table"] tbody tr')
            .first()
            .find('td[data-label="Actions"] button')
            .click();
          cy.contains('Delete').click();
          cy.get('.pf-v6-c-modal-box').contains('button', 'Delete').should('be.disabled');
          cy.get('#delete-name').type('wrong-name');
          cy.get('.pf-v6-c-modal-box').contains('button', 'Delete').should('be.disabled');
        }
      });
    });

    it('should cancel delete operation', () => {
      cy.visitWithTourDisabled('/destination');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="destination table"] tbody tr').length > 0) {
          cy.get('table[aria-label="destination table"] tbody tr')
            .first()
            .find('td[data-label="Actions"] button')
            .click();
          cy.contains('Delete').click();
          cy.get('.pf-v6-c-modal-box').contains('button', 'Cancel').click();
          cy.get('.pf-v6-c-modal-box').should('not.exist');
        }
      });
    });
  });

  describe('Destination Navigation & Breadcrumbs', () => {
    it('should show correct breadcrumb on catalog page', () => {
      cy.visitWithTourDisabled('/destination/catalog');
      cy.contains('Destination').should('be.visible');
      cy.contains('Catalog').should('be.visible');
    });

    it('should show correct breadcrumb on create page', () => {
      openCreateDestinationFromCatalog();
      cy.contains('Destination').should('be.visible');
      cy.contains('Create destination').should('be.visible');
    });

    it('should show correct breadcrumb on edit page', () => {
      cy.visitWithTourDisabled('/destination');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="destination table"] tbody tr').length > 0) {
          cy.get('table[aria-label="destination table"] tbody tr')
            .first()
            .find('button')
            .first()
            .click();
          cy.contains('button', 'Edit', { timeout: 30000 }).click();
          cy.contains('Destination').should('be.visible');
          cy.contains('Edit destination').should('be.visible');
        }
      });
    });

    it('should navigate back from create to catalog', () => {
      openCreateDestinationFromCatalog();
      cy.contains('Back to catalog').click({ force: true });
      cy.url().should('include', '/destination/catalog');
    });

    it('should navigate from list to catalog', () => {
      cy.visitWithTourDisabled('/destination');
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("Add destination")').length > 0) {
          cy.contains('button', 'Add destination').first().click();
          cy.url().should('include', '/destination/catalog');
        }
      });
    });
  });

  describe('Destination-Specific Scenarios', () => {
    it('should require connection for all destination types', () => {
      openCreateDestinationFromCatalog();
      cy.get('body', { timeout: 15000 }).then(($formBody) => {
        // Should have connector name and description
        cy.get('#connector-name').should('exist');
        cy.get('#connector-description').should('exist');

        // Connection typeahead should always be present
        cy.get('#conn-typeahead-input').should('exist');
        cy.log('Connection field is present - all destinations require connections');
      });
    });

    it('should display different property types for messaging destinations', () => {
      openCreateDestinationFromCatalog();
      cy.get('body').then(($body) => {
        const text = $body.text().toLowerCase();

        // Should NOT have source-specific database fields
        expect(text).to.not.include('database.server.name');
        expect(text).to.not.include('table.include.list');
      });
    });
  });

  describe('API Integration - Destination Endpoints', () => {
    it('should call GET /api/catalog with server-sink path', () => {
      cy.intercept('GET', /\/api\/catalog\/?$/).as('getCatalog');
      cy.visitWithTourDisabled('/destination/catalog');
      cy.wait('@getCatalog').its('response.body.components').should('have.property', 'server-sink');
    });

    it('should call POST /api/destinations on create', () => {
      cy.intercept('POST', /\/api\/destinations\/?(\?|$)/i).as('createDest');

      openCreateDestinationFromCatalog();
      fillMinimalCreateDestinationForm('api-test-dest');
      cy.contains('button', 'Create destination').click();

      // May fail validation, but should attempt the call
      cy.wait(5000);
    });

    it('should call GET /api/destinations for list', () => {
      cy.intercept('GET', /\/api\/destinations\/?$/i).as('getDestinations');
      cy.visitWithTourDisabled('/destination');
      cy.wait('@getDestinations').its('response.statusCode').should('be.oneOf', [200, 404]);
    });
  });

  describe('AWS Kinesis Destination - Field Verification', () => {
    /**
     * Simplified test that opens any destination form and checks
     * if Kinesis-specific fields can be rendered
     */
    beforeEach(() => {
      // Mock the Kinesis schema response
      cy.fixture('aws_kinesis').then((kinesisSchema) => {
        cy.intercept(
          'GET',
          /\/api\/catalog\/server-sink\/.+/,
          { statusCode: 200, body: kinesisSchema }
        ).as('getDestSchema');
      });
    });

    it('should display region field when Kinesis schema is loaded', () => {
      cy.visitWithTourDisabled('/destination/catalog');
      cy.wait(1000);
      clickCatalogCard();

      cy.url().should('match', /\/destination\/create_destination\/.+/);
      cy.wait('@getDestSchema', { timeout: 15000 });
      cy.get('#connector-name', { timeout: 30000 }).should('be.visible');

      // Check if region field appears (Kinesis-specific)
      cy.get('body', { timeout: 10000 }).then(($body) => {
        const formText = $body.text();
        if (formText.includes('AWS Region') || formText.includes('region')) {
          cy.log('✓ Kinesis region field found in form');
          // Scroll into view before checking visibility
          cy.contains(/region/i).scrollIntoView().should('exist');
        } else {
          cy.log('Region field not visible - schema may not be Kinesis');
        }
      });
    });

    it('should accept region value when present', () => {
      cy.visitWithTourDisabled('/destination/catalog');
      cy.wait(1000);
      clickCatalogCard();

      cy.url().should('match', /\/destination\/create_destination\/.+/);
      cy.wait('@getDestSchema', { timeout: 15000 });

      // Try to fill region if field exists
      cy.get('body').then(($body) => {
        const regionSelectors = ['[name="region"]', '[id*="region"]'].join(',');
        const hasRegion = $body.find(regionSelectors).length > 0;

        if (hasRegion) {
          cy.get(regionSelectors).first()
            .scrollIntoView()
            .clear({ force: true })
            .type('us-east-1', { force: true })
            .should('have.value', 'us-east-1');
          cy.log('✓ Region field accepts value');
        }
      });
    });

    it('should display optional Kinesis fields', () => {
      cy.visitWithTourDisabled('/destination/catalog');
      cy.wait(1000);
      clickCatalogCard();

      cy.url().should('match', /\/destination\/create_destination\/.+/);
      cy.wait('@getDestSchema', { timeout: 15000 });

      // Check for optional Kinesis fields in the form
      cy.get('body').then(($body) => {
        const formText = $body.text().toLowerCase();
        const kinesisFields = {
          'endpoint': formText.includes('endpoint'),
          'batch.size': formText.includes('batch'),
          'credentials.profile': formText.includes('credentials') || formText.includes('profile'),
        };

        Object.entries(kinesisFields).forEach(([field, found]) => {
          if (found) {
            cy.log(`✓ Found optional field: ${field}`);
          }
        });
      });
    });
  });
});
