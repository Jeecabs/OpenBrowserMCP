/**
 * Background service worker
 *
 * Manages WebSocket connection to MCP server and routes messages
 * between server and content script.
 */

import type {
  Request,
  Response,
  SuccessResponse,
  ErrorResponse,
  InternalMessage,
  InternalResponse,
  MessageType,
  SnapshotParams
} from "~lib/protocol";
import { ErrorCode } from "~lib/protocol";

// WebSocket connection
let ws: WebSocket | null = null;
let wsUrl = process.env.PLASMO_PUBLIC_WS_URL || "ws://localhost:9222";

// Connected tab ID
let connectedTabId: number | null = null;

// Pending requests (waiting for content script response)
const pendingRequests = new Map<string, (response: Response) => void>();

// Connection state
let connectionState: "disconnected" | "connecting" | "connected" = "disconnected";
let connectionStartTime: number | null = null;
let messagesReceived = 0;
let messagesSent = 0;

/**
 * Initialize background script
 */
function init(): void {
  // Listen for messages from popup and content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // Keep channel open for async response
  });

  console.log("[Background] Initialized");
}

/**
 * Handle messages from popup and content script
 */
async function handleMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    if (message.type === "CONNECT") {
      await connect(message.tabId, message.wsUrl);
      sendResponse({ success: true });
    } else if (message.type === "DISCONNECT") {
      disconnect();
      sendResponse({ success: true });
    } else if (message.type === "GET_STATE") {
      sendResponse(getState());
    } else if (message.type === "CONTENT_RESPONSE") {
      // Response from content script
      handleContentResponse(message.response);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "Unknown message type" });
    }
  } catch (error) {
    console.error("[Background] Error handling message:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Connect to WebSocket server
 */
async function connect(tabId: number, url?: string): Promise<void> {
  if (ws && ws.readyState === WebSocket.OPEN) {
    throw new Error("Already connected");
  }

  if (url) {
    wsUrl = url;
  }

  connectionState = "connecting";
  connectedTabId = tabId;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("[Background] WebSocket connected");
      connectionState = "connected";
      connectionStartTime = Date.now();
      messagesReceived = 0;
      messagesSent = 0;

      // Notify popup of state change
      broadcastState();
    };

    ws.onmessage = (event) => {
      messagesReceived++;
      handleServerMessage(event.data);
    };

    ws.onerror = (error) => {
      console.error("[Background] WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("[Background] WebSocket closed");
      connectionState = "disconnected";
      connectedTabId = null;
      ws = null;

      // Notify popup of state change
      broadcastState();
    };

    // Wait for connection to open
    await waitForConnection(ws);
  } catch (error) {
    connectionState = "disconnected";
    connectedTabId = null;
    ws = null;
    throw error;
  }
}

/**
 * Disconnect from WebSocket server
 */
function disconnect(): void {
  if (ws) {
    ws.close();
    ws = null;
  }
  connectionState = "disconnected";
  connectedTabId = null;
  broadcastState();
}

/**
 * Capture screenshot of the current tab
 */
async function captureScreenshot(tabId: number): Promise<string | null> {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
      format: "png"
    });
    return dataUrl;
  } catch (error) {
    console.error("[Background] Failed to capture screenshot:", error);
    return null;
  }
}

/**
 * Handle incoming message from server
 */
async function handleServerMessage(data: string): Promise<void> {
  try {
    const request: Request = JSON.parse(data);
    console.log("[Background] Received request:", request);

    // Check if we have a connected tab
    if (!connectedTabId) {
      sendErrorResponse(request.id, ErrorCode.NO_TAB, "No tab connected");
      return;
    }

    // Forward to content script
    const internalMessage: InternalMessage = {
      type: request.method.toUpperCase() as MessageType,
      requestId: request.id,
      params: request.params
    };

    // Store pending request
    const responsePromise = new Promise<Response>((resolve) => {
      pendingRequests.set(request.id, resolve);
    });

    // Send to content script
    chrome.tabs.sendMessage(connectedTabId, internalMessage);

    // Wait for response with timeout
    const timeoutPromise = new Promise<Response>((resolve) => {
      setTimeout(() => {
        resolve({
          id: request.id,
          error: {
            code: ErrorCode.TIMEOUT,
            message: "Request timed out"
          }
        });
      }, 30000); // 30 second timeout
    });

    const response = await Promise.race([responsePromise, timeoutPromise]);

    // Clean up pending request
    pendingRequests.delete(request.id);

    // For snapshot requests, capture screenshot if enabled (default: true)
    if (request.method === "snapshot" && "result" in response) {
      const params = (request.params || {}) as SnapshotParams;
      const shouldScreenshot = params.screenshot !== false; // Default true

      if (shouldScreenshot && connectedTabId) {
        const screenshot = await captureScreenshot(connectedTabId);
        if (screenshot && response.result) {
          (response.result as any).screenshot = screenshot;
        }
      }
    }

    // Send response to server
    sendResponse(response);
  } catch (error) {
    console.error("[Background] Error handling server message:", error);
  }
}

/**
 * Handle response from content script
 */
function handleContentResponse(response: InternalResponse): void {
  const resolver = pendingRequests.get(response.requestId);
  if (!resolver) {
    console.warn("[Background] No pending request for:", response.requestId);
    return;
  }

  // Convert internal response to protocol response
  const protocolResponse: Response = response.success
    ? { id: response.requestId, result: response.result }
    : {
        id: response.requestId,
        error: response.error || {
          code: ErrorCode.INTERNAL_ERROR,
          message: "Unknown error"
        }
      };

  resolver(protocolResponse);
}

/**
 * Send response to server
 */
function sendResponse(response: Response): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error("[Background] Cannot send response: WebSocket not connected");
    return;
  }

  messagesSent++;
  ws.send(JSON.stringify(response));
  console.log("[Background] Sent response:", response);
}

/**
 * Send error response to server
 */
function sendErrorResponse(id: string, code: ErrorCode, message: string): void {
  const response: ErrorResponse = {
    id,
    error: { code, message }
  };
  sendResponse(response);
}

/**
 * Get current connection state
 */
function getState(): any {
  return {
    connectionState,
    connectedTabId,
    wsUrl,
    connectionStartTime,
    messagesReceived,
    messagesSent
  };
}

/**
 * Broadcast state to all popup instances
 */
function broadcastState(): void {
  chrome.runtime.sendMessage({
    type: "STATE_UPDATE",
    state: getState()
  }).catch(() => {
    // Ignore errors if popup is not open
  });
}

/**
 * Wait for WebSocket to connect
 */
function waitForConnection(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Connection timeout"));
    }, 5000);

    const checkState = () => {
      if (ws.readyState === WebSocket.OPEN) {
        clearTimeout(timeout);
        resolve();
      } else if (ws.readyState === WebSocket.CLOSED) {
        clearTimeout(timeout);
        reject(new Error("Connection failed"));
      }
    };

    ws.addEventListener("open", checkState);
    ws.addEventListener("error", checkState);
    ws.addEventListener("close", checkState);
  });
}

// Initialize on load
init();

// Export empty object to satisfy Plasmo
export {};
