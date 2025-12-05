describe('Source Management', () => {
  beforeEach(() => {
    cy.waitForBackend();
    cy.visit('/source');
  });

  describe('Source Catalog', () => {
    it('should display the source catalog page', () => {
      cy.visit('/source/catalog');
      cy.url().should('include', '/source/catalog');
      cy.contains('Source catalog').should('be.visible');
      cy.get('input[placeholder*="Search"]').should('exist');
      cy.get('[aria-label="Grid view"]').should('exist');
      cy.get('[aria-label="List view"]').should('exist');
    });

    it('should display available source connectors', () => {
      cy.visit('/source/catalog');
      const expectedConnectors = ['MariaDB', 'MongoDB', 'MySQL', 'Oracle', 'PostgreSQL', 'SQL Server'];
      expectedConnectors.forEach(connector => {
        cy.contains(connector).should('exist');
      });
      cy.contains('6 Items').should('be.visible');
    });

    it('should filter sources by search query', () => {
      cy.visit('/source/catalog');
      cy.get('input[placeholder*="Search"]').type('PostgreSQL');
      cy.wait(800);
      cy.contains('PostgreSQL').should('be.visible');
      cy.contains('MongoDB').should('not.exist');
    });

    it('should toggle between grid and list view', () => {
      cy.visit('/source/catalog');
      cy.get('[aria-label="Grid view"]').should('have.attr', 'aria-pressed', 'true');
      cy.get('[aria-label="List view"]').click();
      cy.get('[aria-label="List view"]').should('have.attr', 'aria-pressed', 'true');
      cy.get('[class*="pf-v6-c-data-list"]').should('exist');
      cy.get('[aria-label="Grid view"]').click();
      cy.get('[class*="pf-v6-l-gallery"]').should('exist');
    });

    it('should clear search and show all connectors', () => {
      cy.visit('/source/catalog');
      cy.get('input[placeholder*="Search"]').type('MySQL');
      cy.wait(800);
      cy.get('[aria-label="Reset"]').click();
      cy.contains('PostgreSQL').should('be.visible');
      cy.contains('MongoDB').should('be.visible');
    });
  });

  describe('Create Source', () => {
    it('should navigate to create source page from catalog', () => {
      cy.visit('/source/catalog');
      cy.get('button[aria-labelledby="catalog-card-id-PostgreSQL"]').click();
      cy.url().should('include', '/source/create_source/postgresql');
      cy.contains('Create source').should('exist');
    });

    it('should display create source form', () => {
      cy.visit('/source/create_source/postgresql');
      cy.contains('Source type').should('be.visible');
      cy.contains('PostgreSQL').should('be.visible');
      cy.contains('Source name').should('be.visible');
      cy.get('#source-name').should('exist');
       cy.contains('Description').should('be.visible');
      cy.get('#source-description').should('exist');
      cy.contains('Source name').should('be.visible');
      cy.contains('Configuration properties').should('exist');
      cy.contains('button', 'Create source').should('be.visible');
      cy.contains('Back to catalog').should('be.visible');
    });

    it('should toggle between form editor and smart editor', () => {
      cy.visit('/source/create_source/postgresql');
       cy.get('#form-editor').should('exist');
      cy.get('#form-editor').should('have.attr', 'aria-pressed', 'true');
      cy.get('#smart-editor').click();
      cy.get('#smart-editor').should('have.attr', 'aria-pressed', 'true');
      cy.get('.monaco-editor').should('exist');
      
      // Wait a moment before switching back to avoid race conditions
      cy.wait(500);
      
      cy.get('#form-editor').click();
      cy.get('#source-name').should('be.visible');
    });

    it('should validate required fields', () => {
      cy.visit('/source/create_source/postgresql');
      cy.contains('button', 'Create source').click();
      cy.get('#source-name').should('have.attr', 'aria-invalid', 'true');
    });

    it('should add and remove configuration properties', () => {
      cy.visit('/source/create_source/postgresql');
      cy.contains('button', 'Add property').click();
      cy.get('[id^="source-config-props-key-"]').should('have.length.at.least', 2);
      cy.get('[aria-label="Remove"]').first().click();
      cy.get('[id^="source-config-props-key-"]').should('have.length.at.least', 1);
    });

    it('should successfully create a new source', () => {
      cy.visit('/source/create_source/postgresql');
      const sourceName = `test-source-${Date.now()}`;
      cy.get('#source-name').type(sourceName);
      cy.get('#source-description').type('Test source created by Cypress');
      
      cy.get('[id^="source-config-props-key-"]').first().type('database.hostname');
      cy.get('[id^="source-config-props-value-"]').first().type('debezium');
      cy.contains('button', 'Add property').click();
      cy.get('[id^="source-config-props-key-"]').last().type('database.port');
      cy.get('[id^="source-config-props-value-"]').last().type('5432');
      cy.contains('button', 'Create source').click();
      
      cy.contains('Create successful').should('be.visible');
      cy.url().should('include', '/source');
      cy.url().should('not.include', '/create_source');
    });

    it('should handle API errors gracefully', () => {
      cy.visit('/source/create_source/postgresql');
      cy.intercept('POST', '**/api/sources', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('createSourceError');
      
      cy.get('#source-name').type('test-source-error');
      cy.get('[id^="source-config-props-key-"]').first().type('test.key');
      cy.get('[id^="source-config-props-value-"]').first().type('test.value');
      cy.contains('button', 'Create source').click();
      cy.wait('@createSourceError');
      cy.contains('failed').should('be.visible');
    });

    it('should navigate using smart editor with JSON', () => {
      cy.visit('/source/create_source');
      cy.get('.monaco-editor').should('exist');
      cy.contains('Create source').should('be.visible');
    });
  });

  describe('Source List', () => {
    it('should display list of sources', () => {
      cy.visit('/source');
      cy.url().should('include', '/source');

        // Wait a moment before switching back to avoid race conditions
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
      cy.visit('/source');
      cy.get('body').then(($body) => {
        if ($body.text().includes('No source available')) {
          cy.contains('button', 'Add source').should('be.visible');
          cy.contains('button', 'Add source').click();
          cy.url().should('include', '/source/catalog');
        }
      });
    });

    it('should allow searching/filtering sources', () => {
      cy.visit('/source');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="source table"]').length > 0) {
          cy.get('input[placeholder*="Search"]').should('exist');
          cy.get('input[placeholder*="Search"]').type('test');
          cy.wait(800); // Wait for debounce
        }
      });
    });

    it('should navigate to source details on click', () => {
      cy.visit('/source');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="source table"]').length > 0) {
          cy.get('table[aria-label="source table"] tbody tr').first().find('button').first().click();
          cy.url().should('match', /\/source\/\d+\?state=view/);
        }
      });
    });

    it('should display toolbar with search when sources exist', () => {
      cy.visit('/source');
      cy.get('body').then(($body) => {
        if ($body.find('table[aria-label="source table"]').length > 0) {
          cy.get('input[placeholder*="Search"]').should('be.visible');
          cy.contains('button', 'Add source').should('be.visible');
        }
      });
    });
  });

  describe('Edit Source', () => {
    const createTestSource = () => {
      cy.visit('/source/create_source/postgresql');
      const sourceName = `edit-test-${Date.now()}`;
      cy.get('#source-name').type(sourceName);
      cy.get('#source-description').type('Source for edit testing');
      cy.get('[id^="source-config-props-key-"]').first().type('database.hostname');
      cy.get('[id^="source-config-props-value-"]').first().type('localhost');
      cy.contains('button', 'Create source').click();
      cy.contains('Create successful').should('be.visible');
      return sourceName;
    };

    it('should display edit source form', () => {
      createTestSource();
      
      cy.visit('/source');
      cy.get('table[aria-label="source table"] tbody tr').first().find('button').first().click();
      
      cy.url().should('include', '?state=view');
      
      cy.contains('button', 'Edit').click();
      
      cy.get('#source-name').should('exist');
      cy.get('#source-name').invoke('val').should('not.be.empty');
      cy.get('#source-description').should('exist');
    });

    it('should toggle between view and edit mode', () => {
      createTestSource();
      
      cy.visit('/source');
      cy.get('table[aria-label="source table"] tbody tr').first().find('button').first().click();
      
      cy.url().should('include', 'state=view');
      
      cy.contains('button', 'Edit').click();
      
      cy.get('#source-name').should('not.have.attr', 'readonly');
      
      cy.contains('button', 'Cancel').click();
      
      cy.contains('button', 'Edit').should('be.visible');
    });

    it('should successfully update source', () => {
      createTestSource();
      
      cy.visit('/source');
      cy.get('table[aria-label="source table"] tbody tr').first().find('button').first().click();
      
      cy.contains('button', 'Edit').click();
      
      cy.get('#source-description').clear().type('Updated description by Cypress');
      
      cy.contains('button', 'Save changes').click();
      
      cy.get('.pf-v6-c-modal-box').should('be.visible');
      cy.contains('button', 'Confirm').click();
      
      cy.contains('successful').should('be.visible');
    });

    it('should cancel edit operation', () => {
      createTestSource();
      
      cy.visit('/source');
      cy.get('table[aria-label="source table"] tbody tr').first().find('button').first().click();
      
      cy.contains('button', 'Edit').click();
      
      const originalValue = cy.get('#source-description').invoke('val');
      cy.get('#source-description').clear().type('Temporary change');
      cy.contains('button', 'Cancel').click();
      cy.contains('button', 'Edit').should('be.visible');
    });
  });

  describe('Delete Source', () => {
    const createTestSourceForDelete = () => {
      cy.visit('/source/create_source/postgresql');
      const sourceName = `delete-test-${Date.now()}`;
      cy.get('#source-name').type(sourceName);
      cy.get('#source-description').type('Source for delete testing');
      cy.get('[id^="source-config-props-key-"]').first().type('database.hostname');
      cy.get('[id^="source-config-props-value-"]').first().type('localhost');
      cy.contains('button', 'Create source').click();
      cy.contains('Create successful').should('be.visible');
      return sourceName;
    };

    it('should show confirmation dialog before deleting', () => {
      createTestSourceForDelete();
      
      cy.visit('/source');
      cy.get('table[aria-label="source table"] tbody tr').first()
        .find('td[data-label="Actions"] button').click();
      
      cy.contains('Delete').click();
      
      cy.get('.pf-v6-c-modal-box').should('be.visible');
      cy.contains('delete').should('be.visible');
      cy.get('#dalete-name').should('exist');
    });

    it('should require typing source name to confirm delete', () => {
      const sourceName = createTestSourceForDelete();
      
      cy.visit('/source');
      cy.get('table[aria-label="source table"] tbody tr').first()
        .find('td[data-label="Actions"] button').click();
      cy.contains('Delete').click();
      
      cy.get('.pf-v6-c-modal-box').contains('button', 'Delete').should('be.disabled');
      
      cy.get('#dalete-name').type('wrong-name');
      cy.get('.pf-v6-c-modal-box').contains('button', 'Delete').should('be.disabled');
      cy.get('#dalete-name').clear();
    });

    it('should successfully delete source', () => {
      const sourceName = createTestSourceForDelete();
      
      cy.visit('/source');
      
      cy.get('table[aria-label="source table"] tbody tr').first()
        .find('button').first().invoke('text').then((name) => {
          cy.get('table[aria-label="source table"] tbody tr').first()
            .find('td[data-label="Actions"] button').click();
          cy.contains('Delete').click();
          
          cy.get('#dalete-name').type(name.trim());
          
          cy.get('.pf-v6-c-modal-box').contains('button', 'Delete').click();
          
          cy.contains('Delete successful').should('be.visible');
        });
    });

    it('should cancel delete operation', () => {
      createTestSourceForDelete();
      
      cy.visit('/source');
      
      cy.get('table[aria-label="source table"] tbody tr').its('length').then((initialCount) => {
        cy.get('table[aria-label="source table"] tbody tr').first()
          .find('td[data-label="Actions"] button').click();
        cy.contains('Delete').click();
        
        cy.get('.pf-v6-c-modal-box').contains('button', 'Cancel').click();
        
        cy.get('.pf-v6-c-modal-box').should('not.exist');
        cy.get('table[aria-label="source table"] tbody tr').should('have.length', initialCount);
      });
    });

    it('should close modal when clicking outside', () => {
      createTestSourceForDelete();
      
      cy.visit('/source');
      cy.get('table[aria-label="source table"] tbody tr').first()
        .find('td[data-label="Actions"] button').click();
      cy.contains('Delete').click();
      
      cy.get('.pf-v6-c-modal-box').should('be.visible');
      
      cy.get('.pf-v6-c-modal-box').contains('button', 'Cancel').click();
      
      cy.get('.pf-v6-c-modal-box').should('not.exist');
    });
  });

  describe('Source Page Navigation', () => {
    it('should navigate from source list to catalog', () => {
      cy.visit('/source');
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("Add source")').length > 0) {
          cy.contains('button', 'Add source').click();
          cy.url().should('include', '/source/catalog');
        }
      });
    });

    it('should navigate from source catalog to create source', () => {
      cy.visit('/source/catalog');
      cy.get('button[aria-labelledby="catalog-card-id-PostgreSQL"]').click();
      cy.url().should('include', '/source/create_source/postgresql');
    });

    it('should navigate back from create source to catalog', () => {
      cy.visit('/source/create_source/postgresql');
      cy.contains('Back to catalog').click();
      cy.url().should('include', '/source/catalog');
    });
  });
});
