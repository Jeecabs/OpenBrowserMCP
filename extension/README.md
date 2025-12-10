# OpenBrowserMCP Chrome Extension

Chrome extension that connects to the OpenBrowserMCP server, enabling AI assistants to control the browser through a minimal, token-efficient protocol.

## Architecture

- **background.ts**: Service worker managing WebSocket connection to MCP server
- **content.ts**: Content script executing in web pages for DOM interactions
- **popup.tsx**: React UI for connection status and controls
- **lib/protocol.ts**: Message types and error codes
- **lib/aria-snapshot.ts**: ARIA accessibility tree generation (Playwright-adapted)
- **lib/interactions.ts**: DOM interaction implementations (click, type, hover, etc.)
- **lib/console-capture.ts**: Console log interception and storage

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Load extension in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `build/chrome-mv3-dev` directory

## Building for Production

```bash
npm run build
```

Built extension will be in `build/chrome-mv3-prod/`.

To create a distributable package:

```bash
npm run package
```

## Usage

1. Start the OpenBrowserMCP server (from the `mcp/` directory)
2. Open the extension popup on any tab
3. Click "Connect" to establish WebSocket connection
4. The extension will now respond to commands from the MCP server

## Protocol

The extension communicates with the MCP server via WebSocket using a simple JSON-RPC protocol:

### Methods

- **snapshot**: Generate ARIA accessibility tree of current page
- **navigate**: Navigate to a URL
- **interact**: Perform interactions (click, type, hover, select, press)
- **console**: Retrieve captured console logs

### Element Selection

Three strategies for targeting elements:

- **Reference**: `{ ref: "e1" }` - from ARIA snapshot
- **CSS**: `{ css: ".submit-btn" }` - CSS selector
- **Role**: `{ role: "button", name: "Submit" }` - ARIA role + name

## Configuration

WebSocket URL is configured in `.env`:

```
WS_URL=ws://localhost:9222
```

Default is `ws://localhost:9222` to match the MCP server.
