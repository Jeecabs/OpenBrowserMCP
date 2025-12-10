import { WebSocket } from "ws";
import { randomUUID } from "crypto";

import { ErrorCode, JsonRpcRequest, JsonRpcResponse } from "./protocol";

const noConnectionMessage = `No connection to browser extension. In order to proceed, you must first connect a tab by clicking the Browser MCP extension icon in the browser toolbar and clicking the 'Connect' button.`;

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class Context {
  private _ws: WebSocket | undefined;
  private pendingRequests = new Map<string, PendingRequest>();

  get ws(): WebSocket {
    if (!this._ws) {
      throw new Error(noConnectionMessage);
    }
    return this._ws;
  }

  set ws(ws: WebSocket) {
    this._ws = ws;

    // Set up message handler for incoming WebSocket messages
    this._ws.on("message", (data: Buffer) => {
      try {
        const response = JSON.parse(data.toString()) as JsonRpcResponse;
        this.handleResponse(response);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    });
  }

  hasWs(): boolean {
    return !!this._ws;
  }

  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id);

    if (!pending) {
      console.warn(`Received response for unknown request ID: ${response.id}`);
      return;
    }

    // Clean up
    clearTimeout(pending.timer);
    this.pendingRequests.delete(response.id);

    // Handle response
    if (response.error) {
      const error = new Error(response.error.message);
      (error as any).code = response.error.code;
      pending.reject(error);
    } else {
      pending.resolve(response.result);
    }
  }

  async sendRpcRequest<T>(
    method: string,
    params: Record<string, any>,
    timeoutMs = 30000
  ): Promise<T> {
    // Generate UUID for correlation
    const id = randomUUID();

    // Create JSON-RPC request
    const request: JsonRpcRequest = {
      id,
      method,
      params,
    };

    // Create promise for response
    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        const error = new Error(`Request timed out after ${timeoutMs}ms`);
        (error as any).code = ErrorCode.TIMEOUT;
        reject(error);
      }, timeoutMs);

      // Store pending request
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timer,
      });

      // Send request
      try {
        this.ws.send(JSON.stringify(request));
      } catch (error) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        if (error instanceof Error && error.message.includes("not connected")) {
          reject(new Error(noConnectionMessage));
        } else {
          reject(error);
        }
      }
    });
  }

  // Legacy method for backwards compatibility - delegates to sendRpcRequest
  async sendSocketMessage<T>(
    type: string,
    payload: Record<string, any>,
    options: { timeoutMs?: number } = { timeoutMs: 30000 }
  ): Promise<T> {
    return this.sendRpcRequest<T>(type, payload, options.timeoutMs);
  }

  async close() {
    if (!this._ws) {
      return;
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Connection closed"));
    }
    this.pendingRequests.clear();

    await this._ws.close();
  }
}
