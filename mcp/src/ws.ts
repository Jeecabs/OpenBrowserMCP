import { WebSocketServer } from "ws";

import { isPortInUse, killProcessOnPort } from "@/utils/port";

/**
 * Simple wait/delay function
 * @param ms - milliseconds to wait
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createWebSocketServer(
  port: number = Number(process.env.WS_PORT) || 9222,
): Promise<WebSocketServer> {
  killProcessOnPort(port);
  // Wait until the port is free
  while (await isPortInUse(port)) {
    await wait(100);
  }
  return new WebSocketServer({ port });
}
