# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Roo Code is an AI-powered VS Code extension that acts as a development assistant. It's built as a monorepo using pnpm workspaces and TypeScript with Turbo for build orchestration.

## Architecture

### Monorepo Structure
- **Root**: Main extension code in `src/`
- **Packages/**: Shared workspace packages:
  - `@roo-code/types`: Shared TypeScript types and interfaces
  - `@roo-code/config-eslint`: ESLint configuration
  - `@roo-code/config-typescript`: TypeScript configuration
  - `@roo-code/build`: Build utilities
  - `@roo-code/ipc`: Inter-process communication
  - `@roo-code/cloud`: Cloud services integration
  - `@roo-code/telemetry`: Telemetry and analytics
  - `@roo-code/evals`: Evaluation framework

### Core Extension Architecture
- **Entry Point**: `src/extension.ts` - Main extension activation
- **Core**: `src/core/` - Core functionality including prompts, tools, and webview management
- **API**: `src/api/` - Provider integrations for various AI models (40+ providers including OpenAI, Claude, Gemini, local models, etc.)
- **Services**: `src/services/` - Core services (MCP server management, code indexing, checkpoints)
- **Integrations**: `src/integrations/` - VS Code editor integrations, terminal handling, theme support
- **Webview**: `webview-ui/` - React-based UI for the extension's chat interface

### Key Components
- **Provider System**: Modular AI provider architecture in `src/api/providers/` with base classes and OpenAI-compatible implementations
- **Tool System**: Extensible tool framework in `src/core/prompts/tools/` for file operations, browser automation, MCP integration
- **MCP Integration**: Model Context Protocol server management for external tool integration
- **Code Indexing**: Tree-sitter based code analysis and indexing system
- **Terminal Integration**: Advanced terminal process management with shell integration
- **I18n Support**: Full internationalization with 20+ language locales

## Development Commands

### Package Management
```bash
# Install all dependencies and bootstrap workspace
pnpm install

# Clean all build artifacts
pnpm clean
```

### Development & Testing
```bash
# Run extension in development mode (F5 in VSCode)
# Builds and opens new VSCode instance with extension loaded

# Lint all code
pnpm lint

# Type checking
pnpm check-types

# Run tests
pnpm test

# Format code
pnpm format
```

### Building & Distribution
```bash
# Build extension
pnpm build

# Create VSIX package for manual installation
pnpm vsix

# Build and install VSIX directly to VSCode
pnpm install:vsix [options]
# Options: -y (skip confirmations), --editor=<command> (code/cursor/code-insiders)

# Nightly builds
pnpm bundle:nightly
pnpm vsix:nightly
```

### Package-Specific Operations
```bash
# Build types package
pnpm --filter @roo-code/types build

# Watch types package during development
pnpm --filter @roo-code/types build:watch

# Publish types to npm
pnpm npm:publish:types
```

## Development Workflow

### Testing Individual Components
- Use VSCode's built-in debugging (F5) for extension development
- Extension hot-reloads automatically for most changes
- Webview changes appear immediately in debug instance
- Use `pnpm test` for unit tests, `pnpm lint` for code quality

### Adding New AI Providers
1. Create provider in `src/api/providers/` extending `BaseProvider` or `BaseOpenAICompatibleProvider`
2. Add provider to `src/api/providers/index.ts`
3. Add types to `packages/types/src/providers/`
4. Create React component in `webview-ui/src/components/settings/providers/`
5. Add to webview provider index and constants

### Adding New Tools
1. Define tool in `src/core/prompts/tools/` following existing patterns
2. Implement tool execution logic
3. Add to tools registry in prompt sections
4. Test tool functionality through extension

### MCP Server Integration
- MCP servers managed through `McpServerManager` in `src/services/mcp/`
- Configuration through extension settings
- Tools auto-discovered and made available to AI models

## Important Notes

- **Node Version**: Requires Node.js 20.19.2
- **Package Manager**: Uses pnpm 10.8.1 (enforced by only-allow)
- **Build System**: Turbo for workspace orchestration
- **Testing**: Vitest for unit tests, extension testing through VSCode debugger
- **Code Quality**: ESLint + Prettier, pre-commit hooks via Husky
- **Type Safety**: Strict TypeScript with shared types package

### Git Workflow
- Main development branch: `1696`
- Uses changesets for version management
- Pre-commit hooks run lint-staged for code formatting

### Environment Configuration
- Environment variables loaded from `.env` in project root
- Handles environment loading gracefully for development