import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";

import type { Context } from "@/context";
import type { Tool, ToolResult } from "./tool";
import type {
  SnapshotResult,
  NavigateResult,
  InteractResult,
  ConsoleResult,
} from "../protocol";

/**
 * Consolidated MCP Browser Tools
 *
 * These 4 tools replace the previous 11 tools by using a unified RPC protocol.
 * All tools communicate via context.sendRpcRequest() which maps to the protocol
 * defined in ../protocol.ts
 */

// ============================================================================
// 1. SNAPSHOT - Capture ARIA tree
// ============================================================================

const SnapshotSchema = z.object({
  name: z.literal("snapshot"),
  description: z.literal("Capture the current page's accessibility tree (ARIA snapshot) in TOON format. Returns the page URL, title, and structured element tree."),
  arguments: z.object({}),
});

export const snapshot: Tool = {
  schema: {
    name: SnapshotSchema.shape.name.value,
    description: SnapshotSchema.shape.description.value,
    inputSchema: zodToJsonSchema(SnapshotSchema.shape.arguments),
  },
  handle: async (context: Context): Promise<ToolResult> => {
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
  },
};

// ============================================================================
// 2. NAVIGATE - Go to URL
// ============================================================================

const NavigateSchema = z.object({
  name: z.literal("navigate"),
  description: z.literal("Navigate the browser to a specified URL. Returns the final URL and page title after navigation."),
  arguments: z.object({
    url: z.string().describe("The URL to navigate to (e.g., 'https://example.com')"),
  }),
});

export const navigate: Tool = {
  schema: {
    name: NavigateSchema.shape.name.value,
    description: NavigateSchema.shape.description.value,
    inputSchema: zodToJsonSchema(NavigateSchema.shape.arguments),
  },
  handle: async (context: Context, params?: Record<string, any>): Promise<ToolResult> => {
    const { url } = NavigateSchema.shape.arguments.parse(params);
    const result = await context.sendRpcRequest<NavigateResult>("navigate", { url });

    return {
      content: [
        {
          type: "text",
          text: `Navigated to ${result.url}\nPage Title: ${result.title}`,
        },
      ],
    };
  },
};

// ============================================================================
// 3. INTERACT - Unified interaction tool
// ============================================================================

const ElementSelectorSchema = z.union([
  z.object({ ref: z.string().describe("ARIA snapshot reference (e.g., 'e1', 'e2')") }),
  z.object({ css: z.string().describe("CSS selector (e.g., '.submit-btn')") }),
  z.object({
    role: z.string().describe("ARIA role (e.g., 'button')"),
    name: z.string().optional().describe("Accessible name (e.g., 'Submit')"),
  }),
]);

const InteractSchema = z.object({
  name: z.literal("interact"),
  description: z.literal("Perform browser interactions: click, type, hover, select, or press keys. Optionally capture an ARIA snapshot after the interaction."),
  arguments: z.object({
    action: z.enum(["click", "type", "hover", "select", "press"]).describe("The type of interaction to perform"),
    element: ElementSelectorSchema.optional().describe("Element selector (required for click, type, hover, select)"),
    text: z.string().optional().describe("Text to type (required for action='type')"),
    key: z.string().optional().describe("Key to press (required for action='press', e.g., 'Enter', 'Escape')"),
    value: z.string().optional().describe("Option value to select (required for action='select')"),
    snapshot: z.boolean().optional().default(false).describe("Whether to capture ARIA snapshot after interaction"),
  }),
});

export const interact: Tool = {
  schema: {
    name: InteractSchema.shape.name.value,
    description: InteractSchema.shape.description.value,
    inputSchema: zodToJsonSchema(InteractSchema.shape.arguments),
  },
  handle: async (context: Context, params?: Record<string, any>): Promise<ToolResult> => {
    const validatedParams = InteractSchema.shape.arguments.parse(params);
    const result = await context.sendRpcRequest<InteractResult>("interact", validatedParams);

    // Build response message
    let message = "";
    switch (validatedParams.action) {
      case "click":
        message = `Clicked element`;
        break;
      case "type":
        message = `Typed "${validatedParams.text}" into element`;
        break;
      case "hover":
        message = `Hovered over element`;
        break;
      case "select":
        message = `Selected option "${validatedParams.value}" in element`;
        break;
      case "press":
        message = `Pressed key "${validatedParams.key}"`;
        break;
    }

    // If snapshot was requested, include ARIA tree
    if (validatedParams.snapshot && result.aria) {
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
      content: [
        {
          type: "text",
          text: message,
        },
      ],
    };
  },
};

// ============================================================================
// 4. CONSOLE - Get console logs
// ============================================================================

const ConsoleSchema = z.object({
  name: z.literal("console"),
  description: z.literal("Retrieve console logs from the browser page. Returns all captured console messages with their level, timestamp, and text."),
  arguments: z.object({}),
});

export const consoleLog: Tool = {
  schema: {
    name: ConsoleSchema.shape.name.value,
    description: ConsoleSchema.shape.description.value,
    inputSchema: zodToJsonSchema(ConsoleSchema.shape.arguments),
  },
  handle: async (context: Context): Promise<ToolResult> => {
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
  },
};

// Export all tools as an array for easy registration
export const tools: Tool[] = [snapshot, navigate, interact, consoleLog];
