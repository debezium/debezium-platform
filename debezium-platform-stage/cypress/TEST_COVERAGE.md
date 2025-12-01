# Cypress E2E Test Coverage

This document tracks the E2E test coverage for Debezium Platform Stage.

## Test Files Status

| Test File | Status | Tests | Description |
|-----------|--------|-------|-------------|
| `smoke.cy.ts` | ✅ Implemented | 5 | Basic smoke tests for app loading |
| `navigation.cy.ts` | ✅ Implemented | 6 | Navigation and routing tests |
| `source.cy.ts` | 📝 Placeholder | 0/20 | Source creation and management |
| `destination.cy.ts` | 📝 Placeholder | 0/22 | Destination creation and management |
| `transform.cy.ts` | 📝 Placeholder | 0/24 | Transform creation and management |
| `pipeline.cy.ts` | 📝 Placeholder | 0/35 | Pipeline creation, operations, and monitoring |

**Total Tests:** 11 implemented, 101 planned (11%)

## Implemented Tests ✅

### Smoke Tests (`smoke.cy.ts`)
- ✅ Application loads successfully
- ✅ Backend API is accessible
- ✅ Main navigation displays
- ✅ Navigate to Pipeline page by default
- ✅ No 404 page on root path

### Navigation Tests (`navigation.cy.ts`)
- ✅ Navigate to Source page
- ✅ Navigate to Transform page
- ✅ Navigate to Destination page
- ✅ Navigate to Connections page
- ✅ Navigate to Vaults page
- ✅ 404 page displays for invalid routes

## Planned Tests 📝

### Source Tests (`source.cy.ts`)

#### Source Catalog (3 tests)
- 📝 Display source catalog page
- 📝 Display available source connectors
- 📝 Navigate to create source from catalog

#### Create Source (5 tests)
- 📝 Navigate to create source page
- 📝 Display create source form
- 📝 Validate required fields
- 📝 Successfully create a new source
- 📝 Handle API errors gracefully

#### Source List (3 tests)
- 📝 Display list of sources
- 📝 Search/filter sources
- 📝 Navigate to source details

#### Edit Source (2 tests)
- 📝 Display edit source form
- 📝 Successfully update source

#### Delete Source (3 tests)
- 📝 Show confirmation dialog before deleting
- 📝 Successfully delete source
- 📝 Cancel delete operation

---

### Destination Tests (`destination.cy.ts`)

#### Destination Catalog (3 tests)
- 📝 Display destination catalog page
- 📝 Display available destination connectors
- 📝 Filter destinations by type

#### Create Destination (7 tests)
- 📝 Navigate to create destination page
- 📝 Display create destination form
- 📝 Validate required fields
- 📝 Test connection before creating
- 📝 Successfully create a new destination
- 📝 Handle API errors gracefully
- 📝 Support different destination types

#### Destination List (4 tests)
- 📝 Display list of destinations
- 📝 Show destination status
- 📝 Search/filter destinations
- 📝 Navigate to destination details

#### Edit Destination (3 tests)
- 📝 Display edit destination form
- 📝 Successfully update destination
- 📝 Re-test connection after editing

#### Delete Destination (3 tests)
- 📝 Show confirmation dialog before deleting
- 📝 Warn if destination is used in pipelines
- 📝 Successfully delete destination

---

### Transform Tests (`transform.cy.ts`)

#### Transform List (4 tests)
- 📝 Display list of transforms
- 📝 Show transform types
- 📝 Search/filter transforms
- 📝 Navigate to transform details

#### Create Transform (6 tests)
- 📝 Navigate to create transform page
- 📝 Display transform type selection
- 📝 Display create transform form
- 📝 Show transform-specific configuration fields
- 📝 Validate required fields
- 📝 Successfully create a new transform
- 📝 Support JSON configuration editor

#### Transform Configuration (4 tests)
- 📝 Support filter transforms
- 📝 Support field transformation
- 📝 Support custom SMT configuration
- 📝 Validate transform predicates

#### Edit Transform (3 tests)
- 📝 Display edit transform form
- 📝 Successfully update transform
- 📝 Preserve transform type when editing

#### Delete Transform (3 tests)
- 📝 Show confirmation dialog before deleting
- 📝 Warn if transform is used in pipelines
- 📝 Successfully delete transform

