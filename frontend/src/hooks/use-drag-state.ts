import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { DragDescriptor, DropTargetType } from "@/types/workbench";

export type DragStateApi = {
  activeDropTargets: DropTargetType[];
  activeDragItem: DragDescriptor | null;
  clearDropTargets: () => void;
  isDropTargetHighlighted: (targetType: DropTargetType) => boolean;
  setActiveDragItem: Dispatch<SetStateAction<DragDescriptor | null>>;
  setActiveDropTargets: Dispatch<SetStateAction<DropTargetType[]>>;
  showDropTargets: (dropTargets: readonly DropTargetType[]) => void;
};

export function useDragState(): DragStateApi {
  const [activeDropTargets, setActiveDropTargets] = useState<DropTargetType[]>([]);
  const [activeDragItem, setActiveDragItem] = useState<DragDescriptor | null>(null);

  const showDropTargets = useCallback((dropTargets: readonly DropTargetType[]) => {
    setActiveDropTargets([...dropTargets]);
  }, []);

  const clearDropTargets = useCallback(() => {
    setActiveDropTargets([]);
    setActiveDragItem(null);
  }, []);

  const isDropTargetHighlighted = useCallback((targetType: DropTargetType) => {
    return activeDropTargets.includes(targetType);
  }, [activeDropTargets]);

  return {
    activeDropTargets,
    activeDragItem,
    clearDropTargets,
    isDropTargetHighlighted,
    setActiveDragItem,
    setActiveDropTargets,
    showDropTargets,
  };
}
