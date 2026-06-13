import {
  resolveDropTargetFromActiveDrag,
  resolveDropTargetFromDataTransfer,
  type DropTargetNode,
} from "@/lib/drop-target-resolver";
import { containmentAcceptsDescriptor } from "@/lib/containment-resolver";
import { readDragDescriptor } from "@/lib/workbench-dnd";
import type { BenchToolInstance, DragDescriptor, DropTargetType } from "@/types/workbench";

type ToolDropResolution =
  | { kind: "parent" }
  | { kind: "tool"; tool: BenchToolInstance };

function canDescriptorResolveOnTool(
  descriptor: DragDescriptor | null,
  {
    parentDropTargetTypes,
    tool,
  }: {
    parentDropTargetTypes: DropTargetType[];
    tool: BenchToolInstance | null;
  },
) {
  if (descriptor === null || tool === null) {
    return false;
  }

  if (
    descriptor.entityKind !== "liquid" &&
    !parentDropTargetTypes.some((targetType) => descriptor.allowedDropTargets.includes(targetType))
  ) {
    return false;
  }

  return containmentAcceptsDescriptor(tool.containment, descriptor);
}

function buildToolDropTree({
  parentDropTargetTypes,
  tool,
}: {
  parentDropTargetTypes: DropTargetType[];
  tool: BenchToolInstance | null;
}): DropTargetNode<ToolDropResolution> {
  return {
    acceptsDrop: () => false,
    children:
      tool === null
        ? []
        : [
            {
              acceptsDrop: ({ activeDragItem, dataTransfer }) =>
                canDescriptorResolveOnTool(
                  dataTransfer === null ? activeDragItem : readDragDescriptor(dataTransfer),
                  { parentDropTargetTypes, tool },
                ),
              resolveTarget: () => ({ kind: "tool", tool }),
            },
          ],
    resolveTarget: () => ({ kind: "parent" }),
  };
}

export function resolveToolDropTargetFromDataTransfer(
  dataTransfer: DataTransfer,
  {
    parentDropTargetTypes,
    tool,
  }: {
    parentDropTargetTypes: DropTargetType[];
    tool: BenchToolInstance | null;
  },
) {
  return resolveDropTargetFromDataTransfer(
    buildToolDropTree({ parentDropTargetTypes, tool }),
    dataTransfer,
  );
}

export function resolveToolDropTargetFromActiveDrag(
  dragDescriptor: DragDescriptor | null,
  {
    parentDropTargetTypes,
    tool,
  }: {
    parentDropTargetTypes: DropTargetType[];
    tool: BenchToolInstance | null;
  },
) {
  return resolveDropTargetFromActiveDrag(
    buildToolDropTree({ parentDropTargetTypes, tool }),
    dragDescriptor,
  );
}

export function canResolveDropOnTool(
  dataTransfer: DataTransfer,
  {
    parentDropTargetTypes,
    tool,
  }: {
    parentDropTargetTypes: DropTargetType[];
    tool: BenchToolInstance | null;
  },
) {
  return (
    resolveToolDropTargetFromDataTransfer(dataTransfer, {
      parentDropTargetTypes,
      tool,
    })?.kind === "tool"
  );
}

export function canResolveActiveDragOnTool(
  dragDescriptor: DragDescriptor | null,
  {
    parentDropTargetTypes,
    tool,
  }: {
    parentDropTargetTypes: DropTargetType[];
    tool: BenchToolInstance | null;
  },
) {
  return (
    resolveToolDropTargetFromActiveDrag(dragDescriptor, {
      parentDropTargetTypes,
      tool,
    })?.kind === "tool"
  );
}
