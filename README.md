# OpenBrowserMCP

An open-source browser automation system for AI assistants using the Model Context Protocol (MCP).

OpenBrowserMCP enables AI applications like Claude, Cursor, and VS Code to control your browser through a streamlined, token-efficient protocol.

## Features

- **4 Focused Tools** - Minimal API surface: `snapshot`, `navigate`, `interact`, `console`
- **Token Efficient** - Uses [TOON format](https://github.com/toon-format/toon) (~40% fewer tokens than JSON)
- **ARIA-Based** - Semantic element selection using accessibility tree
- **Single Tab** - Explicit connection model for predictable automation
- **Local & Private** - Runs entirely on your machine, no data sent to remote servers
- **Logged In** - Uses your existing browser profile with all your sessions

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  AI Assistant (Claude, Cursor, VS Code)             │
└──────────────────────┬──────────────────────────────┘
                       │ MCP Protocol (stdio)
                       ▼
┌─────────────────────────────────────────────────────┐
│  MCP Server (Node.js)                               │
│  - Exposes 4 tools to AI                            │
│  - WebSocket server on :9222                        │
└──────────────────────┬──────────────────────────────┘
                       │ WebSocket
                       ▼
┌─────────────────────────────────────────────────────┐
│  Chrome Extension                                    │
│  - Connects to MCP server                           │
│  - Executes browser automation                      │
│  - Returns ARIA snapshots                           │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Install the MCP Server

```bash
cd mcp
npm install
npm run build
```

### 2. Install the Chrome Extension

```bash
cd extension
npm install
npm run dev
```

Load the extension in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `extension/build/chrome-mv3-dev`

### 3. Configure Your AI Assistant

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "browser": {
      "command": "node",
      "args": ["/path/to/OpenBrowserMCP/mcp/dist/index.js"]
    }
  }
}
```

### 4. Connect & Automate

1. Click the OpenBrowserMCP extension icon in Chrome
2. Click "Connect" on the tab you want to control
3. Ask your AI assistant to interact with the page!

## Tools

### `snapshot`
Capture the current page as an ARIA accessibility tree.

```
url: https://example.com/login
title: Login Page
elements[5]{ref,role,name,states}:
  e1,heading,Welcome,
  e2,textbox,Email,focused
  e3,textbox,Password,
  e4,button,Sign in,
  e5,link,Forgot password?,
```

### `navigate`
Navigate to a URL.

```typescript
navigate({ url: "https://example.com" })
```

### `interact`
Perform interactions on the page.

```typescript
// Click by ARIA ref
interact({ action: "click", element: { ref: "e4" } })

// Type into element
interact({ action: "type", element: { ref: "e2" }, text: "user@example.com" })

// Click by role and name
interact({ action: "click", element: { role: "button", name: "Submit" } })

// Click by CSS selector
interact({ action: "click", element: { css: ".submit-btn" } })
```

### `console`
Get browser console logs for debugging.

```typescript
console() // Returns captured log entries
```

## Element Selection

Three strategies for finding elements:

| Strategy | Example | Best For |
|----------|---------|----------|
| **Ref** | `{ ref: "e1" }` | Fast lookup from snapshot |
| **Role + Name** | `{ role: "button", name: "Submit" }` | Semantic, stable |
| **CSS** | `{ css: "#login-form .btn" }` | Precise targeting |

## Project Structure

```
OpenBrowserMCP/
├── mcp/                    # MCP Server
│   ├── src/
│   │   ├── index.ts       # CLI entry point
│   │   ├── server.ts      # MCP server setup
│   │   ├── context.ts     # WebSocket management
│   │   └── tools/         # Tool implementations
│   └── package.json
│
├── extension/              # Chrome Extension (Plasmo)
│   ├── background.ts      # WebSocket client
│   ├── content.ts         # DOM automation
│   ├── popup.tsx          # React UI
│   └── lib/
│       ├── protocol.ts    # Message types
│       ├── aria-snapshot.ts
│       ├── interactions.ts
│       └── console-capture.ts
│
└── docs/
    └── plans/             # Design documents
```

## Development

### MCP Server

```bash
cd mcp
npm run dev     # Watch mode
npm run build   # Production build
```

### Chrome Extension

```bash
cd extension
npm run dev     # Development with hot reload
npm run build   # Production build
```

## Protocol

Simple JSON-RPC over WebSocket:

```typescript
// Request
{ id: "uuid", method: "snapshot", params: {} }

// Success
{ id: "uuid", result: { url: "...", title: "...", elements: [...] } }

// Error
{ id: "uuid", error: { code: "ELEMENT_NOT_FOUND", message: "..." } }
```

## Why OpenBrowserMCP?

| Feature | OpenBrowserMCP | Playwright MCP | Other Solutions |
|---------|----------------|----------------|-----------------|
| Uses your browser | ✅ | ❌ | Varies |
| Logged-in sessions | ✅ | ❌ | ❌ |
| Token efficient | ✅ (TOON) | ❌ | ❌ |
| Minimal tools | ✅ (4 tools) | ❌ (12+ tools) | Varies |
| No bot detection | ✅ | ❌ | ❌ |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Browser MCP](https://browsermcp.io) - Inspiration and MCP server foundation
- [Playwright](https://playwright.dev) - ARIA snapshot implementation reference
- [TOON Format](https://github.com/toon-format/toon) - Token-efficient encoding
- [Plasmo](https://plasmo.com) - Chrome extension framework
