# Quick Start Guide

## Setup

1. **Install dependencies**
   ```bash
   cd extension
   npm install
   ```

2. **Start development**
   ```bash
   npm run dev
   ```

## Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select `extension/build/chrome-mv3-dev` directory

## Test the Extension

1. **Start the MCP Server** (in another terminal)
   ```bash
   cd ../mcp
   npm start
   ```

2. **Open any webpage** in Chrome

3. **Click the extension icon** in Chrome toolbar

4. **Click "Connect"** in the popup
   - Status should change to "Connected"
   - Green indicator appears
   - Message counters start tracking

5. **Test from MCP client** (Claude Desktop, Cursor, etc.)
   - Use the MCP tools to control the browser
   - `snapshot` - Get page structure
   - `navigate` - Go to URL
   - `interact` - Click, type, etc.
   - `console` - Get console logs

## File Structure

```
extension/
├── background.ts              # WebSocket client, message router
├── content.ts                 # DOM interaction handler
├── popup.tsx                  # React UI for connection control
├── popup.css                  # UI styles
├── lib/
│   ├── protocol.ts           # Message types and error codes
│   ├── aria-snapshot.ts      # Accessibility tree generation
│   ├── interactions.ts       # Click, type, hover, etc.
│   └── console-capture.ts    # Console log interception
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
└── .env                      # WebSocket URL (ws://localhost:9222)
```

## Development Tips

- **Hot Reload**: Changes auto-reload in dev mode
- **Debugging**:
  - Background: `chrome://extensions/` → "Inspect views: service worker"
  - Content: Right-click page → Inspect → Console
  - Popup: Right-click extension icon → Inspect popup
- **Logs**: Check browser console for `[Background]` and `[Content]` prefixes

## Building for Production

```bash
npm run build
```

Output: `build/chrome-mv3-prod/`

To create a distributable ZIP:

```bash
npm run package
```

## Troubleshooting

**Connection fails**
- Ensure MCP server is running on port 9222
- Check `.env` has correct `WS_URL`
- Look for errors in background service worker console

**No response from content script**
- Refresh the webpage after connecting
- Check content script is injected (Chrome DevTools → Sources → Content scripts)
- Verify no CSP errors in console

**Element not found**
- Generate a snapshot first to get element refs
- Use CSS selectors for non-interactive elements
- Use role/name for better reliability
