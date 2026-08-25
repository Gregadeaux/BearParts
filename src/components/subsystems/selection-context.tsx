"use client";

import { createContext, useContext, useState } from "react";
import type { LibraryPartListing } from "@/types/library";

export interface PartSelection {
  part: LibraryPartListing;
  thumbUrl: string | null;
}

interface SelectionContextValue {
  selection: PartSelection | null;
  setSelection: (s: PartSelection | null) => void;
}

/** null outside a subsystem workspace — the library browser then keeps plain links. */
const SelectionContext = createContext<SelectionContextValue | null>(null);

export function useSubsystemSelection() {
  return useContext(SelectionContext);
}

/** Shares "which part is selected" between the Parts tab and the info panel. */
export function SubsystemSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<PartSelection | null>(null);
  return (
    <SelectionContext.Provider value={{ selection, setSelection }}>
      {children}
    </SelectionContext.Provider>
  );
}