#### Transform Testing (2 tests)
- 📝 Test transform with sample data
- 📝 Show transform errors in test mode

---

### Pipeline Tests (`pipeline.cy.ts`)

#### Pipeline List (6 tests)
- 📝 Display list of pipelines
- 📝 Show pipeline status
- 📝 Display pipeline metrics
- 📝 Search/filter pipelines
- 📝 Sort pipelines
- 📝 Navigate to pipeline details

#### Pipeline Designer (7 tests)
- 📝 Navigate to pipeline designer
- 📝 Display visual pipeline canvas
- 📝 Drag source onto canvas
- 📝 Drag destination onto canvas
- 📝 Add transforms to pipeline
- 📝 Connect nodes
- 📝 Validate pipeline structure
- 📝 Show node configuration panel

#### Create Pipeline (9 tests)
- 📝 Navigate to pipeline configuration
- 📝 Display pipeline configuration form
- 📝 Select source from dropdown
- 📝 Select destination from dropdown
- 📝 Add multiple transforms
- 📝 Reorder transforms
- 📝 Configure pipeline logging level
- 📝 Validate required fields
- 📝 Successfully create a new pipeline
- 📝 Create pipeline with transforms
- 📝 Handle API errors gracefully

#### Pipeline Details (4 tests)
- 📝 Display pipeline overview
- 📝 Display pipeline metrics tab
- 📝 Display pipeline logs tab
- 📝 Display pipeline configuration tab

#### Pipeline Operations (5 tests)
- 📝 Start a stopped pipeline
- 📝 Stop a running pipeline
- 📝 Pause a running pipeline
- 📝 Resume a paused pipeline
- 📝 Restart a pipeline

#### Edit Pipeline (3 tests)
- 📝 Navigate to edit mode
- 📝 Display current pipeline configuration
- 📝 Successfully update pipeline
- 📝 Not allow editing running pipeline

#### Delete Pipeline (3 tests)
- 📝 Show confirmation dialog before deleting
- 📝 Not allow deleting running pipeline
- 📝 Successfully delete stopped pipeline

#### Pipeline Monitoring (3 tests)
- 📝 Display real-time metrics
- 📝 Show error details
- 📝 Download logs

#### Pipeline Cloning (1 test)
- 📝 Clone existing pipeline

---

## Next Steps

### High Priority
1. **Source Tests** - Implement create, list, edit, delete operations
2. **Destination Tests** - Implement create, list, edit, delete operations
3. **Pipeline Tests** - Implement create and basic operations

### Medium Priority
4. **Transform Tests** - Implement transform creation and configuration
5. **Pipeline Designer** - Test visual pipeline builder
6. **Pipeline Monitoring** - Test metrics and logs

### Low Priority
7. **Advanced Features** - Test connection testing, cloning, etc.
8. **Error Scenarios** - Add more negative test cases
9. **Performance Tests** - Add tests for large datasets

## Implementation Guidelines

When implementing these tests:

1. **Add data-testid attributes** to UI components for reliable selectors
   ```tsx
   <button data-testid="create-source-btn">Create Source</button>
   ```

2. **Use Page Object Models** for complex pages
   ```typescript
   class SourcePage {
     visit() { cy.visit('/source'); }
     clickCreate() { cy.get('[data-testid="create-btn"]').click(); }
   }
   ```

3. **Create test fixtures** for mock data
   ```json
   // cypress/fixtures/source.json
   {
     "name": "test-source",
     "type": "postgresql",
     "config": { ... }
   }
   ```

4. **Handle async operations** properly
   ```typescript
   cy.wait('@createSource').then((interception) => {
     expect(interception.response.statusCode).to.eq(201);
   });
   ```

5. **Clean up test data** after tests
   ```typescript
   afterEach(() => {
     // Delete test data created during the test
   });
   ```

## Running Tests

```bash
# Run all tests
yarn cypress:run

# Run specific test file
yarn cypress:run --spec "cypress/e2e/source.cy.ts"

# Run tests interactively
yarn cypress:open
```

## CI/CD Integration

Tests should be integrated into the CI pipeline:
- Run on every pull request
- Run on main branch commits
- Report test results and coverage
- Fail build if tests fail

---

**Last Updated:** $(date)
**Status:** 11/112 tests implemented (9.8%)

