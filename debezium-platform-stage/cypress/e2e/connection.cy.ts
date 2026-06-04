/**
 * Connection E2E: source (PostgreSQL) and destination (Kafka) create flows.
 * Typed connections require Validate before Create/Save when a schema is present.
 * Validate is stubbed in UI tests so a live Postgres/Kafka instance is not required.
 */
describe('Connection Management', () => {
  const CYPRESS_SEED_POSTGRES_NAME = 'cypress-seed-postgres-connection';
  const POSTGRES_CATALOG_CARD_TOUR =
    'catalog-card-io.debezium.connector.postgresql.PostgresConnector';
  const POSTGRES_CATALOG_DISPLAY_NAME = 'Debezium PostgreSQL Connector';
  const KAFKA_CATALOG_CARD_TOUR =
    'catalog-card-io.debezium.server.kafka.KafkaChangeConsumer';
  const KAFKA_CATALOG_DISPLAY_NAME = 'Debezium Kafka Server Sink';

  const CATALOG_SEARCH = 'input[placeholder="Search by name"]';
  const CATALOG_CARD = '[data-tour^="catalog-card-"]';
  const GRID_VIEW = '[aria-label="Grid view"]';
  const LIST_VIEW = '[aria-label="List view"]';
  const CONNECTION_TABLE = 'table[aria-label="connection table"]';
  const LIST_SEARCH = 'input[placeholder="Find by name"]';

  const POSTGRES_CONFIG = {
    hostname: 'postgresql',
    port: 5426,
    username: 'debezium',
    password: 'debezium',
    database: 'debezium',
  };

  const KAFKA_CONFIG = {
    'bootstrap.servers': 'localhost:9092',
  };

  beforeEach(() => {
    cy.waitForBackend();
  });

  const clickPostgresCatalogCard = () => {
    cy.get('body').then(($body) => {
      const byTour = $body.find(`[data-tour="${POSTGRES_CATALOG_CARD_TOUR}"]`);
      if (byTour.length > 0) {
        cy.wrap(byTour.first()).click();
        return;
      }
      cy.contains(CATALOG_CARD, POSTGRES_CATALOG_DISPLAY_NAME).first().click();
    });
  };

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

  const selectCatalogTypeFilter = (type: 'Source' | 'Destination' | 'All') => {
    cy.contains('button', /^Type$/).click();
    if (type === 'All') {
      cy.contains('[role="option"]', 'All').click();
    } else {
      cy.contains('[role="option"]', type).click();
    }
  };

  const ensureSeedPostgresConnection = () => {
    const connectionsUrl = `${Cypress.env('apiUrl')}/api/connections`;

    cy.request({ method: 'GET', url: connectionsUrl, failOnStatusCode: false }).then((response) => {
      const list = Array.isArray(response.body) ? (response.body as { name?: string }[]) : [];
      if (list.some((item) => item.name === CYPRESS_SEED_POSTGRES_NAME)) return;

      cy.request({
        method: 'POST',
        url: connectionsUrl,
        failOnStatusCode: false,
        body: {
          type: 'POSTGRESQL',
          name: CYPRESS_SEED_POSTGRES_NAME,
          config: POSTGRES_CONFIG,
        },
      }).then((createResponse) => {
        expect(
          [200, 201, 202, 409],
          `seed status for "${CYPRESS_SEED_POSTGRES_NAME}"`
        ).to.include(createResponse.status);
      });
    });
  };

  before(() => {
    ensureSeedPostgresConnection();
  });

  const openCreateConnectionFromCatalog = () => {
    cy.intercept('GET', /\/api\/connections\/schemas\/?$/).as('getConnectionSchemas');
    cy.visitWithTourDisabled('/connections/catalog');
    clickPostgresCatalogCard();
    cy.url().should('match', /\/connections\/create_connection\/.+/);
    cy.wait('@getConnectionSchemas', { timeout: 30000 });
    cy.get('#connection-name', { timeout: 30000 }).should('be.visible');
  };

  const openCreateKafkaConnectionFromCatalog = () => {
    cy.intercept('GET', /\/api\/connections\/schemas\/?$/).as('getConnectionSchemas');
    cy.visitWithTourDisabled('/connections/catalog');
    selectCatalogTypeFilter('Destination');
    clickKafkaCatalogCard();
    cy.url().should('match', /\/connections\/create_connection\/.+/);
    cy.wait('@getConnectionSchemas', { timeout: 30000 });
    cy.get('#connection-name', { timeout: 30000 }).should('be.visible');
  };

  const fillPostgresConnectionForm = (connectionName: string) => {
    cy.get('#connection-name').clear({ force: true }).type(connectionName, { force: true });
    cy.get('#hostname').clear({ force: true }).type(String(POSTGRES_CONFIG.hostname), { force: true });
    cy.get('#port').clear({ force: true }).type(String(POSTGRES_CONFIG.port), { force: true });
    cy.get('#username').clear({ force: true }).type(POSTGRES_CONFIG.username, { force: true });
    cy.get('#password').clear({ force: true }).type(POSTGRES_CONFIG.password, { force: true });
    cy.get('#database').clear({ force: true }).type(POSTGRES_CONFIG.database, { force: true });
  };

  const fillKafkaConnectionForm = (connectionName: string) => {
    cy.get('#connection-name').clear({ force: true }).type(connectionName, { force: true });
    cy.get('[id="bootstrap.servers"]')
      .clear({ force: true })
      .type(KAFKA_CONFIG['bootstrap.servers'], { force: true });
  };

  /** Conductor validate needs a reachable DB; stub keeps UI gate tests reliable. */
  const stubConnectionValidateSuccess = () => {
    cy.intercept('POST', '**/api/connections/validate**', {
      statusCode: 200,
      body: { valid: true },
    }).as('validateConnection');
  };

  const validateConnectionInForm = () => {
    stubConnectionValidateSuccess();
    cy.contains('button', 'Validate').click();
    cy.wait('@validateConnection').its('response.body.valid').should('eq', true);
    cy.contains('Validation successful', { timeout: 10000 }).should('be.visible');
  };

  const createTestConnection = (namePrefix = 'cypress-conn') => {
    const name = `${namePrefix}-${Date.now()}`;
    cy.wrap(name).as('testConnectionName');
    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl')}/api/connections`,
      failOnStatusCode: false,
      body: {
        type: 'POSTGRESQL',
        name,
        config: POSTGRES_CONFIG,
      },
    }).then((response) => {
      expect([200, 201, 202, 409], `create status for "${name}"`).to.include(response.status);
    });
  };

  const openTestConnectionFromList = () => {
    cy.get<string>('@testConnectionName').then((name) => {
      cy.visitWithTourDisabled('/connections');
      cy.get(LIST_SEARCH).clear({ force: true }).type(name, { force: true });
      cy.wait(900);
      cy.get(`${CONNECTION_TABLE} tbody tr`, { timeout: 30000 })
        .should('have.length', 1)
        .first()
        .find('button')
        .first()
        .click();
      cy.url({ timeout: 30000 }).should('match', /[?&]state=view/);
    });
  };

  const openSeedConnectionFromList = () => {
    cy.visitWithTourDisabled('/connections');
    cy.get(LIST_SEARCH).clear({ force: true }).type(CYPRESS_SEED_POSTGRES_NAME, { force: true });
    cy.wait(900);
    cy.get(`${CONNECTION_TABLE} tbody tr`, { timeout: 30000 })
      .should('have.length.at.least', 1)
      .first()
      .find('button')
      .first()
      .click();
    cy.url({ timeout: 30000 }).should('match', /[?&]state=view/);
  };

  const openEditableConnectionFromListFirstRow = () => {
    openSeedConnectionFromList();
    cy.contains('button', 'Edit', { timeout: 30000 }).should('be.visible').click();
    cy.get('#connection-name', { timeout: 30000 }).should('be.visible');
  };

  describe('Connection Catalog', () => {
    beforeEach(() => {
      cy.visitWithTourDisabled('/connections/catalog');
    });

    it('should display the connection catalog page', () => {
      cy.url().should('include', '/connections/catalog');
      cy.contains('Connection catalog').should('be.visible');
      cy.get(CATALOG_SEARCH).should('exist');
      cy.get(GRID_VIEW).should('exist');
      cy.get(LIST_VIEW).should('exist');
    });

    it('should display merged source and destination connection types', () => {
      cy.get(CATALOG_CARD, { timeout: 30000 }).should('have.length.at.least', 2);
      cy.contains(POSTGRES_CATALOG_DISPLAY_NAME).should('exist');
      cy.contains(KAFKA_CATALOG_DISPLAY_NAME).should('exist');
      cy.contains(/\d+\s+Items/i).should('be.visible');
    });

    it('should filter catalog by search query', () => {
      cy.get(CATALOG_SEARCH).type('PostgreSQL');
      cy.wait(900);
      cy.contains(POSTGRES_CATALOG_DISPLAY_NAME).should('exist');
      cy.contains(KAFKA_CATALOG_DISPLAY_NAME).should('not.exist');
    });

    it('should filter catalog by Source type', () => {
      selectCatalogTypeFilter('Source');
      cy.contains(POSTGRES_CATALOG_DISPLAY_NAME).should('exist');
      cy.contains(KAFKA_CATALOG_DISPLAY_NAME).should('not.exist');
    });

    it('should filter catalog by Destination type', () => {
      selectCatalogTypeFilter('Destination');
      cy.contains(KAFKA_CATALOG_DISPLAY_NAME).should('exist');
      cy.contains(POSTGRES_CATALOG_DISPLAY_NAME).should('not.exist');
    });

    it('should toggle between grid and list view', () => {
      cy.get(GRID_VIEW).should('have.attr', 'aria-pressed', 'true');
      cy.get(LIST_VIEW).click();
      cy.get(LIST_VIEW).should('have.attr', 'aria-pressed', 'true');
      cy.get('[class*="pf-v6-c-data-list"]').should('exist');
      cy.get(GRID_VIEW).click();
      cy.get('[class*="pf-v6-l-gallery"]').should('exist');
    });

    it('should clear search and restore catalog entries', () => {
      cy.get(CATALOG_SEARCH).type('PostgreSQL');
      cy.wait(900);
      cy.contains(POSTGRES_CATALOG_DISPLAY_NAME).should('exist');
      cy.contains(KAFKA_CATALOG_DISPLAY_NAME).should('not.exist');
      cy.get(CATALOG_SEARCH).clear({ force: true });
      cy.wait(900);
      cy.contains(POSTGRES_CATALOG_DISPLAY_NAME).should('exist');
      cy.contains(KAFKA_CATALOG_DISPLAY_NAME).should('exist');
      cy.get(`[data-tour="${POSTGRES_CATALOG_CARD_TOUR}"]`).should('exist');
    });

    it('should navigate to create connection from catalog card', () => {
      clickPostgresCatalogCard();
      cy.url().should('match', /\/connections\/create_connection\/.+/);
      cy.contains('Create connection').should('exist');
    });
  });

  describe('Create Connection', () => {
    it('should display create connection form for PostgreSQL', () => {
      openCreateConnectionFromCatalog();
      cy.contains('h1', 'Create connection').should('be.visible');
      cy.get('#connection-name').should('exist');
      cy.get('#hostname').should('exist');
      cy.get('#port').should('exist');
      cy.get('#username').should('exist');
      cy.get('#password').should('exist');
      cy.get('#database').should('exist');
      cy.contains('button', 'Validate').should('be.visible');
      cy.contains('button', 'Create connection').should('be.disabled');
      cy.contains('button', 'Back to catalog').should('be.visible');
    });

    it('should require validation before create', () => {
      openCreateConnectionFromCatalog();
      fillPostgresConnectionForm('validate-gate-test');
      cy.contains('button', 'Create connection').should('be.disabled');
      validateConnectionInForm();
      cy.contains('button', 'Create connection').should('not.be.disabled');
    });

    it('should validate required fields', () => {
      openCreateConnectionFromCatalog();
      cy.contains('button', 'Validate').click();
      cy.get('#connection-name').should('have.attr', 'aria-invalid', 'true');
    });

    it('should successfully create a PostgreSQL connection', () => {
      cy.intercept('POST', /\/api\/connections\/?(\?|$)/i).as('createConnection');
      openCreateConnectionFromCatalog();
      const connName = `cypress-create-${Date.now()}`;
      fillPostgresConnectionForm(connName);
      validateConnectionInForm();
      cy.contains('button', 'Create connection').click();
      cy.wait('@createConnection').its('response.statusCode').should('be.oneOf', [200, 201, 202]);
      cy.contains('Creation successful', { timeout: 20000 }).should('be.visible');
      cy.url().should('include', '/connections');
      cy.url().should('not.include', '/create_connection');
    });

    it('should handle API errors on create', () => {
      cy.intercept('POST', /\/api\/connections\/?(\?|$)/i, {
        statusCode: 500,
        body: { error: 'Internal server error' },
      }).as('createConnectionError');
      openCreateConnectionFromCatalog();
      fillPostgresConnectionForm('cypress-create-error');
      validateConnectionInForm();
      cy.contains('button', 'Create connection').click();
      cy.contains(/Connection creation failed|Failed to create/i, { timeout: 20000 }).should(
        'be.visible'
      );
    });

    it('should navigate back to catalog', () => {
      openCreateConnectionFromCatalog();
      cy.contains('button', 'Back to catalog').click({ force: true });
      cy.url().should('include', '/connections/catalog');
    });

    it('should display create connection form for Kafka destination', () => {
      openCreateKafkaConnectionFromCatalog();
      cy.contains('h1', 'Create connection').should('be.visible');
      cy.contains('Destination connection').should('exist');
      cy.get('[id="bootstrap.servers"]').should('exist');
      cy.get('#hostname').should('not.exist');
      cy.contains('button', 'Validate').should('be.visible');
      cy.contains('button', 'Create connection').should('be.disabled');
      cy.contains('button', 'Back to catalog').should('be.visible');
    });

    it('should successfully create a Kafka destination connection', () => {
      cy.intercept('POST', /\/api\/connections\/?(\?|$)/i).as('createConnection');
      openCreateKafkaConnectionFromCatalog();
      const connName = `cypress-kafka-conn-${Date.now()}`;
      fillKafkaConnectionForm(connName);
      validateConnectionInForm();
      cy.contains('button', 'Create connection').click();
      cy.wait('@createConnection').its('response.statusCode').should('be.oneOf', [200, 201, 202]);
      cy.contains('Creation successful', { timeout: 20000 }).should('be.visible');
      cy.url().should('include', '/connections');
      cy.url().should('not.include', '/create_connection');

      cy.visitWithTourDisabled('/connections');
      cy.get(LIST_SEARCH).type(connName);
      cy.wait(900);
      cy.get(`${CONNECTION_TABLE} tbody tr`).should('have.length', 1);
      cy.get(`${CONNECTION_TABLE} tbody tr`).first().should('contain', connName);
      cy.get(`${CONNECTION_TABLE} tbody tr`).first().should('contain', 'Kafka');
    });
  });

  describe('Connection List', () => {
    it('should display connections list or empty state', () => {
      cy.intercept('GET', /\/api\/connections\/?$/i).as('getConnections');
      cy.visitWithTourDisabled('/connections');
      cy.wait('@getConnections').its('response.statusCode').should('eq', 200);
      cy.get('[data-tour="connection-page"]', { timeout: 30000 }).should('exist');
      // Wait until loading finishes (table or empty state — not the spinner).
      cy.get('body', { timeout: 30000 }).should(($body) => {
        const ready =
          $body.find(CONNECTION_TABLE).length > 0 ||
          $body.text().includes('No Connection available');
        void expect(ready, 'connection table or empty state').to.be.true;
      });
      cy.get('body').then(($body) => {
        if ($body.find(CONNECTION_TABLE).length > 0) {
          cy.get(CONNECTION_TABLE).within(() => {
            cy.contains('Name').should('be.visible');
            cy.contains('Type').should('be.visible');
            cy.contains('Used in').should('be.visible');
          });
        } else {
          cy.contains('No Connection available').should('be.visible');
        }
      });
    });

    it('should navigate to catalog from list', () => {
      cy.visitWithTourDisabled('/connections');
      cy.contains('button', /Add connection/i)
        .first()
        .click();
      cy.url().should('include', '/connections/catalog');
    });

    it('should navigate to connection details on row click', () => {
      createTestConnection('list-nav');
      openTestConnectionFromList();
    });

    it('should filter connections by name in the list', () => {
      createTestConnection('cypress-search');
      cy.get<string>('@testConnectionName').then((connName) => {
        cy.visitWithTourDisabled('/connections');
        cy.get(LIST_SEARCH).type(connName);
        cy.wait(900);
        cy.get(`${CONNECTION_TABLE} tbody tr`).should('have.length', 1);
        cy.get(`${CONNECTION_TABLE} tbody tr`).first().should('contain', connName);
      });
    });
  });

  describe('Edit Connection', () => {
    it('should display connection in view mode with edit action', () => {
      openSeedConnectionFromList();
      cy.contains('button', 'Edit', { timeout: 30000 }).should('exist');
    });

    it('should toggle between view and edit mode', () => {
      openEditableConnectionFromListFirstRow();
      cy.contains('button', 'Cancel').click();
      cy.get('#connection-name').should('not.exist');
      cy.contains('button', 'Edit', { timeout: 30000 }).should('exist');
    });

    it('should require validation before saving edits', () => {
      openEditableConnectionFromListFirstRow();
      cy.contains('button', 'Save changes').should('be.disabled');
      validateConnectionInForm();
      cy.contains('button', 'Save changes').should('not.be.disabled');
    });

    it('should successfully update connection', () => {
      openEditableConnectionFromListFirstRow();
      cy.get('#database').clear({ force: true }).type('debezium', { force: true });
      validateConnectionInForm();
      cy.contains('button', 'Save changes').click();
      cy.contains('successful', { timeout: 20000 }).should('be.visible');
      cy.get('#connection-name').should('not.exist');
      cy.contains('button', 'Edit', { timeout: 30000 }).should('exist');
    });
  });

  describe('Delete Connection', () => {
    it('should show delete confirmation dialog', () => {
      createTestConnection('delete-dialog');
      cy.get<string>('@testConnectionName').then((name) => {
        cy.visitWithTourDisabled('/connections');
        cy.get(LIST_SEARCH).type(name);
        cy.wait(900);
        cy.get(`${CONNECTION_TABLE} tbody tr`)
          .first()
          .find('td[data-label="Actions"] button')
          .click();
        cy.contains('Delete').click();
        cy.get('.pf-v6-c-modal-box').should('be.visible');
        cy.get('#delete-name').should('exist');
        cy.get('.pf-v6-c-modal-box').contains('button', 'Delete').should('be.disabled');
      });
    });

    it('should successfully delete connection', () => {
      createTestConnection('delete-success');
      cy.get<string>('@testConnectionName').then((name) => {
        cy.visitWithTourDisabled('/connections');
        cy.get(LIST_SEARCH).type(name);
        cy.wait(900);
        cy.get(`${CONNECTION_TABLE} tbody tr`)
          .first()
          .find('td[data-label="Actions"] button')
          .click();
        cy.contains('Delete').click();
        cy.get('#delete-name').type(name);
        cy.get('.pf-v6-c-modal-box').contains('button', 'Delete').click();
        cy.contains('Delete successful', { timeout: 20000 }).should('be.visible');
        cy.get(CONNECTION_TABLE).should('not.contain', name);
      });
    });

    it('should cancel delete and keep the connection', () => {
      createTestConnection('delete-cancel');
      cy.get<string>('@testConnectionName').then((name) => {
        cy.visitWithTourDisabled('/connections');
        cy.get(LIST_SEARCH).type(name);
        cy.wait(900);
        cy.get(`${CONNECTION_TABLE} tbody tr`).should('have.length', 1);
        cy.get(`${CONNECTION_TABLE} tbody tr`)
          .first()
          .find('td[data-label="Actions"] button')
          .click();
        cy.contains('Delete').click();
        cy.get('.pf-v6-c-modal-box').contains('button', 'Cancel').click();
        cy.get('.pf-v6-c-modal-box').should('not.exist');
        cy.get(`${CONNECTION_TABLE} tbody tr`).should('have.length', 1);
        cy.get(`${CONNECTION_TABLE} tbody tr`).first().should('contain', name);
      });
    });
  });
});
