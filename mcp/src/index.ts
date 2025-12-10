#!/usr/bin/env node
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { program } from "commander";

import type { Resource } from "@/resources/resource";
import { createServerWithTools } from "@/server";
import { tools } from "@/tools";

import packageJSON from "../package.json";

const APP_NAME = "openbrowsermcp";

function setupExitWatchdog(server: Server) {
  process.stdin.on("close", async () => {
    setTimeout(() => process.exit(0), 15000);
    await server.close();
    process.exit(0);
  });
}

const resources: Resource[] = [];

async function createServer(): Promise<Server> {
  return createServerWithTools({
    name: APP_NAME,
    version: packageJSON.version,
    tools,
    resources,
  });
}

/**
 * Note: Tools must be defined *before* calling `createServer` because only declarations are hoisted, not the initializations
 */
program
  .version("Version " + packageJSON.version)
  .name(packageJSON.name)
  .action(async () => {
    const server = await createServer();
    setupExitWatchdog(server);

    const transport = new StdioServerTransport();
    await server.connect(transport);
  });
program.parse(process.argv);
