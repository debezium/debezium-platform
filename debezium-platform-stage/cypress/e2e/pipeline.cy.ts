/**
 * Pipeline E2E — MVP
 * Self-seeds connections, source, and destination via API (no cross-spec ordering).
 * Create flow uses the UI designer (source/destination modals → configure → submit).
 */
describe('Pipeline Management', () => {
  const TEST_POSTGRES_CONNECTION_NAME = 'test-postgres-connection';
  const TEST_KAFKA_CONNECTION_NAME = 'test-kafka-connection';
  const CYPRESS_PIPELINE_SOURCE_NAME = 'cypress-pipeline-source';
  const CYPRESS_PIPELINE_DESTINATION_NAME = 'cypress-pipeline-destination';

  const PIPELINE_TABLE = 'table[aria-label="Pipeline Table"]';
  const LIST_SEARCH = 'input[placeholder="Find by name"]';
  const SOURCE_TABLE = 'table[aria-label="source table"]';
  const DESTINATION_TABLE = 'table[aria-label="destination table"]';

  let seedSourceId: number;
  let seedDestinationId: number;

  const apiUrl = () => Cypress.env('apiUrl');

  const ensureConnection = (
    name: string,
    body: { type: string; name: string; config: Record<string, unknown> }
  ) => {
    cy.request({
      method: 'GET',
      url: `${apiUrl()}/api/connections`,
      failOnStatusCode: false,
    }).then((response) => {
      const list = Array.isArray(response.body)
        ? (response.body as { name?: string }[])
        : [];
      if (list.some((item) => item.name === name)) return;

      cy.request({
        method: 'POST',
        url: `${apiUrl()}/api/connections`,
        failOnStatusCode: false,
        body,
      }).then((createResponse) => {
        expect(
          [200, 201, 202, 409],
          `connection seed status for "${name}"`
        ).to.include(createResponse.status);
      });
    });
  };

  const ensureCypressPipelineSource = () => {
    cy.request({
      method: 'GET',
      url: `${apiUrl()}/api/connections`,
      failOnStatusCode: false,
    }).then((connResponse) => {
      const connections = Array.isArray(connResponse.body)
        ? (connResponse.body as { id?: number; name?: string }[])
        : [];
      const postgresConn = connections.find((c) => c.name === TEST_POSTGRES_CONNECTION_NAME);
      void expect(postgresConn?.id, `connection "${TEST_POSTGRES_CONNECTION_NAME}"`).to.exist;

      cy.request({
        method: 'GET',
        url: `${apiUrl()}/api/sources`,
        failOnStatusCode: false,
      }).then((srcResponse) => {
        const sources = Array.isArray(srcResponse.body)
          ? (srcResponse.body as { id?: number; name?: string }[])
          : [];
        const existing = sources.find((s) => s.name === CYPRESS_PIPELINE_SOURCE_NAME);
        if (existing?.id) {
          seedSourceId = existing.id;
          return;
        }

        cy.request({
          method: 'POST',
          url: `${apiUrl()}/api/sources`,
          failOnStatusCode: false,
          body: {
            name: CYPRESS_PIPELINE_SOURCE_NAME,
            description: 'Cypress pipeline E2E source',
            type: 'io.debezium.connector.postgresql.PostgresConnector',
            schema: 'dummy',
            vaults: [],
            connection: { id: postgresConn!.id },
            config: {
              'topic.prefix': 'cypress.pipeline',
              'schema.include.list': 'inventory',
            },
          },
        }).then((createResponse) => {
          expect(
            [200, 201, 202, 409],
            `source seed status for "${CYPRESS_PIPELINE_SOURCE_NAME}"`
          ).to.include(createResponse.status);
          const created = createResponse.body as { id?: number };
          if (created?.id) {
            seedSourceId = created.id;
            return;
          }
          cy.request({
            method: 'GET',
            url: `${apiUrl()}/api/sources`,
            failOnStatusCode: false,
          }).then((reload) => {
            const list = Array.isArray(reload.body)
              ? (reload.body as { id?: number; name?: string }[])
              : [];
            const found = list.find((s) => s.name === CYPRESS_PIPELINE_SOURCE_NAME);
            void expect(found?.id).to.exist;
            seedSourceId = found!.id!;
          });
        });
      });
    });
  };

  const ensureCypressPipelineDestination = () => {
    cy.request({
      method: 'GET',
      url: `${apiUrl()}/api/connections`,
      failOnStatusCode: false,
    }).then((connResponse) => {
      const connections = Array.isArray(connResponse.body)
        ? (connResponse.body as { id?: number; name?: string }[])
        : [];
      const kafkaConn = connections.find((c) => c.name === TEST_KAFKA_CONNECTION_NAME);
      void expect(kafkaConn?.id, `connection "${TEST_KAFKA_CONNECTION_NAME}"`).to.exist;

      cy.request({
        method: 'GET',
        url: `${apiUrl()}/api/destinations`,
        failOnStatusCode: false,
      }).then((destResponse) => {
        const destinations = Array.isArray(destResponse.body)
          ? (destResponse.body as { id?: number; name?: string }[])
          : [];
        const existing = destinations.find((d) => d.name === CYPRESS_PIPELINE_DESTINATION_NAME);
        if (existing?.id) {
          seedDestinationId = existing.id;
          return;
        }

        cy.request({
          method: 'POST',
          url: `${apiUrl()}/api/destinations`,
          failOnStatusCode: false,
          body: {
            name: CYPRESS_PIPELINE_DESTINATION_NAME,
            description: 'Cypress pipeline E2E destination',
            type: 'io.debezium.server.kafka.KafkaChangeConsumer',
            schema: 'dummy',
            vaults: [],
            connection: { id: kafkaConn!.id },
            config: {
              'producer.key.serializer':
                'org.apache.kafka.common.serialization.StringSerializer',
              'producer.value.serializer':
                'org.apache.kafka.common.serialization.StringSerializer',
            },
          },
        }).then((createResponse) => {
          expect(
            [200, 201, 202, 409],
            `destination seed status for "${CYPRESS_PIPELINE_DESTINATION_NAME}"`
          ).to.include(createResponse.status);
          const created = createResponse.body as { id?: number };
          if (created?.id) {
            seedDestinationId = created.id;
            return;
          }
          cy.request({
            method: 'GET',
            url: `${apiUrl()}/api/destinations`,
            failOnStatusCode: false,
          }).then((reload) => {
            const list = Array.isArray(reload.body)
              ? (reload.body as { id?: number; name?: string }[])
              : [];
            const found = list.find((d) => d.name === CYPRESS_PIPELINE_DESTINATION_NAME);
            void expect(found?.id).to.exist;
            seedDestinationId = found!.id!;
          });
        });
      });
    });
  };

  before(() => {
    cy.waitForBackend();
    ensureConnection(TEST_POSTGRES_CONNECTION_NAME, {
      type: 'POSTGRESQL',
      name: TEST_POSTGRES_CONNECTION_NAME,
      config: {
        hostname: 'postgresql',
        port: 5426,
        username: 'debezium',
        password: 'debezium',
        database: 'debezium',
      },
    });
    ensureConnection(TEST_KAFKA_CONNECTION_NAME, {
      type: 'KAFKA',
      name: TEST_KAFKA_CONNECTION_NAME,
      config: {
        'bootstrap.servers': 'localhost:9092',
      },
    });
    ensureCypressPipelineSource();
    ensureCypressPipelineDestination();
    cy.then(() => {
      expect(seedSourceId, 'seed source id').to.be.a('number');
      expect(seedDestinationId, 'seed destination id').to.be.a('number');
    });
  });

  beforeEach(() => {
    cy.waitForBackend();
  });

  const openDesignerFromList = () => {
    cy.visitWithTourDisabled('/pipeline');
    cy.get('[data-tour="add-pipeline"]', { timeout: 30000 }).first().click();
    cy.url({ timeout: 30000 }).should('include', '/pipeline/pipeline_designer');
  };

  const selectSourceInDesigner = () => {
    cy.get('.pipeline_designer', { timeout: 30000 })
      .contains('button', 'Source')
      .click();
    cy.get('#modal-source-body-with-description', { timeout: 30000 }).should('be.visible');
    cy.get(SOURCE_TABLE, { timeout: 30000 })
      .contains('tr', CYPRESS_PIPELINE_SOURCE_NAME)
      .click();
  };

  const selectDestinationInDesigner = () => {
    cy.get('.pipeline_designer', { timeout: 30000 })
      .contains('button', 'Destination')
      .click();
    cy.get('#modal-box-body-destination-with-description', { timeout: 30000 }).should(
      'be.visible'
    );
    cy.get(DESTINATION_TABLE, { timeout: 30000 })
      .contains('tr', CYPRESS_PIPELINE_DESTINATION_NAME)
      .click();
  };

  const openConfigureFromDesigner = () => {
    cy.get('[data-tour="configure-pipeline-btn"]', { timeout: 30000 })
      .should('not.be.disabled')
      .click();
    cy.url({ timeout: 30000 }).should('match', /\/pipeline\/pipeline_designer\/create_pipeline/);
    cy.url().should('include', `sourceId=${seedSourceId}`);
    cy.url().should('include', `destinationId=${seedDestinationId}`);
  };

  const fillMinimalConfigureForm = (pipelineName: string) => {
    cy.get('#pipeline-name', { timeout: 30000 })
      .should('be.visible')
      .clear({ force: true })
      .type(pipelineName, { force: true });
    cy.get('#description')
      .clear({ force: true })
      .type('Cypress pipeline E2E', { force: true });
    cy.get('#log-level', { timeout: 30000 }).select('INFO');
  };

  const createPipelineViaDesigner = (pipelineName: string) => {
    openDesignerFromList();
    selectSourceInDesigner();
    selectDestinationInDesigner();
    openConfigureFromDesigner();
    fillMinimalConfigureForm(pipelineName);
    cy.contains('button', 'Create pipeline').click();
  };

  const createPipelineViaApi = (pipelineName: string) => {
    cy.request({
      method: 'POST',
      url: `${apiUrl()}/api/pipelines`,
      failOnStatusCode: false,
      body: {
        name: pipelineName,
        description: 'Cypress pipeline API seed',
        source: { id: seedSourceId, name: CYPRESS_PIPELINE_SOURCE_NAME },
        destination: { id: seedDestinationId, name: CYPRESS_PIPELINE_DESTINATION_NAME },
        transforms: [],
        logLevel: 'INFO',
        logLevels: {},
      },
    }).then((response) => {
      expect(
        [200, 201, 202, 409],
        `pipeline create status for "${pipelineName}"`
      ).to.include(response.status);
    });
  };

  describe('Pipeline list', () => {
    it('should display pipeline list or welcome empty state', () => {
      cy.intercept('GET', /\/api\/pipelines\/?$/).as('getPipelines');
      cy.visitWithTourDisabled('/pipeline');
      cy.wait('@getPipelines').its('response.statusCode').should('eq', 200);
      cy.url().should('include', '/pipeline');
      cy.get('body').then(($body) => {
        if ($body.find(PIPELINE_TABLE).length > 0) {
          cy.contains('Name').should('be.visible');
          cy.contains('Source').should('be.visible');
          cy.contains('Destination').should('be.visible');
          cy.get('[data-tour="add-pipeline"]').should('be.visible');
        } else {
          cy.contains('Welcome to Stage').should('be.visible');
          cy.contains('button', 'Create your first pipeline').should('be.visible');
        }
      });
    });

    it('should open pipeline designer from add pipeline action', () => {
      openDesignerFromList();
      cy.contains('Pipeline designer').should('be.visible');
      cy.get('[data-tour="configure-pipeline-btn"]').should('be.disabled');
    });

    it('should filter pipelines by search and clear empty results', () => {
      const pipelineName = `cypress-search-${Date.now()}`;
      createPipelineViaApi(pipelineName);
      cy.visitWithTourDisabled('/pipeline');
      cy.get(PIPELINE_TABLE, { timeout: 30000 }).should('exist');
      cy.get(LIST_SEARCH).type(pipelineName);
      cy.wait(900);
      cy.get(`${PIPELINE_TABLE} tbody tr`).should('have.length', 1);
      cy.get(`${PIPELINE_TABLE} tbody tr`).first().should('contain', pipelineName);

      cy.get(LIST_SEARCH).clear({ force: true });
      cy.get(LIST_SEARCH).type('xxx-no-match-xxx');
      cy.wait(900);
      cy.contains('No matching pipeline is present.').should('be.visible');
      cy.contains('button', 'Clear search').click();
      cy.get(LIST_SEARCH).should('have.value', '');
    });

    it('should navigate to pipeline overview from list name link', () => {
      const pipelineName = `cypress-overview-nav-${Date.now()}`;
      createPipelineViaApi(pipelineName);
      cy.visitWithTourDisabled('/pipeline');
      cy.get(PIPELINE_TABLE, { timeout: 30000 }).should('exist');
      cy.get(`${PIPELINE_TABLE} tbody tr`).contains('button', pipelineName).click();
      cy.url({ timeout: 30000 }).should('match', /\/pipeline\/\d+\/overview/);
      cy.contains(pipelineName).should('be.visible');
    });
  });

  describe('Pipeline designer', () => {
    beforeEach(() => {
      cy.visitWithTourDisabled('/pipeline/pipeline_designer');
    });

    it('should keep configure disabled until source and destination are selected', () => {
      cy.get('[data-tour="configure-pipeline-btn"]').should('be.disabled');
      selectSourceInDesigner();
      cy.get('[data-tour="configure-pipeline-btn"]').should('be.disabled');
      selectDestinationInDesigner();
      cy.get('[data-tour="configure-pipeline-btn"]').should('not.be.disabled');
    });

    it('should navigate to configure page after selecting source and destination', () => {
      selectSourceInDesigner();
      selectDestinationInDesigner();
      openConfigureFromDesigner();
      cy.contains('Pipeline configuration').should('be.visible');
      cy.get('#pipeline-name').should('be.visible');
      cy.get('#log-level').should('exist');
      cy.contains('button', 'Create pipeline').should('be.visible');
    });
  });

  describe('Create pipeline', () => {
    it('should validate required pipeline name on configure form', () => {
      openDesignerFromList();
      selectSourceInDesigner();
      selectDestinationInDesigner();
      openConfigureFromDesigner();
      cy.get('#pipeline-name').clear({ force: true });
      cy.contains('button', 'Create pipeline').click();
      cy.get('#pipeline-name').should('have.attr', 'aria-invalid', 'true');
    });

    it('should successfully create a pipeline through the designer', () => {
      const pipelineName = `cypress-pipeline-${Date.now()}`;
      cy.intercept('POST', /\/api\/pipelines\/?(\?|$)/i).as('createPipeline');
      createPipelineViaDesigner(pipelineName);
      cy.wait('@createPipeline').its('response.statusCode').should('be.oneOf', [200, 201, 202]);
      cy.contains(/creation successful/i, { timeout: 20000 }).should('be.visible');
      cy.url({ timeout: 30000 }).should('include', '/pipeline');
      cy.url().should('not.include', '/create_pipeline');
      cy.get(PIPELINE_TABLE, { timeout: 30000 }).contains(pipelineName).should('exist');
    });

    it('should handle API errors when creating a pipeline', () => {
      cy.intercept('POST', /\/api\/pipelines\/?(\?|$)/i, {
        statusCode: 500,
        body: { error: 'Internal server error' },
      }).as('createPipelineError');
      const pipelineName = `cypress-pipeline-error-${Date.now()}`;
      createPipelineViaDesigner(pipelineName);
      cy.contains(/creation failed|Failed to create/i, { timeout: 20000 }).should('be.visible');
    });
  });

  describe('Pipeline details', () => {
    it('should display pipeline detail tabs', () => {
      const pipelineName = `cypress-details-${Date.now()}`;
      createPipelineViaApi(pipelineName);
      cy.visitWithTourDisabled('/pipeline');
      cy.get(`${PIPELINE_TABLE} tbody tr`).contains('button', pipelineName).click();
      cy.url().should('match', /\/pipeline\/\d+\/overview/);
      cy.contains('Overview').should('be.visible');
      cy.contains('Pipeline logs').should('be.visible');
      cy.contains('Edit pipeline').should('be.visible');
    });

    it('should navigate to logs tab from row actions', () => {
      const pipelineName = `cypress-logs-${Date.now()}`;
      createPipelineViaApi(pipelineName);
      cy.visitWithTourDisabled('/pipeline');
      cy.get(`${PIPELINE_TABLE} tbody tr`)
        .contains('tr', pipelineName)
        .find('td[data-label="Actions"] button')
        .click();
      cy.contains('View logs').click();
      cy.url({ timeout: 30000 }).should('match', /\/pipeline\/\d+\/logs/);
    });
  });

  describe('Delete pipeline', () => {
    it('should show confirmation dialog and require exact pipeline name', () => {
      const pipelineName = `cypress-delete-dialog-${Date.now()}`;
      createPipelineViaApi(pipelineName);
      cy.visitWithTourDisabled('/pipeline');
      cy.get(`${PIPELINE_TABLE} tbody tr`)
        .contains('tr', pipelineName)
        .find('td[data-label="Actions"] button')
        .click();
      cy.contains('Delete').click();
      cy.get('.pf-v6-c-modal-box').should('be.visible');
      cy.get('#delete-name').should('exist');
      cy.get('.pf-v6-c-modal-box').contains('button', 'Confirm').should('be.disabled');
      cy.get('#delete-name').type('wrong-name');
      cy.get('.pf-v6-c-modal-box').contains('button', 'Confirm').should('be.disabled');
    });

    it('should successfully delete a pipeline', () => {
      const pipelineName = `cypress-delete-${Date.now()}`;
      createPipelineViaApi(pipelineName);
      cy.visitWithTourDisabled('/pipeline');
      cy.get(`${PIPELINE_TABLE} tbody tr`).contains('tr', pipelineName).should('exist');
      cy.get(`${PIPELINE_TABLE} tbody tr`)
        .contains('tr', pipelineName)
        .find('td[data-label="Actions"] button')
        .click();
      cy.contains('Delete').click();
      cy.get('#delete-name').type(pipelineName);
      cy.get('.pf-v6-c-modal-box').contains('button', 'Confirm').click();
      cy.contains('Delete successful', { timeout: 20000 }).should('be.visible');
      cy.get(`${PIPELINE_TABLE} tbody tr`).contains(pipelineName).should('not.exist');
    });
  });
});
