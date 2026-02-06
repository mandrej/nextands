"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { getDocs, doc, runTransaction } from "firebase/firestore";
import { counterCollection } from "../helpers/collections";
import { CounterRecord, ValuesState } from "../helpers/models";
import { counterId, CONFIG } from "../helpers/index";
import { db } from "../firebase";

const STORAGE_KEY = "values_state";

const initialValues: ValuesState = {
  headlineToApply: "",
  tagsToApply: [],
  values: CONFIG.photo_filter.reduce((acc, filter) => {
    acc[filter] = {};
    return acc;
  }, {} as { [key: string]: { [key: string]: number } }),
};

interface CountersContextType {
  values: ValuesState;
  setValues: React.Dispatch<React.SetStateAction<ValuesState>>;
  loading: boolean;
  refreshCounters: () => Promise<void>;
  updateCounter: (
    field: string,
    value: string,
    change: number
  ) => Promise<void>;
  counts: {
    [key: string]: number;
  };
}

const CountersContext = createContext<CountersContextType | undefined>(
  undefined
);

export function CountersProvider({ children }: { children: React.ReactNode }) {
  const [values, setValues] = useState<ValuesState>(initialValues);
  const [loading, setLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setValues(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load state from localStorage", e);
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  }, [values]);

  const counts = CONFIG.photo_filter.reduce((acc, filter) => {
    acc[filter] = Object.keys(values.values[filter] || {}).length;
    return acc;
  }, {} as { [key: string]: number });

  const fetchCounters = useCallback(async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(counterCollection);
      setValues((prev) => {
        const newValues: ValuesState = {
          headlineToApply: prev.headlineToApply,
          tagsToApply: prev.tagsToApply,
          values: CONFIG.photo_filter.reduce((acc, filter) => {
            acc[filter] = {};
            return acc;
          }, {} as { [key: string]: { [key: string]: number } }),
        };

        querySnapshot.forEach((doc) => {
          const data = doc.data() as CounterRecord;
          if (
            data.field &&
            data.value !== undefined &&
            data.count !== undefined
          ) {
            if (newValues.values[data.field]) {
              newValues.values[data.field][data.value] = data.count;
            }
          }
        });
        return newValues;
      });
    } catch (error) {
      console.error("Error getting counters:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCounter = useCallback(async function update(
    field: string,
    value: string,
    change: number
  ) {
    if (!field || !value || change === 0) return;

    const id = counterId(field, value);
    const ref = doc(counterCollection, id);

    try {
      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(ref);

        if (!sfDoc.exists()) {
          if (change > 0) {
            transaction.set(ref, { field, value, count: change });
          }
        } else {
          const data = sfDoc.data() as CounterRecord;
          const newCount = (data.count || 0) + change;
          if (newCount <= 0) {
            transaction.delete(ref);
          } else {
            transaction.update(ref, { count: newCount });
          }
        }
      });

      // Update local state
      setValues((prev) => {
        const next = { ...prev };
        const key = field;

        if (next.values[key]) {
          const fieldValues = { ...next.values[key] };

          const currentCount = fieldValues[value] || 0;
          const finalCount = currentCount + change;

          if (finalCount <= 0) {
            delete fieldValues[value];
          } else {
            fieldValues[value] = finalCount;
          }

          next.values[key] = fieldValues;
        }
        return next;
      });

      // Sync nick with email
      if (field === "email") {
        const nick = CONFIG.familyMap.get(value);
        if (nick) {
          await update("nick", nick, change);
        }
      }
    } catch (e) {
      console.error("Transaction failed: ", e);
    }
  },
  []);

  useEffect(() => {
    fetchCounters();
  }, [fetchCounters]);

  return (
    <CountersContext.Provider
      value={{
        values,
        setValues,
        loading,
        refreshCounters: fetchCounters,
        updateCounter,
        counts,
      }}
    >
      {children}
    </CountersContext.Provider>
  );
}

export function useCounters() {
  const context = useContext(CountersContext);
  if (context === undefined) {
    throw new Error("useCounters must be used within a CountersProvider");
  }
  return context;
}
