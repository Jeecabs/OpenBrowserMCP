import { z } from 'zod';

// ============================================================================
// Element Selection Types
// ============================================================================

export const ElementSelectorRefSchema = z.object({
  ref: z.string(),
});

export const ElementSelectorCssSchema = z.object({
  css: z.string(),
});

export const ElementSelectorRoleSchema = z.object({
  role: z.string(),
  name: z.string().optional(),
});

export const ElementSelectorSchema = z.union([
  ElementSelectorRefSchema,
  ElementSelectorCssSchema,
  ElementSelectorRoleSchema,
]);

export type ElementSelectorRef = z.infer<typeof ElementSelectorRefSchema>;
export type ElementSelectorCss = z.infer<typeof ElementSelectorCssSchema>;
export type ElementSelectorRole = z.infer<typeof ElementSelectorRoleSchema>;
export type ElementSelector = z.infer<typeof ElementSelectorSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export enum ErrorCode {
  ELEMENT_NOT_FOUND = 'ELEMENT_NOT_FOUND',
  ELEMENT_AMBIGUOUS = 'ELEMENT_AMBIGUOUS',
  TIMEOUT = 'TIMEOUT',
  NO_TAB = 'NO_TAB',
  NAVIGATION_FAILED = 'NAVIGATION_FAILED',
}

export const ErrorCodeSchema = z.nativeEnum(ErrorCode);

// ============================================================================
// JSON-RPC Types
// ============================================================================

export const JsonRpcRequestSchema = z.object({
  id: z.string(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()),
});

export const JsonRpcErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
});

export const JsonRpcResponseSchema = z.object({
  id: z.string(),
  result: z.unknown().optional(),
  error: JsonRpcErrorSchema.optional(),
});

export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;
export type JsonRpcError = z.infer<typeof JsonRpcErrorSchema>;
export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;

// ============================================================================
// Tool Parameter Types
// ============================================================================

export const SnapshotParamsSchema = z.object({});

export const NavigateParamsSchema = z.object({
  url: z.string(),
});

export const InteractParamsSchema = z.object({
  action: z.string(),
  element: ElementSelectorSchema,
  text: z.string().optional(),
  key: z.string().optional(),
  value: z.string().optional(),
  snapshot: z.boolean().optional(),
});

export const ConsoleParamsSchema = z.object({});

export type SnapshotParams = z.infer<typeof SnapshotParamsSchema>;
export type NavigateParams = z.infer<typeof NavigateParamsSchema>;
export type InteractParams = z.infer<typeof InteractParamsSchema>;
export type ConsoleParams = z.infer<typeof ConsoleParamsSchema>;

// ============================================================================
// Response Types
// ============================================================================

export const SnapshotResultSchema = z.object({
  url: z.string(),
  title: z.string(),
  aria: z.string(),
});

export const NavigateResultSchema = z.object({
  url: z.string(),
  title: z.string(),
});

export const InteractResultSchema = z.object({
  success: z.boolean(),
  url: z.string().optional(),
  title: z.string().optional(),
  aria: z.string().optional(),
});

export const ConsoleLogSchema = z.object({
  level: z.string(),
  ts: z.number(),
  text: z.string(),
});

export const ConsoleResultSchema = z.object({
  logs: z.array(ConsoleLogSchema),
});

export type SnapshotResult = z.infer<typeof SnapshotResultSchema>;
export type NavigateResult = z.infer<typeof NavigateResultSchema>;
export type InteractResult = z.infer<typeof InteractResultSchema>;
export type ConsoleLog = z.infer<typeof ConsoleLogSchema>;
export type ConsoleResult = z.infer<typeof ConsoleResultSchema>;
