/**
 * Protocol types and error codes for Browser MCP Chrome Extension
 *
 * Wire format: JSON over WebSocket
 */

// Request types (Server → Extension)
export interface Request {
  id: string;
  method: "snapshot" | "navigate" | "interact" | "console";
  params: Record<string, any>;
}

export interface SnapshotParams {}

export interface NavigateParams {
  url: string;
}

export interface InteractParams {
  action: "click" | "type" | "hover" | "select" | "press";
  element?: ElementSelector;
  text?: string;
  key?: string;
  value?: string;
  snapshot?: boolean;
}

export interface ConsoleParams {}

// Response types (Extension → Server)
export interface SuccessResponse {
  id: string;
  result: any;
}

export interface ErrorResponse {
  id: string;
  error: {
    code: ErrorCode;
    message: string;
  };
}

export type Response = SuccessResponse | ErrorResponse;

// Element selection strategies
export type ElementSelector =
  | { ref: string }                    // ARIA snapshot ref: "e1", "e2"
  | { css: string }                    // CSS selector: ".submit-btn"
  | { role: string; name?: string };   // Accessibility: { role: "button", name: "Submit" }

// Error codes
export enum ErrorCode {
  ELEMENT_NOT_FOUND = "ELEMENT_NOT_FOUND",
  ELEMENT_AMBIGUOUS = "ELEMENT_AMBIGUOUS",
  TIMEOUT = "TIMEOUT",
  NO_TAB = "NO_TAB",
  NAVIGATION_FAILED = "NAVIGATION_FAILED",
  INVALID_REQUEST = "INVALID_REQUEST",
  INTERNAL_ERROR = "INTERNAL_ERROR"
}

// ARIA snapshot types (TOON format)
export interface AriaElement {
  ref: string;
  role: string;
  name: string;
  states: string;
}

export interface AriaSnapshot {
  url: string;
  title: string;
  elements: AriaElement[];
}

// Navigate response
export interface NavigateResult {
  url: string;
  title: string;
}

// Interact response
export interface InteractResult {
  success: boolean;
  url?: string;
  title?: string;
  elements?: AriaElement[];
}

// Console log types
export interface ConsoleLog {
  level: "log" | "info" | "warn" | "error" | "debug";
  ts: number;
  text: string;
}

export interface ConsoleResult {
  logs: ConsoleLog[];
}

// Message types for internal communication (background ↔ content)
export enum MessageType {
  SNAPSHOT = "SNAPSHOT",
  NAVIGATE = "NAVIGATE",
  INTERACT = "INTERACT",
  CONSOLE = "CONSOLE",
  INIT = "INIT"
}

export interface InternalMessage {
  type: MessageType;
  requestId: string;
  params?: any;
}

export interface InternalResponse {
  requestId: string;
  success: boolean;
  result?: any;
  error?: {
    code: ErrorCode;
    message: string;
  };
}
