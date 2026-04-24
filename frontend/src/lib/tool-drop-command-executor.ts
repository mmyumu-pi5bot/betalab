import type { ToolDropCommand } from "@/lib/tool-drop-command-resolver";
import type { MoveToolPayload, PlaceToolFromPalettePayload } from "@/types/api-payloads";

type ToolDropApi = {
  moveTool: (payload: MoveToolPayload) => void;
  placeToolFromPalette: (payload: PlaceToolFromPalettePayload) => void;
};

export function executeToolDropCommand(command: ToolDropCommand, api: ToolDropApi): boolean {
  if (command.kind === "move_tool") {
    void api.moveTool(command.payload);
    return true;
  }
  if (command.kind === "place_tool_from_palette") {
    void api.placeToolFromPalette(command.payload);
    return true;
  }
  return false;
}
