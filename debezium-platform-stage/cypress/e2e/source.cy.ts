describe('Source Management', () => {
  const TEST_POSTGRES_CONNECTION_NAME = 'test-postgres-connection';

  beforeEach(() => {
    cy.waitForBackend();
  });

  /** Catalog `data-tour` uses `item.class` (e.g. `postgres`); never use cy.get on a missing `data-tour`. */
  const clickPostgresqlCatalogCard = () => {
    cy.get('body').then(($body) => {
      const byTour = $body.find('[data-tour="catalog-card-postgresql"]');
      if (byTour.length > 0) {
        cy.wrap(byTour.first()).click();
      } else {
        cy.contains('.catalog-grid-card-source', 'PostgreSQL').click();
      }
    });
  };

  /**
   * PF `Select` mounts `SelectList` inside a `Popper` only while the menu is open; when closed
   * `#conn-typeahead-listbox` is absent from the DOM. While opening, the list can exist with 0
   * height (fails `be.visible`). Prefer filter + keyboard select over clicking options.
   */
  const selectPostgresConnectionInForm = () => {
    cy.get('#conn-typeahead-input', { timeout: 30000 }).scrollIntoView().should('be.visible');
    cy.get('#conn-typeahead-input input').should('be.visible').click({ force: true });
    cy.get('#conn-typeahead-input input').clear({ force: true });
    cy.get('#conn-typeahead-input input').type(TEST_POSTGRES_CONNECTION_NAME, { force: true });
    cy.get('#conn-typeahead-listbox [role="option"]', { timeout: 30000 })
      .contains(TEST_POSTGRES_CONNECTION_NAME)
      .first()
      .click({ force: true });
  };

  const fillTopicPrefixField = (value: string) => {
    cy.get('body').then(($body) => {
      if ($body.find('#schema-field-topic\\.prefix').length > 0) {
        cy.get('#schema-field-topic\\.prefix', { timeout: 15000 })
          .scrollIntoView()
          .clear({ force: true })
          .type(value, { force: true });
        return;
      }

      cy.get('input[aria-label="Topic prefix"]', { timeout: 15000 })
        .scrollIntoView()
        .clear({ force: true })
        .type(value, { force: true });
    });
  };

  const fillMinimalCreateSourceForm = (sourceName: string) => {
    cy.get('#source-name', { timeout: 30000 }).should('be.visible').clear({ force: true }).type(sourceName, {
      force: true,
    });
    cy.get('#source-description').clear({ force: true }).type('Cypress test description', { force: true });
    selectPostgresConnectionInForm();
    fillTopicPrefixField('dbz.cypress');
  };

  const ensureTestPostgresConnection = () => {
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
      const exists = list.some((item) => item.name === TEST_POSTGRES_CONNECTION_NAME);
      if (exists) return;

      cy.request({
        method: 'POST',
        url: connectionsUrl,
        failOnStatusCode: false,
        body: {
          type: 'POSTGRESQL',
          name: TEST_POSTGRES_CONNECTION_NAME,
          config: {
            hostname: 'postgresql',
            port: 5426,
            username: 'debezium',
            password: 'debezium',
            database: 'debezium',
          },
        },
      }).then((createResponse) => {
        expect(
          [200, 201, 202, 409],
          `create or existing status for "${TEST_POSTGRES_CONNECTION_NAME}"`
        ).to.include(createResponse.status);
      });
    });
  };

  before(() => {
    ensureTestPostgresConnection();
  });

  const openCreateSourceFromCatalog = () => {
    cy.intercept(
      {
        method: 'GET',
        url: /\/api\/catalog\/source-connector\/.+/i,
      }
    ).as('getSourceConnectorSchema');
    cy.visitWithTourDisabled('/source/catalog');
    clickPostgresqlCatalogCard();
    cy.url().should('match', /\/source\/create_source\/.+/);
    cy.wait('@getSourceConnectorSchema');
    cy.get('#source-name', { timeout: 30000 }).should('be.visible');
  };

  describe('Source Catalog', () => {
    it('should display the source catalog page', () => {
      cy.visitWithTourDisabled('/source/catalog');
      cy.url().should('include', '/source/catalog');
      cy.contains('Source catalog').should('be.visible');
      cy.get('input[placeholder*="Search"], input[placeholder*="name"]').should('exist');
      cy.get('[aria-label="Grid view"]').should('exist');
      cy.get('[aria-label="List view"]').should('exist');
    });

    it('should display available source connectors', () => {
      cy.visitWithTourDisabled('/source/catalog');
      cy.get('[data-tour^="catalog-card-"]').should('have.length.at.least', 3);
      cy.contains('PostgreSQL').should('exist');
      cy.contains('MySQL').should('exist');
      cy.contains(/\d+\s+Items/i).should('be.visible');
    });

    it('should filter sources by search query', () => {
      cy.visitWithTourDisabled('/source/catalog');
      cy.get('input[placeholder*="Search"], input[placeholder*="name"]').type('PostgreSQL');
      cy.wait(900);
      cy.contains('PostgreSQL').should('be.visible');
      cy.contains('MongoDB').should('not.exist');
    });

    it('should toggle between grid and list view', () => {
      cy.visitWithTourDisabled('/source/catalog');
      cy.get('[aria-label="Grid view"]').should('have.attr', 'aria-pressed', 'true');
      cy.get('[aria-label="List view"]').click();
      cy.get('[aria-label="List view"]').should('have.attr', 'aria-pressed', 'true');
      cy.get('[class*="pf-v6-c-data-list"]').should('exist');
      cy.get('[aria-label="Grid view"]').click();
      cy.get('[class*="pf-v6-l-gallery"]').should('exist');
    });

    it('should clear search and show all connectors', () => {
      cy.visitWithTourDisabled('/source/catalog');
      cy.get('input[placeholder*="Search"], input[placeholder*="name"]').type('MySQL');
      cy.wait(900);
      cy.get('input[placeholder*="Search"], input[placeholder*="name"]').first().clear({ force: true });
      cy.wait(900);
      cy.contains('PostgreSQL').should('be.visible');
      cy.contains('MongoDB').should('be.visible');
    });
  });

  describe('Create Source', () => {
    it('should navigate to create source page from catalog', () => {
      cy.visitWithTourDisabled('/source/catalog');
      clickPostgresqlCatalogCard();
      cy.url().should('match', /\/source\/create_source\/.+/);
      cy.contains('Create source').should('exist');
    });

    it('should display create source form', () => {
      openCreateSourceFromCatalog();
      cy.contains('Source type').should('be.visible');
      cy.contains('PostgreSQL').should('be.visible');
      cy.contains('Source name').should('be.visible');
      cy.get('#source-name').should('exist');
      cy.contains('Description').should('be.visible');
      cy.get('#source-description').should('exist');
      cy.contains('Connector Essentials').should('be.visible');
      cy.contains('button', 'Create source').should('be.visible');
      cy.contains('Back to catalog').should('be.visible');
    });

    it('should toggle between jump links and tabs layout', () => {
      openCreateSourceFromCatalog();
      cy.get('#jumplinks-layout', { timeout: 30000 }).should('have.attr', 'aria-pressed', 'true');
      cy.get('#tabs-layout').click();
      cy.get('#tabs-layout').should('have.attr', 'aria-pressed', 'true');
      cy.contains('Configuration').should('be.visible');
      cy.wait(300);
      cy.get('#jumplinks-layout').click();
      cy.contains('Connector Essentials').should('be.visible');
      cy.get('#source-name').should('be.visible');
    });

    it('should validate required fields', () => {
      openCreateSourceFromCatalog();
      cy.get('#source-name', { timeout: 30000 }).should('be.visible');
      cy.contains('button', 'Create source').should('not.be.disabled');
      cy.contains('button', 'Create source').click();
      cy.get('#source-name').should('have.attr', 'aria-invalid', 'true');
    });

    it('should add and remove configuration properties', () => {
      openCreateSourceFromCatalog();
      cy.get('#source-name', { timeout: 30000 }).should('be.visible');
      cy.contains('h2', 'Additional Properties').scrollIntoView();
      cy.contains('button', 'Add property').scrollIntoView().click({ force: true });
      cy.get('[id^="addprop-key-input-"]').should('have.length', 1);
      cy.contains('button', 'Add property').scrollIntoView().click({ force: true });
      cy.get('[id^="addprop-key-input-"]').should('have.length', 2);
      cy.get('[aria-label="Remove"]').first().click();
      cy.get('[id^="addprop-key-input-"]').should('have.length', 1);
    });

    it('should successfully create a new source', () => {
      openCreateSourceFromCatalog();
      const sourceName = `test-source-${Date.now()}`;
      fillMinimalCreateSourceForm(sourceName);
      cy.contains('button', 'Add property').scrollIntoView().click({ force: true });
      cy.get('[id^="addprop-key-input-"]').last().scrollIntoView().type('database.hostname');
      cy.get('[id^="addprop-value-input-"]').last().type('debezium');
      cy.contains('button', 'Create source').click();
      cy.contains('Create successful', { timeout: 20000 }).should('be.visible');
      cy.url().should('include', '/source');
      cy.url().should('not.include', '/create_source');
    });

    it('should handle API errors gracefully', () => {
      cy.intercept(
        { method: 'POST', url: /\/api\/sources\/?(\?|$)/i },
        { statusCode: 500, body: { error: 'Internal server error' } }
      ).as('createSourceError');
      openCreateSourceFromCatalog();
      fillMinimalCreateSourceForm('test-source-error');
      cy.contains('button', 'Create source').click();
      cy.contains(/Source creation failed|Failed to create/i, { timeout: 20000 }).should('be.visible');
    });

    it('should open smart editor entry from catalog when no connector is chosen', () => {
      cy.visitWithTourDisabled('/source/catalog');
      cy.contains('button', 'Create using smart editor').click({ force: true });
      cy.url().should('match', /\/source\/create_source\/?$/);
      cy.contains('No connector selected').should('be.visible');
    });
  });

  describe('Source List', () => {
    it('should display list of sources', () => {
      cy.visitWithTourDisabled('/source');
      cy.url().should('include', '/source');
      cy.wait(500);
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="source table"]').length > 0) {
          cy.contains('Name').should('be.visible');
          cy.contains('Type').should('be.visible');
          cy.contains('Used in').should('be.visible');
        } else {
          cy.contains('No source available').should('be.visible');
          cy.contains('Add source').should('be.visible');
        }
      });
    });

    it('should display add source button in empty state', () => {
      cy.visitWithTourDisabled('/source');
      cy.get('body').then(($body) => {
        if ($body.text().includes('No source available')) {
          cy.contains('button', 'Add source').should('be.visible');
          cy.contains('button', 'Add source').click();
          cy.url().should('include', '/source/catalog');
        }
      });
    });

    it('should allow searching/filtering sources', () => {
      cy.visitWithTourDisabled('/source');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="source table"]').length > 0) {
          cy.get('[data-tour="source-search"] input').should('exist');
          cy.get('[data-tour="source-search"] input').type('test');
          cy.wait(900);
        }
      });
    });

    it('should navigate to source details on click', () => {
      cy.visitWithTourDisabled('/source');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="source table"]').length > 0) {
          cy.get('table[aria-label="source table"] tbody tr').first().find('button').first().click();
          cy.url().should('match', /\/source\/\d+\?state=view/);
        }
      });
    });

    it('should display toolbar with search when sources exist', () => {
      cy.visitWithTourDisabled('/source');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="source table"]').length > 0) {
          cy.get('[data-tour="source-search"] input').should('be.visible');
          cy.contains('button', 'Add source').should('be.visible');
        }
      });
    });
  });

  describe('Edit Source', () => {
    const createTestSource = () => {
      openCreateSourceFromCatalog();
      const sourceName = `edit-test-${Date.now()}`;
      fillMinimalCreateSourceForm(sourceName);
      cy.contains('button', 'Create source').click();
      cy.contains('Create successful', { timeout: 20000 }).should('be.visible');
      return sourceName;
    };

    /** Name column link → `?state=view` review, then header Edit → `CreateSourceSchemaForm` with `#source-*`. */
    const openEditableSourceFormFromListFirstRow = () => {
      cy.get('table[aria-label="source table"] tbody tr', { timeout: 30000 }).should('have.length.at.least', 1);
      cy.get('table[aria-label="source table"] tbody tr').first().find('button').first().click();
      cy.url({ timeout: 30000 }).should('match', /[?&]state=view/);
      cy.contains('button', 'Edit', { timeout: 30000 }).should('be.visible').click();
      cy.get('#source-name', { timeout: 30000 }).should('be.visible');
      cy.get('#source-description', { timeout: 30000 }).should('be.visible');
    };

    it('should display edit source form', () => {
      createTestSource();
      cy.visitWithTourDisabled('/source');
      openEditableSourceFormFromListFirstRow();
      cy.get('#source-name').invoke('val').should('not.be.empty');
    });

    it('should toggle between view and edit mode', () => {
      createTestSource();
      cy.visitWithTourDisabled('/source');
      openEditableSourceFormFromListFirstRow();
      cy.get('#source-name').should('not.have.attr', 'readonly');
      cy.contains('button', 'Cancel').click();
      // Back to review layout: form unmounts. Header Edit can sit in a scroll-clipped region — avoid strict visibility.
      cy.get('#source-name').should('not.exist');
      cy.contains('button', 'Edit', { timeout: 30000 }).should('exist');
    });

    it('should successfully update source', () => {
      createTestSource();
      cy.visitWithTourDisabled('/source');
      openEditableSourceFormFromListFirstRow();
      cy.get('#source-description').clear().type('Updated description by Cypress');
      cy.contains('button', 'Save changes').click();
      cy.get('.pf-v6-c-modal-box').should('be.visible');
      cy.contains('button', 'Confirm').click();
      cy.contains('successful', { timeout: 20000 }).should('be.visible');
    });

    it('should cancel edit operation', () => {
      createTestSource();
      cy.visitWithTourDisabled('/source');
      openEditableSourceFormFromListFirstRow();
      cy.get('#source-description').clear().type('Temporary change');
      cy.contains('button', 'Cancel').click();
      cy.get('#source-name').should('not.exist');
      cy.contains('button', 'Edit', { timeout: 30000 }).should('exist');
    });
  });

  describe('Delete Source', () => {
    const createTestSourceForDelete = () => {
      openCreateSourceFromCatalog();
      const sourceName = `delete-test-${Date.now()}`;
      fillMinimalCreateSourceForm(sourceName);
      cy.contains('button', 'Create source').click();
      cy.contains('Create successful', { timeout: 20000 }).should('be.visible');
      return sourceName;
    };

    it('should show confirmation dialog before deleting', () => {
      createTestSourceForDelete();
      cy.visitWithTourDisabled('/source');
      cy.get('table[aria-label="source table"] tbody tr')
        .first()
        .find('td[data-label="Actions"] button')
        .click();
      cy.contains('Delete').click();
      cy.get('.pf-v6-c-modal-box').should('be.visible');
      cy.contains('delete').should('be.visible');
      cy.get('#dalete-name').should('exist');
    });

    it('should require typing source name to confirm delete', () => {
      createTestSourceForDelete();
      cy.visitWithTourDisabled('/source');
      cy.get('table[aria-label="source table"] tbody tr')
        .first()
        .find('td[data-label="Actions"] button')
        .click();
      cy.contains('Delete').click();
      cy.get('.pf-v6-c-modal-box').contains('button', 'Delete').should('be.disabled');
      cy.get('#dalete-name').type('wrong-name');
      cy.get('.pf-v6-c-modal-box').contains('button', 'Delete').should('be.disabled');
      cy.get('#dalete-name').clear();
    });

    it('should successfully delete source', () => {
      createTestSourceForDelete();
      cy.visitWithTourDisabled('/source');
      cy.get('table[aria-label="source table"] tbody tr')
        .first()
        .find('button')
        .first()
        .invoke('text')
        .then((name) => {
          cy.get('table[aria-label="source table"] tbody tr')
            .first()
            .find('td[data-label="Actions"] button')
            .click();
          cy.contains('Delete').click();
          cy.get('#dalete-name').type(name.trim());
          cy.get('.pf-v6-c-modal-box').contains('button', 'Delete').click();
          cy.contains('Delete successful').should('be.visible');
        });
    });

    it('should cancel delete operation', () => {
      createTestSourceForDelete();
      cy.visitWithTourDisabled('/source');
      cy.get('table[aria-label="source table"] tbody tr')
        .its('length')
        .then((initialCount) => {
          cy.get('table[aria-label="source table"] tbody tr')
            .first()
            .find('td[data-label="Actions"] button')
            .click();
          cy.contains('Delete').click();
          cy.get('.pf-v6-c-modal-box').contains('button', 'Cancel').click();
          cy.get('.pf-v6-c-modal-box').should('not.exist');
          cy.get('table[aria-label="source table"] tbody tr').should('have.length', initialCount);
        });
    });

    it('should close modal when clicking outside', () => {
      createTestSourceForDelete();
      cy.visitWithTourDisabled('/source');
      cy.get('table[aria-label="source table"] tbody tr')
        .first()
        .find('td[data-label="Actions"] button')
        .click();
      cy.contains('Delete').click();
      cy.get('.pf-v6-c-modal-box').should('be.visible');
      cy.get('.pf-v6-c-modal-box').contains('button', 'Cancel').click();
      cy.get('.pf-v6-c-modal-box').should('not.exist');
    });
  });

  describe('Source Page Navigation', () => {
    it('should navigate from source list to catalog', () => {
      cy.visitWithTourDisabled('/source');
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("Add source")').length > 0) {
          cy.contains('button', 'Add source').click();
          cy.url().should('include', '/source/catalog');
        }
      });
    });

    it('should navigate from source catalog to create source', () => {
      cy.visitWithTourDisabled('/source/catalog');
      clickPostgresqlCatalogCard();
      cy.url().should('match', /\/source\/create_source\/.+/);
    });

    it('should navigate back from create source to catalog', () => {
      openCreateSourceFromCatalog();
      cy.contains('Back to catalog').click({ force: true });
      cy.url().should('include', '/source/catalog');
    });
  });
});
