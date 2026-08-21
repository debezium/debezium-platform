/**
 * Pipeline E2E — MVP
 * Self-seeds connections, source, and destination via API (no cross-spec ordering).
 * Create flow uses the UI designer (source/destination modals → configure → submit).
 */
describe('Pipeline Management', () => {
  // Run-scoped suffix guarantees fresh, non-colliding seed data on every CI run
  // (the backend persists across runs, so fixed names would accumulate duplicates
  // and cause the wrong row to be clicked in the UI — Cypress `.contains()` matches
  // substrings, so a stale "cypress-pipeline-source-alt" row would also satisfy a
  // search for "cypress-pipeline-source").
  const RUN_ID = Date.now();
  const TEST_POSTGRES_CONNECTION_NAME = 'test-postgres-connection';
  const TEST_KAFKA_CONNECTION_NAME = 'test-kafka-connection';
  const CYPRESS_PIPELINE_SOURCE_NAME = `cypress-pipeline-source-${RUN_ID}`;
  const CYPRESS_PIPELINE_SOURCE_ALT_NAME = `cypress-pipeline-source-alt-${RUN_ID}`;
  const CYPRESS_PIPELINE_DESTINATION_NAME = `cypress-pipeline-destination-${RUN_ID}`;
  const CYPRESS_TRANSFORM_NAME = `cypress-pipeline-transform-${RUN_ID}`;

  const PIPELINE_TABLE = 'table[aria-label="Pipeline Table"]';
  const LIST_SEARCH = 'input[placeholder^="Find by name"]';
  const SOURCE_TABLE = 'table[aria-label="source table"]';
  const DESTINATION_TABLE = 'table[aria-label="destination table"]';
  const TRANSFORM_MODAL_TABLE = 'table[aria-label="transform table"]';

  /** Escapes regex metacharacters so a name can be used in an exact-match RegExp. */
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /**
   * Clicks the row whose name cell text is *exactly* `name` — avoids Cypress
   * `.contains()` substring matches (e.g. "source" matching "source-alt") which
   * previously caused the wrong row to be selected.
   */
  const selectRowByExactName = (tableSelector: string, name: string) => {
    cy.get(tableSelector, { timeout: 30000 })
      .contains('td', new RegExp(`^${escapeRegExp(name)}$`))
      .click();
  };

  let seedSourceId: number;
  let seedDestinationId: number;

  const apiUrl = () => Cypress.env('apiUrl');

  const resolveSeedIdsFromApi = () => {
    cy.request({
      method: 'GET',
      url: `${apiUrl()}/api/sources`,
      failOnStatusCode: false,
    }).then((res) => {
      const sources = Array.isArray(res.body)
        ? (res.body as { id?: number; name?: string }[])
        : [];
      const primary = sources.find((s) => s.name === CYPRESS_PIPELINE_SOURCE_NAME);
      const alt = sources.find((s) => s.name === CYPRESS_PIPELINE_SOURCE_ALT_NAME);
      void expect(primary?.id, `source "${CYPRESS_PIPELINE_SOURCE_NAME}"`).to.exist;
      void expect(alt?.id, `source "${CYPRESS_PIPELINE_SOURCE_ALT_NAME}"`).to.exist;
      seedSourceId = primary!.id!;
    });
    cy.request({
      method: 'GET',
      url: `${apiUrl()}/api/destinations`,
      failOnStatusCode: false,
    }).then((res) => {
      const destinations = Array.isArray(res.body)
        ? (res.body as { id?: number; name?: string }[])
        : [];
      const dest = destinations.find((d) => d.name === CYPRESS_PIPELINE_DESTINATION_NAME);
      void expect(dest?.id, `destination "${CYPRESS_PIPELINE_DESTINATION_NAME}"`).to.exist;
      seedDestinationId = dest!.id!;
    });
  };

  const assertConfigureUrlMatchesSeededSelections = () => {
    cy.request({
      method: 'GET',
      url: `${apiUrl()}/api/sources`,
      failOnStatusCode: false,
    }).then((res) => {
      const sources = Array.isArray(res.body)
        ? (res.body as { id?: number; name?: string }[])
        : [];
      const source = sources.find((s) => s.name === CYPRESS_PIPELINE_SOURCE_NAME);
      void expect(source?.id).to.exist;
      cy.url().should('include', `sourceId=${source!.id}`);
    });
    cy.request({
      method: 'GET',
      url: `${apiUrl()}/api/destinations`,
      failOnStatusCode: false,
    }).then((res) => {
      const destinations = Array.isArray(res.body)
        ? (res.body as { id?: number; name?: string }[])
        : [];
      const dest = destinations.find((d) => d.name === CYPRESS_PIPELINE_DESTINATION_NAME);
      void expect(dest?.id).to.exist;
      cy.url().should('include', `destinationId=${dest!.id}`);
    });
  };

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
    ensurePipelineSourceNamed(CYPRESS_PIPELINE_SOURCE_NAME, 'cypress.pipeline', (id) => {
      seedSourceId = id;
    });
  };

  const ensureCypressPipelineSourceAlt = () => {
    ensurePipelineSourceNamed(
      CYPRESS_PIPELINE_SOURCE_ALT_NAME,
      'cypress.pipeline.alt',
      () => undefined
    );
  };

  const ensurePipelineSourceNamed = (
    sourceName: string,
    topicPrefix: string,
    onId: (id: number) => void
  ) => {
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
        const existing = sources.find((s) => s.name === sourceName);
        if (existing?.id) {
          onId(existing.id);
          return;
        }

        cy.request({
          method: 'POST',
          url: `${apiUrl()}/api/sources`,
          failOnStatusCode: false,
          body: {
            name: sourceName,
            description: `Cypress pipeline E2E source (${sourceName})`,
            type: 'io.debezium.connector.postgresql.PostgresConnector',
            schema: 'dummy',
            vaults: [],
            connection: { id: postgresConn!.id },
            config: {
              'topic.prefix': topicPrefix,
              'schema.include.list': 'inventory',
            },
          },
        }).then((createResponse) => {
          expect(
            [200, 201, 202, 409],
            `source seed status for "${sourceName}"`
          ).to.include(createResponse.status);
          const created = createResponse.body as { id?: number };
          if (created?.id) {
            onId(created.id);
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
            const found = list.find((s) => s.name === sourceName);
            void expect(found?.id).to.exist;
            onId(found!.id!);
          });
        });
      });
    });
  };

  const ensureCypressTransform = () => {
    cy.request({
      method: 'GET',
      url: `${apiUrl()}/api/transforms`,
      failOnStatusCode: false,
    }).then((response) => {
      const transforms = Array.isArray(response.body)
        ? (response.body as { id?: number; name?: string }[])
        : [];
      if (transforms.some((t) => t.name === CYPRESS_TRANSFORM_NAME)) {
        return;
      }

      cy.request({
        method: 'POST',
        url: `${apiUrl()}/api/transforms`,
        failOnStatusCode: false,
        body: {
          name: CYPRESS_TRANSFORM_NAME,
          description: 'Cypress pipeline E2E transform',
          type: 'io.debezium.transforms.ExtractNewRecordState',
          schema: 'dummy',
          vaults: [],
          config: {},
        },
      }).then((createResponse) => {
        expect(
          [200, 201, 202, 409],
          `transform seed status for "${CYPRESS_TRANSFORM_NAME}"`
        ).to.include(createResponse.status);
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
    ensureCypressPipelineSourceAlt();
    ensureCypressPipelineDestination();
    ensureCypressTransform();
    resolveSeedIdsFromApi();
  });

  beforeEach(() => {
    cy.waitForBackend();
    resolveSeedIdsFromApi();
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
    selectRowByExactName(SOURCE_TABLE, CYPRESS_PIPELINE_SOURCE_NAME);
  };

  const selectDestinationInDesigner = () => {
    cy.get('.pipeline_designer', { timeout: 30000 })
      .contains('button', 'Destination')
      .click();
    cy.get('#modal-box-body-destination-with-description', { timeout: 30000 }).should(
      'be.visible'
    );
    selectRowByExactName(DESTINATION_TABLE, CYPRESS_PIPELINE_DESTINATION_NAME);
  };

  const openTransformModalInDesigner = () => {
    cy.get('.pipeline_designer', { timeout: 30000 })
      .contains('button', 'Transform')
      .should('not.be.disabled')
      .click();
    cy.get('#modal-transform-body-with-description', { timeout: 30000 }).should('be.visible');
  };

  const selectSeededTransformInModal = () => {
    selectRowByExactName(TRANSFORM_MODAL_TABLE, CYPRESS_TRANSFORM_NAME);
    cy.get('#modal-transform-body-with-description').should('not.exist');
  };

  const changeSourceInDesigner = (sourceName: string) => {
    cy.get('.editDataNodeSource', { timeout: 30000 }).click({ force: true });
    cy.get('#modal-source-body-with-description', { timeout: 30000 }).should('be.visible');
    selectRowByExactName(SOURCE_TABLE, sourceName);
  };

  const openConfigureFromDesigner = () => {
    cy.get('[data-tour="configure-pipeline-btn"]', { timeout: 30000 })
      .should('not.be.disabled')
      .click();
    cy.url({ timeout: 30000 }).should('match', /\/pipeline\/pipeline_designer\/create_pipeline/);
    assertConfigureUrlMatchesSeededSelections();
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

    it('should keep transform selection disabled until a source is selected', () => {
      cy.get('.pipeline_designer', { timeout: 30000 })
        .contains('button', 'Transform')
        .should('be.disabled');
    });

    it('should enable transform selection after source is chosen', () => {
      selectSourceInDesigner();
      cy.get('.pipeline_designer')
        .contains('button', 'Transform')
        .should('not.be.disabled');
    });

    it('should open transform modal after source is selected', () => {
      selectSourceInDesigner();
      openTransformModalInDesigner();
      cy.get('#modal-transform-body-with-description', { timeout: 30000 }).should(
        'be.visible'
      );
      cy.get('#select-existing-transform').should('exist');
      cy.get(TRANSFORM_MODAL_TABLE).should('exist');
    });

    it('should add a transform from the selection list', () => {
      selectSourceInDesigner();
      openTransformModalInDesigner();
      selectSeededTransformInModal();
      cy.get('.react-flow__node[data-id="transform_group"]', { timeout: 30000 }).should(
        'exist'
      );
      cy.get('.pipeline_designer').should('contain', CYPRESS_TRANSFORM_NAME);
    });

    it('should clear transforms when the source is changed', () => {
      selectSourceInDesigner();
      openTransformModalInDesigner();
      selectSeededTransformInModal();
      cy.get('.react-flow__node[data-id="transform_group"]', { timeout: 30000 }).should(
        'exist'
      );
      changeSourceInDesigner(CYPRESS_PIPELINE_SOURCE_ALT_NAME);
      cy.get('.react-flow__node[data-id="transform_group"]').should('not.exist');
      cy.get('.react-flow__node[data-id="transform_selector"]', { timeout: 30000 }).should(
        'exist'
      );
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
      cy.contains('Actions').should('be.visible');
      // Monitoring is disabled via feature-flags
      // cy.contains('Monitoring').should('be.visible');
      cy.contains('Logs').should('be.visible');
      cy.contains('Edit').should('be.visible');
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

    it('should show FAILED status cell with a Failed label and link in pipeline list', () => {
      // Seed a pipeline via API then stub the list response to mark it FAILED
      const pipelineName = `cypress-failed-status-${Date.now()}`;
      createPipelineViaApi(pipelineName);

      cy.intercept('GET', /\/api\/pipelines\/?$/, (req) => {
        req.continue((res) => {
          const pipelines = Array.isArray(res.body) ? res.body as Record<string, unknown>[] : [];
          const idx = pipelines.findIndex((p) => p['name'] === pipelineName);
          if (idx !== -1) {
            pipelines[idx] = { ...pipelines[idx], status: 'FAILED', errorMessage: 'Simulated failure' };
          }
          res.body = pipelines;
        });
      }).as('getPipelinesWithFailed');

      cy.visitWithTourDisabled('/pipeline');
      cy.wait('@getPipelinesWithFailed');

      cy.get(`${PIPELINE_TABLE} tbody tr`)
        .contains('tr', pipelineName)
        .within(() => {
          // The "Failed" link button must exist in the DOM (PF table cells use overflow:hidden
          // which clips child content, so we assert existence rather than visibility)
          cy.contains('button', 'Failed').should('exist');
          cy.get('.pf-v6-c-label').should('exist');
        });
    });

    it('should navigate to pipeline detail when clicking the FAILED status link', () => {
      const pipelineName = `cypress-failed-nav-${Date.now()}`;
      createPipelineViaApi(pipelineName);

      cy.intercept('GET', /\/api\/pipelines\/?$/, (req) => {
        req.continue((res) => {
          const pipelines = Array.isArray(res.body) ? res.body as Record<string, unknown>[] : [];
          const idx = pipelines.findIndex((p) => p['name'] === pipelineName);
          if (idx !== -1) {
            pipelines[idx] = { ...pipelines[idx], status: 'FAILED', errorMessage: 'Simulated failure' };
          }
          res.body = pipelines;
        });
      }).as('getPipelinesFailedNav');

      cy.visitWithTourDisabled('/pipeline');
      cy.wait('@getPipelinesFailedNav');

      cy.get(`${PIPELINE_TABLE} tbody tr`)
        .contains('tr', pipelineName)
        .contains('button', 'Failed')
        .click();

      cy.url({ timeout: 30000 }).should('match', /\/pipeline\/\d+\/overview/);
    });

    it('should display expandable error alert on detail page when pipeline has an errorMessage', () => {
      // ResizeObserver notifications fired by PF layout are benign browser noise — ignore them
      cy.on('uncaught:exception', (err) => {
        if (err.message.includes('ResizeObserver')) return false;
      });

      const pipelineName = `cypress-failed-detail-${Date.now()}`;
      createPipelineViaApi(pipelineName);

      // Navigate to the list to find the created pipeline id
      cy.visitWithTourDisabled('/pipeline');
      cy.get(`${PIPELINE_TABLE} tbody tr`, { timeout: 30000 }).contains('button', pipelineName).click();
      cy.url({ timeout: 30000 }).should('match', /\/pipeline\/(\d+)\/overview/);

      cy.url().then((url) => {
        const match = url.match(/\/pipeline\/(\d+)\/overview/);
        const pipelineId = match?.[1];
        expect(pipelineId).to.be.a("string");

        // Stub the single pipeline GET to inject an errorMessage
        cy.intercept('GET', new RegExp(`/api/pipelines/${pipelineId}$`), (req) => {
          req.continue((res) => {
            res.body = {
              ...(res.body as Record<string, unknown>),
              status: 'FAILED',
              errorMessage: 'Connection timeout to source database',
            };
          });
        }).as('getPipelineDetail');

        cy.visit(`/pipeline/${pipelineId}/overview`);
        cy.wait('@getPipelineDetail');

        // The expandable danger alert should be present
        cy.get('.pf-v6-c-alert.pf-m-danger, [class*="pf-v6-c-alert"][class*="pf-m-danger"]', { timeout: 10000 })
          .should('be.visible');

        // The alert body is initially collapsed — click the toggle to expand it
        cy.get('.pf-v6-c-alert.pf-m-danger .pf-v6-c-alert__toggle button, [class*="pf-v6-c-alert"][class*="pf-m-danger"] button[aria-expanded]')
          .first()
          .click();
        cy.contains('Connection timeout to source database').should('be.visible');
      });
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
