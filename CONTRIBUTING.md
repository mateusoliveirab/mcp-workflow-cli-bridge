# Contributing to MCP Workflow CLI Bridge

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

### Dev Container Setup
- This project supports VS Code Dev Containers. If you open this project in VS Code with the Dev Containers extension installed, it will prompt you to reopen inside the container, automatically configuring Node, git, and all extensions.

### Coding Standards
- This project uses TypeScript. All TypeScript compiler checks must pass cleanly.
- Avoid editing `.env` or other credential files directly in version control.
- Run type checks and compile the code before proposing changes:
  ```bash
  npm run typecheck
  npm run build
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
