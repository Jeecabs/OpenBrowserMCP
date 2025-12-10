# Contributing to OpenBrowserMCP

Thanks for your interest in contributing to OpenBrowserMCP!

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies for both packages:

```bash
# MCP Server
cd mcp && npm install

# Chrome Extension
cd extension && npm install
```

## Development Workflow

### MCP Server

```bash
cd mcp
npm run dev     # Watch mode with auto-rebuild
npm run build   # Production build
npm run lint    # Check code style
```

### Chrome Extension

```bash
cd extension
npm run dev     # Development build with hot reload
npm run build   # Production build
```

Load the development build:
1. Open `chrome://extensions`
2. Enable Developer Mode
3. Load unpacked from `extension/build/chrome-mv3-dev`

## Project Structure

```
OpenBrowserMCP/
├── mcp/           # MCP server (Node.js/TypeScript)
├── extension/     # Chrome extension (Plasmo/React)
└── docs/          # Documentation
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Ensure code builds without errors
4. Test your changes manually
5. Submit a PR with a clear description

## Code Style

- TypeScript for all code
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Keep functions focused and small

## Commit Messages

Use conventional commit format:

```
feat: add new interaction type
fix: handle shadow DOM edge case
docs: update installation guide
refactor: simplify element selection
```

## Reporting Issues

When reporting bugs, include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser version
- Node.js version

## Feature Requests

Open an issue describing:
- The problem you're trying to solve
- Your proposed solution
- Alternative approaches considered

## Questions?

Open a discussion or issue - happy to help!
