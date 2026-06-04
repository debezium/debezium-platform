/**
 * Destination E2E tests
 * Destinations use hideSignalCollections={true} (no signal collections section).
 */
describe('Destination Management', () => {
  const TEST_KAFKA_CONNECTION_NAME = 'test-kafka-connection';
  const KAFKA_CATALOG_CARD_TOUR = 'catalog-card-io.debezium.server.kafka.KafkaChangeConsumer';
  /** Catalog cards render API `name`, not Java `class`. */
  const KAFKA_CATALOG_DISPLAY_NAME = 'Debezium Kafka Server Sink';
  const PULSAR_CATALOG_DISPLAY_NAME = 'Debezium Pulsar Server Sink';

  const CATALOG_SEARCH = '[data-tour="destination-catalog-search"] input';
  const CATALOG_CARD = '[data-tour^="catalog-card-"]';
  const GRID_VIEW = '[aria-label="grid"]';
  const LIST_VIEW = '[aria-label="list"]';
  const DESTINATION_TABLE = 'table[aria-label="destination table"]';
  const LIST_SEARCH = 'input[placeholder="Find by name"]';

  beforeEach(() => {
    cy.waitForBackend();
  });

  const clickKafkaCatalogCard = () => {
    cy.get('body').then(($body) => {
      const byTour = $body.find(`[data-tour="${KAFKA_CATALOG_CARD_TOUR}"]`);
      if (byTour.length > 0) {
        cy.wrap(byTour.first()).click();
        return;
      }
      cy.contains(CATALOG_CARD, KAFKA_CATALOG_DISPLAY_NAME).first().click();
    });
  };

  const selectKafkaConnectionInForm = () => {
    cy.get('#conn-typeahead-input', { timeout: 30000 }).scrollIntoView().should('be.visible');
    cy.get('#conn-typeahead-input input').should('be.visible').click({ force: true });
    cy.get('#conn-typeahead-input input').clear({ force: true });
    cy.get('#conn-typeahead-input input').type(TEST_KAFKA_CONNECTION_NAME, { force: true });
    cy.get('#conn-typeahead-listbox [role="option"]', { timeout: 30000 })
      .contains(TEST_KAFKA_CONNECTION_NAME)
      .first()
      .click({ force: true });
  };

  const ensureTestKafkaConnection = () => {
    const apiUrl = Cypress.env('apiUrl');
    const connectionsUrl = `${apiUrl}/api/connections`;

    cy.request({
      method: 'GET',
      url: connectionsUrl,
      failOnStatusCode: false,
    }).then((response) => {
      const list = Array.isArray(response.body)
        ? (response.body as { name?: string }[])
        : [];
      const exists = list.some((item) => item.name === TEST_KAFKA_CONNECTION_NAME);
      if (exists) return;

      cy.request({
        method: 'POST',
        url: connectionsUrl,
        failOnStatusCode: false,
        body: {
          type: 'KAFKA',
          name: TEST_KAFKA_CONNECTION_NAME,
          config: {
            'bootstrap.servers': 'localhost:9092',
          },
        },
      }).then((createResponse) => {
        expect(
          [200, 201, 202, 409],
          `create or existing status for "${TEST_KAFKA_CONNECTION_NAME}"`
        ).to.include(createResponse.status);
      });
    });
  };

  before(() => {
    ensureTestKafkaConnection();
  });

  const openCreateDestinationFromCatalog = () => {
    cy.intercept({
      method: 'GET',
      url: /\/api\/catalog\/server-sink\/.+/i,
    }).as('getDestinationSchema');

    cy.visitWithTourDisabled('/destination/catalog');
    clickKafkaCatalogCard();
    cy.url().should('match', /\/destination\/create_destination\/.+/);
    cy.wait('@getDestinationSchema', { timeout: 30000 });
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
    selectKafkaConnectionInForm();
  };

  /** Queues create flow; does not return a name (Cypress commands are async). */
  const createTestDestination = (namePrefix = 'test-dest') => {
    openCreateDestinationFromCatalog();
    fillMinimalCreateDestinationForm(`${namePrefix}-${Date.now()}`);
    cy.contains('button', 'Create destination').click();
    cy.contains('Create successful', { timeout: 20000 }).should('be.visible');
  };

  const openEditableDestinationFromListFirstRow = () => {
    cy.get(`${DESTINATION_TABLE} tbody tr`, { timeout: 30000 }).should('have.length.at.least', 1);
    cy.get(`${DESTINATION_TABLE} tbody tr`).first().find('button').first().click();
    cy.url({ timeout: 30000 }).should('match', /[?&]state=view/);
    cy.contains('button', 'Edit', { timeout: 30000 }).should('be.visible').click();
    cy.get('#connector-name', { timeout: 30000 }).should('be.visible');
    cy.get('#connector-description', { timeout: 30000 }).should('be.visible');
  };

  describe('Destination Catalog', () => {
    beforeEach(() => {
      cy.visitWithTourDisabled('/destination/catalog');
    });

    it('should display the destination catalog page', () => {
      cy.url().should('include', '/destination/catalog');
      cy.contains('Destination catalog').should('be.visible');
      cy.get(CATALOG_SEARCH).should('exist');
      cy.get(GRID_VIEW).should('exist');
      cy.get(LIST_VIEW).should('exist');
    });

    it('should display available destination connectors', () => {
      cy.get(CATALOG_CARD, { timeout: 30000 }).should('have.length.at.least', 1);
      cy.contains(KAFKA_CATALOG_DISPLAY_NAME).should('exist');
      cy.contains(/\d+\s+Items/i).should('be.visible');
    });

    it('should filter destinations by search query', () => {
      cy.get(CATALOG_SEARCH).type('pulsar');
      cy.wait(900);
      cy.contains(PULSAR_CATALOG_DISPLAY_NAME).should('be.visible');
      cy.contains(KAFKA_CATALOG_DISPLAY_NAME).should('not.exist');
    });

    it('should toggle between grid and list view', () => {
      cy.get(GRID_VIEW).should('have.attr', 'aria-pressed', 'true');
      cy.get(LIST_VIEW).click();
      cy.get(LIST_VIEW).should('have.attr', 'aria-pressed', 'true');
      cy.get('[class*="pf-v6-c-data-list"]').should('exist');
      cy.get(GRID_VIEW).click();
      cy.get('[class*="pf-v6-l-gallery"]').should('exist');
    });

    it('should clear search and show all connectors', () => {
      cy.get(CATALOG_CARD, { timeout: 30000 })
        .its('length')
        .then((initialCount) => {
          cy.get(CATALOG_SEARCH).type('pulsar');
          cy.wait(900);
          cy.get(CATALOG_CARD).should('have.length.lessThan', initialCount);
          cy.contains(PULSAR_CATALOG_DISPLAY_NAME).should('exist');
          cy.get(`[data-tour="${KAFKA_CATALOG_CARD_TOUR}"]`).should('not.exist');

          cy.get(CATALOG_SEARCH).clear({ force: true });
          cy.wait(900);
          cy.get(CATALOG_CARD).should('have.length', initialCount);
          cy.get(`[data-tour="${KAFKA_CATALOG_CARD_TOUR}"]`).should('exist');
        });
    });

    it('should navigate to create destination page from catalog', () => {
      clickKafkaCatalogCard();
      cy.url().should('match', /\/destination\/create_destination\/.+/);
      cy.contains('Create destination').should('exist');
    });

    it('should open smart editor from catalog when no connector is chosen', () => {
      cy.get('[data-tour="destination-catalog-smart-editor"]').click({ force: true });
      cy.url().should('match', /\/destination\/create_destination\/?$/);
      cy.contains('No connector selected').should('be.visible');
    });

    it('should load catalog from GET /api/catalog', () => {
      cy.intercept('GET', /\/api\/catalog\/?$/).as('getCatalog');
      cy.visitWithTourDisabled('/destination/catalog');
      cy.wait('@getCatalog').its('response.body.components').should('have.property', 'server-sink');
    });
  });

  describe('Create Destination', () => {
    it('should display create destination form', () => {
      openCreateDestinationFromCatalog();
      cy.contains('Destination type').should('be.visible');
      cy.contains('Destination name').should('be.visible');
      cy.get('#connector-name').should('exist');
      cy.contains('Description').should('be.visible');
      cy.get('#connector-description').should('exist');
      cy.get('#conn-typeahead-input').should('exist');
      cy.contains('Connector Essentials').should('be.visible');
      cy.contains('button', 'Create destination').should('be.visible');
      cy.contains('Back to catalog').should('be.visible');
      cy.get('#schema-field-signal\\.data\\.collection').should('not.exist');
    });

    it('should toggle between jump links and tabs layout', () => {
      openCreateDestinationFromCatalog();
      cy.get('#jumplinks-layout', { timeout: 30000 }).should('have.attr', 'aria-pressed', 'true');
      cy.get('#tabs-layout').click();
      cy.get('#tabs-layout').should('have.attr', 'aria-pressed', 'true');
      cy.contains('Configuration').should('be.visible');
      cy.wait(300);
      cy.get('#jumplinks-layout').click();
      cy.contains('Connector Essentials').should('be.visible');
      cy.get('#connector-name').should('be.visible');
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

    it('should validate required fields on submit', () => {
      openCreateDestinationFromCatalog();
      cy.contains('button', 'Create destination').click();
      cy.get('#connector-name').should('have.attr', 'aria-invalid', 'true');
      cy.contains('Connection is required').should('be.visible');
    });

    it('should add and remove additional properties', () => {
      openCreateDestinationFromCatalog();
      cy.contains('h2', 'Additional Properties').scrollIntoView();
      cy.contains('button', 'Add property').scrollIntoView().click({ force: true });
      cy.get('[id^="addprop-key-input-"]').should('have.length', 1);
      cy.contains('button', 'Add property').scrollIntoView().click({ force: true });
      cy.get('[id^="addprop-key-input-"]').should('have.length', 2);
      cy.get('[aria-label="Remove row"]').first().click();
      cy.get('[id^="addprop-key-input-"]').should('have.length', 1);
    });

    it('should successfully create a new destination', () => {
      cy.intercept('POST', /\/api\/destinations\/?(\?|$)/i).as('createDestination');
      openCreateDestinationFromCatalog();
      const destName = `test-dest-${Date.now()}`;
      fillMinimalCreateDestinationForm(destName);
      cy.contains('button', 'Create destination').click();
      cy.wait('@createDestination').its('response.statusCode').should('be.oneOf', [200, 201, 202]);
      cy.contains('Create successful', { timeout: 20000 }).should('be.visible');
      cy.url().should('include', '/destination');
      cy.url().should('not.include', '/create_destination');
    });

    it('should handle API errors gracefully', () => {
      cy.intercept(
        { method: 'POST', url: /\/api\/destinations\/?(\?|$)/i },
        { statusCode: 500, body: { error: 'Internal server error' } }
      ).as('createDestinationError');
      openCreateDestinationFromCatalog();
      fillMinimalCreateDestinationForm('test-dest-error');
      cy.contains('button', 'Create destination').click();
      cy.contains(/Destination creation failed|Failed to create/i, { timeout: 20000 }).should(
        'be.visible'
      );
    });

    it('should handle schema loading errors', () => {
      cy.intercept(
        { method: 'GET', url: /\/api\/catalog\/server-sink\/.+/i },
        { statusCode: 404, body: { error: 'Schema not found' } }
      ).as('schemaError');

      cy.visitWithTourDisabled('/destination/catalog');
      clickKafkaCatalogCard();
      cy.wait('@schemaError');
      cy.contains('Failed to load connector schema', { timeout: 30000 }).should('be.visible');
    });

    it('should navigate back from create to catalog', () => {
      openCreateDestinationFromCatalog();
      cy.contains('Back to catalog').click({ force: true });
      cy.url().should('include', '/destination/catalog');
    });
  });

  describe('Destination List', () => {
    it('should display list of destinations or empty state', () => {
      cy.intercept('GET', /\/api\/destinations\/?$/i).as('getDestinations');
      cy.visitWithTourDisabled('/destination');
      cy.wait('@getDestinations').its('response.statusCode').should('eq', 200);
      cy.url().should('include', '/destination');
      cy.get('body').then(($body) => {
        if ($body.find(DESTINATION_TABLE).length > 0) {
          cy.contains('Name').should('be.visible');
          cy.contains('Type').should('be.visible');
          cy.contains('Used in').should('be.visible');
        } else {
          cy.contains('No destination available').should('be.visible');
          cy.get('[data-tour="add-destination"]').should('be.visible');
        }
      });
    });

    it('should navigate to catalog from empty state or toolbar', () => {
      cy.visitWithTourDisabled('/destination');
      cy.get('[data-tour="add-destination"]').first().click();
      cy.url().should('include', '/destination/catalog');
    });

    it('should navigate to destination details on row click', () => {
      createTestDestination('list-nav');
      cy.visitWithTourDisabled('/destination');
      cy.get(`${DESTINATION_TABLE} tbody tr`).first().find('button').first().click();
      cy.url().should('match', /\/destination\/\d+\?state=view/);
    });

    it('should filter destinations by name in the list', () => {
      const destName = `search-filter-${Date.now()}`;
      openCreateDestinationFromCatalog();
      fillMinimalCreateDestinationForm(destName);
      cy.contains('button', 'Create destination').click();
      cy.contains('Create successful', { timeout: 20000 }).should('be.visible');
      cy.visitWithTourDisabled('/destination');
      cy.get(LIST_SEARCH).type(destName);
      cy.wait(900);
      cy.get(`${DESTINATION_TABLE} tbody tr`).should('have.length', 1);
      cy.get(`${DESTINATION_TABLE} tbody tr`).first().should('contain', destName);
    });
  });

  describe('Edit Destination', () => {
    it('should display destination in view mode with edit action', () => {
      createTestDestination('view-mode');
      cy.visitWithTourDisabled('/destination');
      cy.get(`${DESTINATION_TABLE} tbody tr`).first().find('button').first().click();
      cy.url().should('match', /[?&]state=view/);
      cy.contains('button', 'Edit', { timeout: 30000 }).should('exist');
    });

    it('should toggle between view and edit mode', () => {
      createTestDestination('edit-toggle');
      cy.visitWithTourDisabled('/destination');
      openEditableDestinationFromListFirstRow();
      cy.get('#connector-name').should('not.have.attr', 'readonly');
      cy.contains('button', 'Cancel').click();
      cy.get('#connector-name').should('not.exist');
      cy.contains('button', 'Edit', { timeout: 30000 }).should('exist');
    });

    it('should show confirmation modal before saving changes', () => {
      createTestDestination('save-modal');
      cy.visitWithTourDisabled('/destination');
      openEditableDestinationFromListFirstRow();
      cy.get('#connector-description').clear().type('Updated by Cypress');
      cy.contains('button', 'Save changes').click();
      cy.get('.pf-v6-c-modal-box', { timeout: 10000 }).should('be.visible');
      cy.contains('button', 'Confirm').should('be.visible');
    });

    it('should successfully update destination', () => {
      createTestDestination('update');
      cy.visitWithTourDisabled('/destination');
      openEditableDestinationFromListFirstRow();
      cy.get('#connector-description').clear().type('Updated description by Cypress');
      cy.contains('button', 'Save changes').click();
      cy.get('.pf-v6-c-modal-box').contains('button', 'Confirm').click();
      cy.contains('successful', { timeout: 20000 }).should('be.visible');
      cy.get('#connector-name').should('not.exist');
      cy.contains('button', 'Edit', { timeout: 30000 }).should('exist');
    });

    it('should cancel edit and discard changes', () => {
      createTestDestination('cancel-edit');
      cy.visitWithTourDisabled('/destination');
      openEditableDestinationFromListFirstRow();
      cy.get('#connector-description').clear().type('Temporary change');
      cy.contains('button', 'Cancel').click();
      cy.get('#connector-name').should('not.exist');
      cy.contains('button', 'Edit', { timeout: 30000 }).should('exist');
    });
  });

  describe('Delete Destination', () => {
    it('should show confirmation dialog before deleting', () => {
      createTestDestination('delete-dialog');
      cy.visitWithTourDisabled('/destination');
      cy.get(`${DESTINATION_TABLE} tbody tr`)
        .first()
        .find('td[data-label="Actions"] button')
        .click();
      cy.contains('Delete').click();
      cy.get('.pf-v6-c-modal-box').should('be.visible');
      cy.get('#delete-name').should('exist');
      cy.get('.pf-v6-c-modal-box').contains('button', 'Delete').should('be.disabled');
    });

    it('should require typing exact name to confirm delete', () => {
      createTestDestination('delete-confirm');
      cy.visitWithTourDisabled('/destination');
      cy.get(`${DESTINATION_TABLE} tbody tr`)
        .first()
        .find('td[data-label="Actions"] button')
        .click();
      cy.contains('Delete').click();
      cy.get('#delete-name').type('wrong-name');
      cy.get('.pf-v6-c-modal-box').contains('button', 'Delete').should('be.disabled');
    });

    it('should successfully delete destination', () => {
      createTestDestination('delete-success');
      cy.visitWithTourDisabled('/destination');
      cy.get(`${DESTINATION_TABLE} tbody tr`)
        .first()
        .find('button')
        .first()
        .invoke('text')
        .then((name) => {
          const trimmed = name.trim();
          cy.get(`${DESTINATION_TABLE} tbody tr`)
            .first()
            .find('td[data-label="Actions"] button')
            .click();
          cy.contains('Delete').click();
          cy.get('#delete-name').type(trimmed);
          cy.get('.pf-v6-c-modal-box').contains('button', 'Delete').click();
          cy.contains('Delete successful', { timeout: 20000 }).should('be.visible');
          cy.get(DESTINATION_TABLE).should('not.contain', trimmed);
        });
    });

    it('should cancel delete and keep the destination', () => {
      createTestDestination('delete-cancel');
      cy.visitWithTourDisabled('/destination');
      cy.get(`${DESTINATION_TABLE} tbody tr`)
        .its('length')
        .then((initialCount) => {
          cy.get(`${DESTINATION_TABLE} tbody tr`)
            .first()
            .find('td[data-label="Actions"] button')
            .click();
          cy.contains('Delete').click();
          cy.get('.pf-v6-c-modal-box').contains('button', 'Cancel').click();
          cy.get('.pf-v6-c-modal-box').should('not.exist');
          cy.get(`${DESTINATION_TABLE} tbody tr`).should('have.length', initialCount);
        });
    });
  });

  describe('Kinesis schema (fixture)', () => {
    beforeEach(() => {
      cy.fixture('aws_kinesis').then((kinesisSchema) => {
        cy.intercept('GET', /\/api\/catalog\/server-sink\/.+/, {
          statusCode: 200,
          body: kinesisSchema,
        }).as('getKinesisSchema');
      });
    });

    it('should render Kinesis-specific fields from schema', () => {
      cy.visitWithTourDisabled('/destination/catalog');
      clickKafkaCatalogCard();
      cy.wait('@getKinesisSchema', { timeout: 30000 });
      cy.get('#connector-name', { timeout: 30000 }).should('be.visible');
      // Kinesis properties are in the Advanced group (often below the fold).
      cy.get('#group-advanced').scrollIntoView();
      cy.get('#schema-field-region', { timeout: 10000 })
        .should('be.visible')
        .and('have.attr', 'aria-label', 'AWS Region');
      cy.get('#schema-field-endpoint')
        .should('exist')
        .and('have.attr', 'aria-label', 'Kinesis Endpoint Override');
    });

    it('should accept values in Kinesis region field', () => {
      cy.visitWithTourDisabled('/destination/catalog');
      clickKafkaCatalogCard();
      cy.wait('@getKinesisSchema', { timeout: 30000 });
      cy.get('#schema-field-region')
        .scrollIntoView()
        .clear({ force: true })
        .type('us-east-1', { force: true })
        .should('have.value', 'us-east-1');
    });
  });
});
