#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { Context } from "./context.js";
import { createWebSocketServer } from "./ws.js";
import type {
  SnapshotResult,
  NavigateResult,
  InteractResult,
  ConsoleResult,
} from "./protocol.js";

import packageJSON from "../package.json" with { type: "json" };

const APP_NAME = "openbrowsermcp";

// Create shared context for WebSocket communication
const context = new Context();

// Create MCP server with high-level API
const server = new McpServer({
  name: APP_NAME,
  version: packageJSON.version,
});

// Element selector schema for interact tool
const ElementSelectorSchema = z.union([
  z.object({ ref: z.string().describe("ARIA snapshot reference (e.g., 'e1', 'e2')") }),
  z.object({ css: z.string().describe("CSS selector (e.g., '.submit-btn')") }),
  z.object({
    role: z.string().describe("ARIA role (e.g., 'button')"),
    name: z.string().optional().describe("Accessible name (e.g., 'Submit')"),
  }),
]);

// Register tools
server.tool(
  "snapshot",
  "Capture the current page's accessibility tree (ARIA snapshot) in TOON format. Returns the page URL, title, and structured element tree.",
  {},
  async () => {
    const result = await context.sendRpcRequest<SnapshotResult>("snapshot", {});
    return {
      content: [
        {
          type: "text",
          text: `- Page URL: ${result.url}
- Page Title: ${result.title}
- ARIA Snapshot:
\`\`\`
${result.aria}
\`\`\``,
        },
      ],
    };
  }
);

server.tool(
  "navigate",
  "Navigate the browser to a specified URL. Returns the final URL and page title after navigation.",
  {
    url: z.string().describe("The URL to navigate to (e.g., 'https://example.com')"),
  },
  async ({ url }) => {
    const result = await context.sendRpcRequest<NavigateResult>("navigate", { url });
    return {
      content: [
        {
          type: "text",
          text: `Navigated to ${result.url}\nPage Title: ${result.title}`,
        },
      ],
    };
  }
);

server.tool(
  "interact",
  "Perform browser interactions: click, type, hover, select, or press keys. Optionally capture an ARIA snapshot after the interaction.",
  {
    action: z.enum(["click", "type", "hover", "select", "press"]).describe("The type of interaction to perform"),
    element: ElementSelectorSchema.optional().describe("Element selector (required for click, type, hover, select)"),
    text: z.string().optional().describe("Text to type (required for action='type')"),
    key: z.string().optional().describe("Key to press (required for action='press', e.g., 'Enter', 'Escape')"),
    value: z.string().optional().describe("Option value to select (required for action='select')"),
    snapshot: z.boolean().optional().default(false).describe("Whether to capture ARIA snapshot after interaction"),
  },
  async (params) => {
    const result = await context.sendRpcRequest<InteractResult>("interact", params);

    // Build response message
    let message = "";
    switch (params.action) {
      case "click":
        message = "Clicked element";
        break;
      case "type":
        message = `Typed "${params.text}" into element`;
        break;
      case "hover":
        message = "Hovered over element";
        break;
      case "select":
        message = `Selected option "${params.value}" in element`;
        break;
      case "press":
        message = `Pressed key "${params.key}"`;
        break;
    }

    // If snapshot was requested, include ARIA tree
    if (params.snapshot && result.aria) {
      return {
        content: [
          {
            type: "text",
            text: `${message}

- Page URL: ${result.url}
- Page Title: ${result.title}
- ARIA Snapshot:
\`\`\`
${result.aria}
\`\`\``,
          },
        ],
      };
    }

    return {
      content: [{ type: "text", text: message }],
    };
  }
);

server.tool(
  "console",
  "Retrieve console logs from the browser page. Returns all captured console messages with their level, timestamp, and text.",
  {},
  async () => {
    const result = await context.sendRpcRequest<ConsoleResult>("console", {});

    const formattedLogs = result.logs
      .map((log) => {
        const timestamp = new Date(log.ts).toISOString();
        return `[${log.level.toUpperCase()}] ${timestamp}: ${log.text}`;
      })
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: formattedLogs || "No console logs captured",
        },
      ],
    };
  }
);

// Main entry point
async function main() {
  // Set up WebSocket server for browser extension communication
  const wss = await createWebSocketServer();
  wss.on("connection", (websocket) => {
    // Close any existing connections
    if (context.hasWs()) {
      context.ws.close();
    }
    context.ws = websocket;
  });

  // Set up exit watchdog
  process.stdin.on("close", async () => {
    setTimeout(() => process.exit(0), 15000);
    await wss.close();
    await context.close();
    process.exit(0);
  });

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
