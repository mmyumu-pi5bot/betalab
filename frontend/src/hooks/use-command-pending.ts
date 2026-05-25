import { useCallback, useRef, useState } from "react";

export function useCommandPending() {
  const [isPending, setIsPending] = useState(false);
  const isPendingRef = useRef(false);

  const setPending = useCallback((value: boolean) => {
    isPendingRef.current = value;
    setIsPending(value);
  }, []);

  return { isPending, isPendingRef, setPending } as const;
}
