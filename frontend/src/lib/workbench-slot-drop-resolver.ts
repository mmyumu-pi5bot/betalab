import {
  resolveDropTargetFromActiveDrag,
  resolveDropTargetFromDataTransfer,
  type DropTargetNode,
} from "@/lib/drop-target-resolver";
import { containmentAcceptsDescriptor } from "@/lib/containment-resolver";
import {
  resolveToolDropTargetFromActiveDrag,
  resolveToolDropTargetFromDataTransfer,
} from "@/lib/tool-drop-resolver";
import { readDragDescriptor } from "@/lib/workbench-dnd";
import type { BenchSlot, BenchToolInstance, DragDescriptor } from "@/types/workbench";

type WorkbenchSlotDropResolution =
  | { kind: "slot" }
  | { kind: "tool"; tool: BenchToolInstance };

function canResolveOnWorkbenchSlot(
  descriptor: DragDescriptor | null,
  slot: BenchSlot,
) {
  if (descriptor === null) {
    return false;
  }
  if (
    !(slot.dropTargetTypes ?? []).some((targetType) =>
      descriptor.allowedDropTargets.includes(targetType),
    )
  ) {
    return false;
  }

  if (descriptor.entityKind === "tool") {
    if (!containmentAcceptsDescriptor(slot.containment, descriptor)) {
      return false;
    }
    return descriptor.sourceKind !== "workbench" || descriptor.sourceId !== slot.id;
  }

  if (descriptor.entityKind === "produce") {
    return containmentAcceptsDescriptor(slot.containment, descriptor);
  }

  return false;
}

function buildWorkbenchSlotDropTree(slot: BenchSlot): DropTargetNode<WorkbenchSlotDropResolution> {
  return {
    acceptsDrop: ({ activeDragItem, dataTransfer }) =>
      canResolveOnWorkbenchSlot(
        dataTransfer === null ? activeDragItem : readDragDescriptor(dataTransfer),
        slot,
      ),
    children: slot.tool === null
      ? []
      : [
          {
            acceptsDrop: ({ activeDragItem, dataTransfer }) =>
              (dataTransfer === null
                ? resolveToolDropTargetFromActiveDrag(activeDragItem, {
                    parentDropTargetTypes: slot.dropTargetTypes ?? [],
                    tool: slot.tool,
                  })
                : resolveToolDropTargetFromDataTransfer(dataTransfer, {
                    parentDropTargetTypes: slot.dropTargetTypes ?? [],
                    tool: slot.tool,
                  }))?.kind === "tool",
            resolveTarget: () => ({ kind: "tool", tool: slot.tool! }),
          },
        ],
    resolveTarget: () => ({ kind: "slot" }),
  };
}

function resolveWorkbenchSlotDropTargetFromDataTransfer(
  dataTransfer: DataTransfer,
  slot: BenchSlot,
) {
  return resolveDropTargetFromDataTransfer(buildWorkbenchSlotDropTree(slot), dataTransfer);
}

function resolveWorkbenchSlotDropTargetFromActiveDrag(
  dragDescriptor: DragDescriptor | null,
  slot: BenchSlot,
) {
  return resolveDropTargetFromActiveDrag(buildWorkbenchSlotDropTree(slot), dragDescriptor);
}

export function canResolveWorkbenchSlotDrop(
  dataTransfer: DataTransfer,
  slot: BenchSlot,
) {
  return resolveWorkbenchSlotDropTargetFromDataTransfer(dataTransfer, slot) !== null;
}

export function canResolveActiveWorkbenchSlotDrop(
  dragDescriptor: DragDescriptor | null,
  slot: BenchSlot,
) {
  return resolveWorkbenchSlotDropTargetFromActiveDrag(dragDescriptor, slot) !== null;
}
