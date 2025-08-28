# Task Board Plugin Tests

This directory contains the test suite for the Task Board Obsidian plugin, following the testing approach used by the [obsidian-tasks plugin](https://github.com/obsidian-tasks-group/obsidian-tasks).

## Testing Framework

- **Jest**: Test runner and assertion library
- **TypeScript**: Full TypeScript support with ts-jest
- **jsdom**: DOM environment for testing React components
- **@testing-library/jest-dom**: Custom Jest matchers for DOM assertions

## Test Structure

```
tests/
├── interfaces/          # Tests for TypeScript interfaces
├── utils/              # Tests for utility functions
├── components/         # Tests for React components
├── __mocks__/          # Mock implementations
├── test-setup.ts       # Global test setup
└── README.md           # This file
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Current Test Coverage

### Essential Areas Tested

1. **TaskRegularExpressions** (`utils/TaskRegularExpressions.test.ts`)
   - Task parsing regular expressions
   - Indentation, list markers, checkboxes
   - Hash tag recognition
   - Block link matching

2. **TaskItem Interfaces** (`interfaces/TaskItem.test.ts`)
   - TaskItem data structure validation
   - Priority emoji mappings
   - JSON cache data structures
   - Task status constants

3. **CheckBox Utils** (`utils/CheckBoxUtils.test.ts`)
   - Checkbox state switching logic
   - Task completion detection
   - Task line validation
   - Obsidian indentation settings

## Test Philosophy

These tests focus on core functionality that would be difficult to manually test:

- **Parsing Logic**: Regular expressions and text processing
- **Data Structures**: Interface validation and type safety
- **State Management**: Status transitions and validations
- **Configuration**: Settings and preferences handling

## CI/CD Integration

Tests are automatically run during the GitHub Actions release workflow to ensure code quality before publishing new versions.

## Adding New Tests

When adding new tests:

1. Place them in the appropriate directory (`interfaces/`, `utils/`, `components/`)
2. Use descriptive test names following the pattern `should [expected behavior] when [condition]`
3. Mock external dependencies (Obsidian APIs, file system, etc.)
4. Test both happy path and edge cases
5. Update this README if adding new test categories

## Mocking Strategy

- **Obsidian APIs**: Mocked in `__mocks__/obsidian.ts` and `test-setup.ts`
- **File System**: Mock vault operations and file reads/writes
- **External Libraries**: Mock only when necessary for isolation

## Known Limitations

- React component testing is minimal due to Obsidian-specific dependencies
- Full integration tests are not feasible without running in Obsidian
- File system operations are mocked and may not reflect real behavior

The goal is to catch regressions in core logic while keeping tests fast and reliable.