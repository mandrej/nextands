"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";

interface SelectionContextType {
  selectedIds: string[];
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
}

const SelectionContext = createContext<SelectionContextType | undefined>(
  undefined,
);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const isSelected = useCallback(
    (id: string) => selectedIds.includes(id),
    [selectedIds],
  );

  const contextValue = useMemo(
    () => ({
      selectedIds,
      toggleSelection,
      clearSelection,
      isSelected,
    }),
    [selectedIds, toggleSelection, clearSelection, isSelected],
  );

  return (
    <SelectionContext.Provider value={contextValue}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (context === undefined) {
    throw new Error("useSelection must be used within a SelectionProvider");
  }
  return context;
}
