/**
 * Content script
 *
 * Executes in the context of web pages and handles:
 * - ARIA snapshot generation
 * - DOM interactions (click, type, etc.)
 * - Console log capture
 */

import type { PlasmoCSConfig } from "plasmo";
import {
  generateAriaSnapshot
} from "~lib/aria-snapshot";
import {
  click,
  type as typeText,
  hover,
  select,
  press
} from "~lib/interactions";
import {
  initConsoleCapture,
  getConsoleLogs
} from "~lib/console-capture";
import type {
  InternalMessage,
  InternalResponse,
  MessageType,
  InteractParams,
  NavigateParams
} from "~lib/protocol";
import { ErrorCode } from "~lib/protocol";

// Plasmo content script configuration
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false,
  run_at: "document_end"
};

/**
 * Initialize content script
 */
function init(): void {
  // Initialize console capture
  initConsoleCapture();

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // Keep channel open for async response
  });

  console.log("[Content] Initialized on:", window.location.href);
}

/**
 * Handle messages from background script
 */
async function handleMessage(
  message: InternalMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): Promise<void> {
  console.log("[Content] Received message:", message);

  try {
    let result: any;

    switch (message.type) {
      case "SNAPSHOT":
        result = await handleSnapshot();
        break;

      case "NAVIGATE":
        result = await handleNavigate(message.params);
        break;

      case "INTERACT":
        result = await handleInteract(message.params);
        break;

      case "CONSOLE":
        result = await handleConsole();
        break;

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }

    // Send success response back to background
    const response: InternalResponse = {
      requestId: message.requestId,
      success: true,
      result
    };

    chrome.runtime.sendMessage({
      type: "CONTENT_RESPONSE",
      response
    });

    sendResponse({ success: true });
  } catch (error) {
    console.error("[Content] Error handling message:", error);

    // Parse error if it's a JSON string (from interactions.ts)
    let errorCode = ErrorCode.INTERNAL_ERROR;
    let errorMessage = error instanceof Error ? error.message : String(error);

    try {
      const parsedError = JSON.parse(errorMessage);
      if (parsedError.code && parsedError.message) {
        errorCode = parsedError.code;
        errorMessage = parsedError.message;
      }
    } catch {
      // Not a JSON error, use as-is
    }

    // Send error response back to background
    const response: InternalResponse = {
      requestId: message.requestId,
      success: false,
      error: {
        code: errorCode,
        message: errorMessage
      }
    };

    chrome.runtime.sendMessage({
      type: "CONTENT_RESPONSE",
      response
    });

    sendResponse({ success: false, error: errorMessage });
  }
}

/**
 * Handle snapshot request
 */
async function handleSnapshot(): Promise<any> {
  const snapshot = generateAriaSnapshot();
  console.log("[Content] Generated snapshot with", snapshot.elements.length, "elements");
  return snapshot;
}

/**
 * Handle navigate request
 */
async function handleNavigate(params: NavigateParams): Promise<any> {
  const { url } = params;

  // Navigate to URL
  window.location.href = url;

  // Wait for navigation to complete
  await new Promise((resolve) => {
    const checkReady = () => {
      if (document.readyState === "complete") {
        resolve(true);
      } else {
        setTimeout(checkReady, 100);
      }
    };
    checkReady();
  });

  return {
    url: window.location.href,
    title: document.title
  };
}

/**
 * Handle interact request
 */
async function handleInteract(params: InteractParams): Promise<any> {
  const { action, element, text, key, value, snapshot: includeSnapshot } = params;

  // Perform the interaction
  switch (action) {
    case "click":
      if (!element) {
        throw new Error("Element selector required for click action");
      }
      await click(element);
      break;

    case "type":
      if (!element || !text) {
        throw new Error("Element selector and text required for type action");
      }
      await typeText(element, text);
      break;

    case "hover":
      if (!element) {
        throw new Error("Element selector required for hover action");
      }
      await hover(element);
      break;

    case "select":
      if (!element || !value) {
        throw new Error("Element selector and value required for select action");
      }
      await select(element, value);
      break;

    case "press":
      if (!key) {
        throw new Error("Key required for press action");
      }
      await press(key);
      break;

    default:
      throw new Error(`Unknown action: ${action}`);
  }

  // Build response
  const result: any = { success: true };

  // Include snapshot if requested
  if (includeSnapshot) {
    const snapshot = generateAriaSnapshot();
    result.url = snapshot.url;
    result.title = snapshot.title;
    result.elements = snapshot.elements;
  }

  return result;
}

/**
 * Handle console request
 */
async function handleConsole(): Promise<any> {
  const logs = getConsoleLogs();
  console.log("[Content] Returning", logs.length, "console logs");
  return { logs };
}

// Initialize on load
init();
