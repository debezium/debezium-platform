/**
 * Transform E2E — catalog-driven create form, list, search, delete.
 */
describe('Transform Management', () => {
  const TRANSFORM_TABLE = 'table[aria-label="Transform Table"]';
  const LIST_SEARCH = 'input[placeholder^="Find by name"]';
  const TRANSFORM_CLASS_INPUT = '#transform-class-input';
  /** Preferred Debezium SMT when present in catalog. */
  const DEFAULT_TRANSFORM_TYPE = 'io.debezium.transforms.ExtractNewRecordState';

  const apiUrl = () => Cypress.env('apiUrl');

  type CatalogTransform = { class?: string; name?: string };

  const pickCatalogTransform = (transformations: CatalogTransform[]) => {
    return (
      transformations.find((t) => t.class === DEFAULT_TRANSFORM_TYPE) ??
      transformations.find((t) => t.class?.startsWith('io.debezium.transforms.')) ??
      transformations[0]
    );
  };

  beforeEach(() => {
    cy.waitForBackend();
  });

  const waitForTransformListReady = () => {
    cy.intercept('GET', /\/api\/transforms\/?$/).as('getTransforms');
    cy.visitWithTourDisabled('/transform');
    cy.wait('@getTransforms', { timeout: 30000 });
    cy.get('[data-tour="transform-page"]', { timeout: 30000 }).should('exist');
    cy.get('body', { timeout: 30000 }).should(($body) => {
      const hasTable = $body.find(TRANSFORM_TABLE).length > 0;
      const hasEmpty = /No transform available/i.test($body.text());
      if (!hasTable && !hasEmpty) {
        throw new Error('Expected transform table or empty state');
      }
    });
  };

  const createTransformViaApi = (transformName: string) => {
    cy.request({
      method: 'POST',
      url: `${apiUrl()}/api/transforms`,
      failOnStatusCode: false,
      body: {
        name: transformName,
        description: 'Cypress E2E transform',
        type: DEFAULT_TRANSFORM_TYPE,
        schema: 'dummy',
        vaults: [],
        config: {},
      },
    }).then((res) => {
      expect([200, 201, 202, 409], `create transform "${transformName}"`).to.include(res.status);
    });
  };

  const openCreateTransform = () => {
    cy.intercept('GET', /\/api\/catalog\/?$/).as('getCatalog');
    cy.visitWithTourDisabled('/transform/create_transform');
    cy.wait('@getCatalog', { timeout: 30000 });
    cy.url().should('include', '/transform/create_transform');
    cy.get(TRANSFORM_CLASS_INPUT, { timeout: 30000 }).should('be.visible');
  };

  const selectTransformClassFromDropdown = () => {
    cy.intercept('GET', /\/api\/catalog\/transformation\/.+/i).as('getTransformSchema');

    cy.get('@getCatalog').then((interception) => {
      const transformations =
        interception.response?.body?.components?.transformation ?? [];
      const entry = pickCatalogTransform(transformations);
      void expect(entry, 'catalog transform for UI create').to.exist;

      const label = entry!.name ?? entry!.class ?? '';

      cy.get(TRANSFORM_CLASS_INPUT, { timeout: 30000 })
        .scrollIntoView()
        .should('be.visible');
      cy.get(`${TRANSFORM_CLASS_INPUT} input`).click({ force: true });
      cy.get('#transform-class-listbox', { timeout: 30000 }).should('be.visible');

      cy.contains('#transform-class-listbox .pf-v6-c-menu__item', label, {
        timeout: 10000,
      })
        .should('not.have.attr', 'aria-disabled', 'true')
        .click({ force: true });
    });

    cy.wait('@getTransformSchema', { timeout: 30000 });
  };

  const fillMinimalCreateTransformForm = (transformName: string) => {
    selectTransformClassFromDropdown();
    cy.get('#transform-name', { timeout: 30000 })
      .clear({ force: true })
      .type(transformName, { force: true });
  };

  describe('Transform list', () => {
    it('should display transform list or empty state', () => {
      waitForTransformListReady();
      cy.get('body').then(($body) => {
        if ($body.find(TRANSFORM_TABLE).length > 0) {
          cy.contains('Name').should('be.visible');
          cy.contains('Type').should('be.visible');
          cy.contains('Used in').should('be.visible');
          cy.contains('button', 'Add transform').should('be.visible');
        } else {
          cy.contains(/No transform available/i).should('exist');
        }
      });
    });

    it('should navigate to create transform from list', () => {
      waitForTransformListReady();
      cy.get('body').then(($body) => {
        if ($body.find(TRANSFORM_TABLE).length > 0) {
          cy.contains('button', 'Add transform').click();
        } else {
          cy.contains('button', /Add transform/i).click();
        }
      });
      cy.url().should('include', '/transform/create_transform');
    });

    it('should filter transforms by search and clear empty results', () => {
      const transformName = `cypress-transform-search-${Date.now()}`;
      createTransformViaApi(transformName);
      waitForTransformListReady();
      cy.get(TRANSFORM_TABLE, { timeout: 30000 }).should('exist');
      cy.get(LIST_SEARCH).type(transformName);
      cy.wait(900);
      cy.get(`${TRANSFORM_TABLE} tbody tr`).should('have.length', 1);
      cy.get(`${TRANSFORM_TABLE} tbody tr`).first().should('contain', transformName);

      cy.get(LIST_SEARCH).clear({ force: true });
      cy.get(LIST_SEARCH).type('xxx-no-match-xxx');
      cy.wait(900);
      cy.contains(/No matching transform is present/i).should('be.visible');
      cy.contains('button', 'Clear search').click();
      cy.get(LIST_SEARCH).should('have.value', '');
    });

    it('should navigate to transform details on name click', () => {
      const transformName = `cypress-transform-view-${Date.now()}`;
      createTransformViaApi(transformName);
      waitForTransformListReady();
      cy.get(`${TRANSFORM_TABLE} tbody tr`, { timeout: 30000 })
        .contains('button', transformName)
        .click();
      cy.url({ timeout: 30000 }).should('match', /\/transform\/\d+\?state=view/);
    });
  });

  describe('Create transform', () => {
    it('should load catalog and display grouped transform class dropdown', () => {
      openCreateTransform();
      cy.contains('Transform class').should('be.visible');
      cy.contains('Transform name').should('be.visible');
      cy.get(`${TRANSFORM_CLASS_INPUT} input`).click({ force: true });
      cy.get('#transform-class-listbox', { timeout: 30000 }).should('be.visible');
      cy.get('#transform-class-listbox').contains('Debezium SMT').should('exist');
      cy.get('#transform-class-listbox').contains('Kafka Connect SMT').should('exist');
    });

    it('should toggle between jump links and tabs layout', () => {
      openCreateTransform();
      cy.get('#jumplinks-layout', { timeout: 30000 }).should('have.attr', 'aria-pressed', 'true');
      cy.get('#tabs-layout').click();
      cy.get('#tabs-layout').should('have.attr', 'aria-pressed', 'true');
      cy.contains('Configuration').should('be.visible');
      cy.get('#jumplinks-layout').click();
      cy.contains('Transform Essentials').should('be.visible');
    });

    it('should validate required fields on submit', () => {
      openCreateTransform();
      cy.contains('button', 'Create transform').click();
      cy.get('#transform-name').should('have.attr', 'aria-invalid', 'true');
    });

    it('should successfully create a transform', () => {
      cy.intercept('POST', /\/api\/transforms\/?(\?|$)/i).as('createTransform');
      const transformName = `cypress-transform-${Date.now()}`;
      openCreateTransform();
      fillMinimalCreateTransformForm(transformName);
      cy.contains('button', 'Create transform').click();
      cy.wait('@createTransform').its('response.statusCode').should('be.oneOf', [200, 201, 202]);
      cy.contains('Create successful', { timeout: 20000 }).should('be.visible');
      cy.url().should('include', '/transform');
      cy.url().should('not.include', '/create_transform');
    });

    it('should handle API errors when creating a transform', () => {
      cy.intercept('POST', /\/api\/transforms\/?(\?|$)/i, {
        statusCode: 500,
        body: { error: 'Internal server error' },
      }).as('createTransformError');
      openCreateTransform();
      fillMinimalCreateTransformForm(`cypress-transform-error-${Date.now()}`);
      cy.contains('button', 'Create transform').click();
      cy.contains(/Transform creation failed|Failed to create/i, { timeout: 20000 }).should(
        'be.visible'
      );
    });
  });

  describe('Delete transform', () => {
    it('should show confirmation dialog and require exact name', () => {
      const transformName = `cypress-transform-delete-${Date.now()}`;
      createTransformViaApi(transformName);
      waitForTransformListReady();
      cy.get(`${TRANSFORM_TABLE} tbody tr`)
        .contains('tr', transformName)
        .find('td[data-label="Actions"] button')
        .click();
      cy.contains('Delete').click();
      cy.get('.pf-v6-c-modal-box').should('be.visible');
      cy.get('#delete-name').should('exist');
      cy.get('.pf-v6-c-modal-box').contains('button', 'Delete').should('be.disabled');
      cy.get('#delete-name').type('wrong-name');
      cy.get('.pf-v6-c-modal-box').contains('button', 'Delete').should('be.disabled');
    });

    it('should successfully delete a transform', () => {
      const transformName = `cypress-transform-del-ok-${Date.now()}`;
      createTransformViaApi(transformName);
      waitForTransformListReady();
      cy.get(`${TRANSFORM_TABLE} tbody tr`).contains('tr', transformName).should('exist');
      cy.get(`${TRANSFORM_TABLE} tbody tr`)
        .contains('tr', transformName)
        .find('td[data-label="Actions"] button')
        .click();
      cy.contains('Delete').click();
      cy.get('#delete-name').type(transformName);
      cy.get('.pf-v6-c-modal-box').contains('button', 'Delete').click();
      cy.contains('Delete successful', { timeout: 20000 }).should('be.visible');
      cy.get(TRANSFORM_TABLE).should('not.contain', transformName);
    });
  });
});
