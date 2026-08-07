"use client";

import { useEffect, useState } from "react";

import { getAcquisitionMethod, getAcquisitionMethodCatalog } from "@/lib/api";
import type { AcquisitionMethod, AcquisitionMethodSummary } from "@/types/workbench";

/**
 * Read the acquisition method library.
 *
 * `revision` is a cache-busting counter, not data: bump it after any write
 * (duplicate, save, delete) so every reader of the library converges on the
 * same list again. The hook only reads — it never decides which method is
 * selected, and it never depends on the vials sitting in the rack.
 */
export function useAcquisitionMethodCatalog(revision: number): AcquisitionMethodSummary[] {
  const [catalog, setCatalog] = useState<AcquisitionMethodSummary[]>([]);

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
  }, [revision]);

  return catalog;
}

type AcquisitionMethodDetail = {
  error: string | null;
  isLoading: boolean;
  method: AcquisitionMethod | null;
};

/** Read one method in full. Shares `revision` with the catalog hook. */
export function useAcquisitionMethodDetail(
  methodId: string,
  revision: number,
): AcquisitionMethodDetail {
  const [method, setMethod] = useState<AcquisitionMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
  }, [methodId, revision]);

  return { error, isLoading, method };
}
