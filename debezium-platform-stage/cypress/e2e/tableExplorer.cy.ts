/**
 * Table explorer selection under an active search filter.
 *
 * The collections endpoint is stubbed so the spec needs no live Postgres. The stub gives
 * `public` two tables, which is what makes a hidden selected table reachable.
 */
describe('Table Explorer Selection', () => {
  const apiUrl = () => Cypress.expose('apiUrl');
  const SEED_CONNECTION_NAME = 'cypress-table-explorer-connection';
  const SEED_SOURCE_NAME = 'cypress-table-explorer-source';
  const POSTGRES_CONFIG = {
    hostname: 'postgresql',
    port: 5426,
    username: 'debezium',
    password: 'debezium',
    database: 'debezium',
  };
  const STUBBED_COLLECTIONS = {
    catalogs: [
      {
        name: 'debezium',
        totalCollections: 2,
        schemas: [
          {
            name: 'public',
            collectionCount: 2,
            collections: [
              { name: 'orders', fullyQualifiedName: 'public.orders' },
              { name: 'customers', fullyQualifiedName: 'public.customers' },
            ],
          },
        ],
      },
    ],
  };

  let seedSourceId: number | undefined;

  const ensureSeedConnection = () => {
    cy.request({ method: 'GET', url: `${apiUrl()}/api/connections`, failOnStatusCode: false }).then((response) => {
      const connections = Array.isArray(response.body)
        ? (response.body as { id?: number; name?: string }[])
        : [];
      if (connections.some((item) => item.name === SEED_CONNECTION_NAME)) return;

      cy.request({
        method: 'POST',
        url: `${apiUrl()}/api/connections`,
        failOnStatusCode: false,
        body: { type: 'POSTGRESQL', name: SEED_CONNECTION_NAME, config: POSTGRES_CONFIG },
      }).then((createResponse) => {
        expect(
          [200, 201, 202, 409],
          `connection seed status for "${SEED_CONNECTION_NAME}"`
        ).to.include(createResponse.status);
      });
    });
  };

  const ensureSeedSource = () => {
    cy.request({ method: 'GET', url: `${apiUrl()}/api/connections`, failOnStatusCode: false }).then((connResponse) => {
      const connections = Array.isArray(connResponse.body)
        ? (connResponse.body as { id?: number; name?: string }[])
        : [];
      const postgresConn = connections.find((c) => c.name === SEED_CONNECTION_NAME);
      void expect(postgresConn?.id, `connection "${SEED_CONNECTION_NAME}"`).to.exist;

      cy.request({ method: 'GET', url: `${apiUrl()}/api/sources`, failOnStatusCode: false }).then((srcResponse) => {
        const sources = Array.isArray(srcResponse.body)
          ? (srcResponse.body as { id?: number; name?: string }[])
          : [];
        const existing = sources.find((s) => s.name === SEED_SOURCE_NAME);
        if (existing?.id) {
          seedSourceId = existing.id;
          return;
        }

        cy.request({
          method: 'POST',
          url: `${apiUrl()}/api/sources`,
          failOnStatusCode: false,
          body: {
            name: SEED_SOURCE_NAME,
            description: `Cypress table explorer E2E source (${SEED_SOURCE_NAME})`,
            type: 'io.debezium.connector.postgresql.PostgresConnector',
            schema: 'dummy',
            vaults: [],
            connection: { id: postgresConn!.id },
            config: { 'topic.prefix': 'cypress.table.explorer' },
          },
        }).then((createResponse) => {
          expect(
            [200, 201, 202, 409],
            `source seed status for "${SEED_SOURCE_NAME}"`
          ).to.include(createResponse.status);
          const created = createResponse.body as { id?: number };
          if (created?.id) {
            seedSourceId = created.id;
            return;
          }
          cy.request({ method: 'GET', url: `${apiUrl()}/api/sources`, failOnStatusCode: false }).then((reload) => {
            const list = Array.isArray(reload.body)
              ? (reload.body as { id?: number; name?: string }[])
              : [];
            const found = list.find((s) => s.name === SEED_SOURCE_NAME);
            void expect(found?.id, `source "${SEED_SOURCE_NAME}"`).to.exist;
            seedSourceId = found!.id!;
          });
        });
      });
    });
  };

  before(() => {
    ensureSeedConnection();
    ensureSeedSource();
  });

  beforeEach(() => {
    cy.waitForBackend();
  });

  /** Stubbed inside the test so the collections fetch on the edit page is the stubbed one. */
  const stubCollections = () => {
    cy.intercept('GET', '**/api/connections/*/collections', (req) => {
      req.reply({ statusCode: 200, body: STUBBED_COLLECTIONS });
    }).as('getCollections');
  };

  const openTableExplorer = () => {
    cy.intercept('GET', /\/api\/sources\/?(\?|$)/i).as('getSources');
    cy.visitWithTourDisabled('/source');
    cy.wait('@getSources');
    cy.visitWithTourDisabled(`/source/${seedSourceId}?state=view`);
    cy.contains('button', 'Edit', { timeout: 30000 }).click();
    cy.wait('@getCollections', { timeout: 30000 });
    cy.get('.virtual-tree', { timeout: 30000 }).should('exist');
    cy.get('.virtual-tree').contains('button', 'Expand all').click();
    cy.get('input[aria-label="Select public"]', { timeout: 30000 }).should('exist');
  };

  it('clears hidden tables when a fully selected schema is unticked while filtered', () => {
    stubCollections();
    openTableExplorer();

    cy.get('input[aria-label="Select public"]', { timeout: 15000 }).click({ force: true });
    cy.get('input[aria-label="Select public"]', { timeout: 15000 }).should('have.prop', 'checked', true);
    cy.get('input[aria-label="Select orders"]', { timeout: 15000 }).should('have.prop', 'checked', true);

    // Filter down to a single table so the other selected table is hidden.
    cy.get('.virtual-tree').get('input[aria-label="Search input example"]').type('customers');
    cy.get('input[aria-label="Select orders"]', { timeout: 15000 }).should('not.exist');

    cy.get('input[aria-label="Select public"]').click({ force: true });

    cy.get('.virtual-tree').get('input[aria-label="Search input example"]').clear();
    cy.get('input[aria-label="Select public"]', { timeout: 15000 }).should('have.prop', 'checked', false);
    cy.get('input[aria-label="Select orders"]', { timeout: 15000 }).should('have.prop', 'checked', false);
    cy.get('input[aria-label="Select customers"]', { timeout: 15000 }).should('have.prop', 'checked', false);
  });
});