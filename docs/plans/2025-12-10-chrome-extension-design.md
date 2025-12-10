# Chrome Extension Design for Browser MCP

**Date:** 2025-12-10
**Status:** Approved

## Overview

A Chrome extension that connects to the Browser MCP server via WebSocket, enabling AI assistants to control the browser through a minimal, token-efficient protocol.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  MCP Server (Node.js)                               │
│  - Stdio transport to Claude/Cursor/etc             │
│  - Exposes 4 MCP tools                              │
│  - WebSocket server on :9222                        │
└──────────────────────┬──────────────────────────────┘
                       │ ws://localhost:9222
                       ▼
┌─────────────────────────────────────────────────────┐
│  Chrome Extension (Plasmo)                          │
│  ┌─────────────────────────────────────────────────┐│
│  │ background.ts - Service Worker                  ││
│  │ - WebSocket client                              ││
│  │ - Routes messages to content script             ││
│  │ - Manages connection state                      ││
│  └─────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────┐│
│  │ content.ts - Content Script                     ││
│  │ - Generates ARIA snapshots (Playwright logic)  ││
│  │ - Executes interactions (click, type, etc.)    ││
│  │ - Captures console logs                        ││
│  └─────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────┐│
│  │ popup.tsx - Popup UI                            ││
│  │ - Connect/Disconnect button                    ││
│  │ - Status, tab info, uptime, message count      ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## Protocol

### Wire Format (JSON over WebSocket)

```typescript
// Request (Server → Extension)
{
  id: string,        // UUID for correlation
  method: string,    // "snapshot" | "navigate" | "interact" | "console"
  params: object     // Method-specific
}

// Success Response (Extension → Server)
{
  id: string,
  result: object     // TOON-encoded for snapshot responses
}

// Error Response (Extension → Server)
{
  id: string,
  error: {
    code: string,    // See Error Codes below
    message: string  // Human-readable detail
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `ELEMENT_NOT_FOUND` | Element selector matched nothing |
| `ELEMENT_AMBIGUOUS` | Element selector matched multiple elements |
| `TIMEOUT` | Operation timed out |
| `NO_TAB` | No tab connected |
| `NAVIGATION_FAILED` | Navigation to URL failed |

## Tools

### 1. snapshot

Capture the current page state as an ARIA accessibility tree.

```typescript
// Request
{ method: "snapshot", params: {} }

// Response (TOON format)
{
  url: "https://example.com/login",
  title: "Login - Example App",
  elements: [
    { ref: "e1", role: "heading", name: "Welcome back", states: "" },
    { ref: "e2", role: "textbox", name: "Email", states: "focused" },
    { ref: "e3", role: "button", name: "Sign in", states: "" }
  ]
}
```

### 2. navigate

Navigate to a URL.

```typescript
// Request
{ method: "navigate", params: { url: "https://example.com" } }

// Response
{ url: "https://example.com", title: "Example" }
```

### 3. interact

Perform an interaction on the page.

```typescript
// Request
{
  method: "interact",
  params: {
    action: "click" | "type" | "hover" | "select" | "press",
    element: ElementSelector,  // For click, type, hover, select
    text?: string,             // For type action
    key?: string,              // For press action
    value?: string,            // For select action
    snapshot?: boolean         // Include ARIA snapshot in response
  }
}

// Response (without snapshot flag)
{ success: true }

// Response (with snapshot: true)
{ success: true, url: "...", title: "...", elements: [...] }
```

### 4. console

Get captured console logs.

```typescript
// Request
{ method: "console", params: {} }

// Response (TOON format)
{
  logs: [
    { level: "error", ts: 1702234567, text: "Uncaught TypeError" },
    { level: "warn", ts: 1702234568, text: "Deprecation warning" }
  ]
}
```

## Element Selection

Hybrid selection supporting multiple strategies:

```typescript
type ElementSelector =
  | { ref: string }                    // ARIA snapshot ref: "e1", "e2"
  | { css: string }                    // CSS selector: ".submit-btn"
  | { role: string, name?: string }    // Accessibility: { role: "button", name: "Submit" }
```

Extension tries to match in order of specificity. Fails with `ELEMENT_AMBIGUOUS` if multiple matches.

## Output Format: TOON

All responses use [TOON format](https://github.com/toon-format/toon) for token efficiency (~40% fewer tokens than JSON).

Example snapshot output:

```
url: https://example.com/login
title: Login - Example App
elements[5]{ref,role,name,states}:
  e1,heading,Welcome back,
  e2,textbox,Email,focused
  e3,textbox,Password,
  e4,checkbox,Remember me,unchecked
  e5,button,Sign in,
```

## ARIA Snapshot Generation

Adapted from Playwright's `ariaSnapshot.ts` (`packages/injected/src/ariaSnapshot.ts`):

- `generateAriaTree()` - walks DOM, builds accessibility tree
- Reference system - `ref=e1`, `ref=e2` for interactive elements
- Handles shadow DOM, `aria-owns`, computed accessibility
- States: `focused`, `checked`, `unchecked`, `disabled`, `expanded`, `collapsed`

## Connection Model

- **Single tab**: User clicks "Connect" on one tab, only that tab is controlled
- **No auto-reconnect**: User manually reconnects if connection drops
- **Hardcoded port**: `ws://localhost:9222` (configurable in extension options)

## Popup UI

```
┌─────────────────────────────────────────┐
│  Browser MCP                            │
├─────────────────────────────────────────┤
│                                         │
│  Status: ● Connected                    │
│                                         │
│  Tab: Login - Example App               │
│  URL: https://example.com/login         │
│  Connected: 5m 32s ago                  │
│                                         │
│         [ Disconnect ]                  │
│                                         │
│  Server: ws://localhost:9222            │
│  Messages: 47 ↓  23 ↑                   │
│                                         │
└─────────────────────────────────────────┘
```

## File Structure (Plasmo)

```
extension/
├── package.json
├── tsconfig.json
├── .env                      # WS_URL=ws://localhost:9222
│
├── assets/
│   └── icon.png              # Plasmo auto-generates sizes
│
├── background.ts             # Service worker - WebSocket client
├── content.ts                # Content script - DOM interactions
├── popup.tsx                 # React popup component
│
├── lib/
│   ├── protocol.ts           # Message types, error codes
│   ├── aria-snapshot.ts      # Playwright-adapted snapshot logic
│   ├── interactions.ts       # click, type, hover, select, press
│   └── console-capture.ts    # Console log interception
│
└── components/
    └── StatusBadge.tsx       # Popup UI components
```

## Dependencies

```json
{
  "dependencies": {
    "plasmo": "^0.89.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "toon": "^3.0.0"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.270",
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
```

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tools | 4 minimal tools | Token efficiency, LLM simplicity |
| Protocol | Simple JSON-RPC | MCP is already RPC-based |
| Output | TOON format | ~40% fewer tokens than JSON |
| Element selection | Hybrid (ref/css/role) | Flexibility for different scenarios |
| Connection | Single tab, manual | Explicit user control |
| Framework | Plasmo | Modern DX, no manifest management |
| ARIA logic | Playwright-adapted | Battle-tested, comprehensive |
