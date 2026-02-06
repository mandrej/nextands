"use client";

import React, { createContext, useContext, useState } from "react";

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

  const resetFilters = () => setFilters(initialFilters);
  const triggerRefresh = () =>
    setFilters((prev) => ({ ...prev, refreshKey: prev.refreshKey + 1 }));

  return (
    <FilterContext.Provider
      value={{ filters, setFilters, resetFilters, triggerRefresh }}
    >
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
