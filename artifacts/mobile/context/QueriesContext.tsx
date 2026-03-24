import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { DEFAULT_QUERIES } from "@/constants/defaultQueries";

export { DEFAULT_QUERIES };

interface QueriesContextType {
  unusedQueries: string[];
  usedQueries: string[];
  setUnusedQueries: (queries: string[]) => void;
  pickQueries: (count: number) => string[];
  moveToUnused: (query: string) => void;
  deleteUsedQuery: (query: string) => void;
  clearAllUsed: () => void;
  restoreAllUsed: () => void;
}

const QueriesContext = createContext<QueriesContextType | null>(null);
const QUERIES_KEY = "@ms_rewards_queries_v2";

export function QueriesProvider({ children }: { children: React.ReactNode }) {
  const [unusedQueries, setUnusedState] = useState<string[]>(DEFAULT_QUERIES);
  const [usedQueries, setUsedState] = useState<string[]>([]);
  const unusedRef = useRef<string[]>(DEFAULT_QUERIES);
  const usedRef = useRef<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(QUERIES_KEY);
        if (raw) {
          const { unused, used } = JSON.parse(raw);
          const u = Array.isArray(unused) && unused.length > 0 ? unused : DEFAULT_QUERIES;
          const us = Array.isArray(used) ? used : [];
          unusedRef.current = u;
          usedRef.current = us;
          setUnusedState(u);
          setUsedState(us);
        }
      } catch {}
    })();
  }, []);

  const save = useCallback((unused: string[], used: string[]) => {
    AsyncStorage.setItem(QUERIES_KEY, JSON.stringify({ unused, used }));
  }, []);

  const setUnusedQueries = useCallback(
    (queries: string[]) => {
      unusedRef.current = queries;
      setUnusedState(queries);
      save(queries, usedRef.current);
    },
    [save]
  );

  const pickQueries = useCallback(
    (count: number): string[] => {
      let available = [...unusedRef.current];
      if (available.length < count) {
        available = [...available, ...usedRef.current];
        usedRef.current = [];
      }
      const shuffled = available.sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, Math.min(count, shuffled.length));
      const remaining = shuffled.slice(picked.length);
      unusedRef.current = remaining;
      usedRef.current = [...usedRef.current, ...picked];
      setUnusedState([...remaining]);
      setUsedState([...usedRef.current]);
      save(remaining, usedRef.current);
      return picked;
    },
    [save]
  );

  const moveToUnused = useCallback(
    (query: string) => {
      usedRef.current = usedRef.current.filter((q) => q !== query);
      unusedRef.current = [...unusedRef.current, query];
      setUsedState([...usedRef.current]);
      setUnusedState([...unusedRef.current]);
      save(unusedRef.current, usedRef.current);
    },
    [save]
  );

  const deleteUsedQuery = useCallback(
    (query: string) => {
      usedRef.current = usedRef.current.filter((q) => q !== query);
      setUsedState([...usedRef.current]);
      save(unusedRef.current, usedRef.current);
    },
    [save]
  );

  const clearAllUsed = useCallback(() => {
    usedRef.current = [];
    setUsedState([]);
    save(unusedRef.current, []);
  }, [save]);

  const restoreAllUsed = useCallback(() => {
    const all = [...unusedRef.current, ...usedRef.current];
    unusedRef.current = all;
    usedRef.current = [];
    setUnusedState([...all]);
    setUsedState([]);
    save(all, []);
  }, [save]);

  return (
    <QueriesContext.Provider
      value={{
        unusedQueries,
        usedQueries,
        setUnusedQueries,
        pickQueries,
        moveToUnused,
        deleteUsedQuery,
        clearAllUsed,
        restoreAllUsed,
      }}
    >
      {children}
    </QueriesContext.Provider>
  );
}

export function useQueries() {
  const ctx = useContext(QueriesContext);
  if (!ctx) throw new Error("useQueries must be used within QueriesProvider");
  return ctx;
}
