"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";

export interface FilterState {
  year: string | null;
  month: string | null;
  day: number | null;
  tags: string[];
  model: string | null;
  lens: string | null;
  nick: string | null;
  text: string[];
  searchText: string;
  refreshKey: number;
}

const initialFilters: FilterState = {
  year: null,
  month: null,
  day: null,
  tags: [],
  model: null,
  lens: null,
  nick: null,
  text: [],
  searchText: "",
  refreshKey: 0,
};

interface FilterContextType {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  resetFilters: () => void;
  triggerRefresh: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  const resetFilters = useCallback(() => setFilters(initialFilters), []);
  const triggerRefresh = useCallback(
    () => setFilters((prev) => ({ ...prev, refreshKey: prev.refreshKey + 1 })),
    [],
  );

  const contextValue = useMemo(
    () => ({
      filters,
      setFilters,
      resetFilters,
      triggerRefresh,
    }),
    [filters, resetFilters, triggerRefresh],
  );

  return (
    <FilterContext.Provider value={contextValue}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error("useFilter must be used within a FilterProvider");
  }
  return context;
}
