import type { ToolDropCommand } from "@/lib/tool-drop-command-resolver";
import type { MoveObjectPayload } from "@/types/api-payloads";

type ToolDropApi = {
  moveObject: (payload: MoveObjectPayload) => void;
};

export function executeToolDropCommand(command: ToolDropCommand | null, api: ToolDropApi): boolean {
  if (!command) {
    return false;
  }

  void api.moveObject(command.payload);
  return true;
}
