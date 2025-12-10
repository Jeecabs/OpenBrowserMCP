import { encode } from "@toon-format/toon";

import { Context } from "@/context";
import { ToolResult } from "@/tools/tool";

/**
 * ARIA Snapshot types (matching extension protocol)
 */
interface AriaElement {
  ref: string;
  role: string;
  name: string;
  states: string;
}

interface AriaSnapshot {
  url: string;
  title: string;
  elements: AriaElement[];
}

export async function captureAriaSnapshot(
  context: Context,
  status: string = "",
): Promise<ToolResult> {
  const snapshot = await context.sendSocketMessage("browser_snapshot", {}) as AriaSnapshot;

  // Encode the snapshot using TOON format for efficient token usage
  const toonEncoded = encode(snapshot);

  return {
    content: [
      {
        type: "text",
        text: `${status ? `${status}\n` : ""}${toonEncoded}`,
      },
    ],
  };
}
