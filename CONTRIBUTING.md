# Contributing to Claude Workflow CLI Bridge

Thank you for your interest in contributing! This document provides instructions for setting up and working on this project.

## Getting Started

### Prerequisites
- Node.js >= 20.19.4
- npm >= 10.x

### Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

## Development Workflow

### Coding Standards
- This project uses TypeScript. All TypeScript compiler checks must pass cleanly.
- Avoid editing `.env` or other credential files directly in version control.
- Run type checks before proposing changes:
  ```bash
  npm run typecheck
  ```

### Testing
We use the native `node:test` runner. Run all tests with:
```bash
npm test
```

### Code CLI Smoke Validation
To perform dry-run and live validations of the provider integrations:
```bash
npm run smoke
npm run live:validate
```

## Submitting Changes
- Please ensure all tests pass and TypeScript compiles strictly before opening a pull request.
- Commit messages should be clear and descriptive.
