"use client";

import { useCallback, useEffect, useState } from "react";

import { getAcquisitionMethod, getAcquisitionMethodCatalog } from "@/lib/api";
import type { AcquisitionMethod, AcquisitionMethodSummary } from "@/types/workbench";

type AcquisitionMethodState = {
  catalog: AcquisitionMethodSummary[];
  error: string | null;
  isLoading: boolean;
  method: AcquisitionMethod | null;
  /** Adopt a method that was just saved, and refresh the catalog around it. */
  reload: (method: AcquisitionMethod) => void;
};

/**
 * Load the read-only acquisition method catalog and the detail of `methodId`.
 *
 * The selection belongs to the sequence, so this hook only reads: it never
 * decides which method is selected and never depends on the vials in the rack.
 */
export function useAcquisitionMethod(methodId: string): AcquisitionMethodState {
  const [catalog, setCatalog] = useState<AcquisitionMethodSummary[]>([]);
  const [method, setMethod] = useState<AcquisitionMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [catalogRevision, setCatalogRevision] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    getAcquisitionMethodCatalog()
      .then((entries) => {
        if (isCurrent) setCatalog(entries);
      })
      .catch(() => {
        if (isCurrent) setCatalog([]);
      });
    return () => {
      isCurrent = false;
    };
  }, [catalogRevision]);

  const reload = useCallback((saved: AcquisitionMethod) => {
    setMethod(saved);
    setCatalogRevision((revision) => revision + 1);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError(null);
    getAcquisitionMethod(methodId)
      .then((loaded) => {
        if (!isCurrent) return;
        setMethod(loaded);
        setIsLoading(false);
      })
      .catch((cause: unknown) => {
        if (!isCurrent) return;
        setMethod(null);
        setError(cause instanceof Error ? cause.message : "Failed to load the method.");
        setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [methodId]);

  return { catalog, error, isLoading, method, reload };
}
