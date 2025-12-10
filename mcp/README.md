# OpenBrowserMCP Server

MCP server that enables AI assistants to control your browser through a minimal, token-efficient protocol.

## Features

- **4 Focused Tools** - `snapshot`, `navigate`, `interact`, `console`
- **Token Efficient** - Uses TOON format for responses
- **Simple Protocol** - JSON-RPC over WebSocket
- **Type Safe** - Full TypeScript with Zod validation

## Installation

```bash
npm install
npm run build
```

## Usage

### With Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

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

### With Cursor

Add to your Cursor MCP settings:

```json
{
  "browser": {
    "command": "node",
    "args": ["/path/to/OpenBrowserMCP/mcp/dist/index.js"]
  }
}
```

## Tools

### snapshot

Capture the current page's accessibility tree.

```typescript
snapshot()
// Returns: { url, title, aria }
```

### navigate

Navigate to a URL.

```typescript
navigate({ url: "https://example.com" })
// Returns: { url, title }
```

### interact

Perform browser interactions.

```typescript
// Click by ARIA ref
interact({ action: "click", element: { ref: "e1" } })

// Type text
interact({ action: "type", element: { ref: "e2" }, text: "hello" })

// Click by role
interact({ action: "click", element: { role: "button", name: "Submit" } })

// Press key
interact({ action: "press", key: "Enter" })

// With snapshot after
interact({ action: "click", element: { ref: "e1" }, snapshot: true })
```

### console

Get browser console logs.

```typescript
console()
// Returns: { logs: [{ level, ts, text }] }
```

## Element Selection

Three strategies for finding elements:

| Strategy | Example | Use Case |
|----------|---------|----------|
| **Ref** | `{ ref: "e1" }` | Fast lookup from snapshot |
| **CSS** | `{ css: ".btn" }` | Precise targeting |
| **Role** | `{ role: "button", name: "Submit" }` | Semantic, stable |

## Development

```bash
npm run dev     # Watch mode
npm run build   # Production build
npm run start   # Run server
```

## Protocol

The server communicates with the Chrome extension via WebSocket on port 9222.

```typescript
// Request
{ id: "uuid", method: "snapshot", params: {} }

// Response
{ id: "uuid", result: { url: "...", title: "...", aria: "..." } }

// Error
{ id: "uuid", error: { code: "ELEMENT_NOT_FOUND", message: "..." } }
```

## Error Codes

| Code | Description |
|------|-------------|
| `ELEMENT_NOT_FOUND` | Element selector matched nothing |
| `ELEMENT_AMBIGUOUS` | Multiple elements matched |
| `TIMEOUT` | Operation timed out |
| `NO_TAB` | No browser tab connected |
| `NAVIGATION_FAILED` | Navigation failed |

## Credits

Adapted from the [Browser MCP](https://browsermcp.io) and [Playwright MCP](https://github.com/microsoft/playwright-mcp) projects.
