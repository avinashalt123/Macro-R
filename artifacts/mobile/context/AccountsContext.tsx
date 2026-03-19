import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type AccountStatus = "idle" | "running" | "done" | "failed";

export interface Account {
  id: string;
  name: string;
  email: string;
  status: AccountStatus;
  totalPoints: number;
  todayPoints: number;
  lastRun: string | null;
  searchCount: number;
  dailySetEnabled: boolean;
  cookies: Record<string, string>;
  searchesCompleted: number;
}

export interface RunLog {
  id: string;
  accountId: string;
  accountName: string;
  timestamp: string;
  searchesDone: number;
  dailySetDone: boolean;
  pointsEarned: number;
  status: "success" | "failed";
  errorMessage?: string;
}

interface AccountsContextType {
  accounts: Account[];
  logs: RunLog[];
  addAccount: (account: Omit<Account, "id" | "status" | "totalPoints" | "todayPoints" | "searchesCompleted">) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  removeAccount: (id: string) => void;
  addLog: (log: Omit<RunLog, "id">) => void;
  clearLogs: () => void;
  runAccount: (id: string) => void;
  runAll: () => void;
  stopAll: () => void;
  isRunning: boolean;
}

const AccountsContext = createContext<AccountsContextType | null>(null);

const ACCOUNTS_KEY = "@ms_rewards_accounts";
const LOGS_KEY = "@ms_rewards_logs";
const MAX_LOGS = 200;

const SEARCH_QUERIES = [
  "what is artificial intelligence",
  "best programming languages 2026",
  "how does machine learning work",
  "top tourist destinations in the world",
  "healthy meal prep ideas",
  "how to learn guitar for beginners",
  "latest space exploration news",
  "best budget smartphones 2026",
  "how to improve memory and focus",
  "world history timeline overview",
  "best free online learning platforms",
  "how does cryptocurrency work",
  "tips for better sleep quality",
  "most spoken languages in the world",
  "how to start investing for beginners",
  "best movies to watch this weekend",
  "climate change effects on oceans",
  "how to build muscle at home",
  "top 10 richest people in the world",
  "best productivity apps for students",
  "how to make homemade pizza",
  "what causes northern lights",
  "best hiking trails in the world",
  "how to learn a new language fast",
  "history of the roman empire",
  "how does solar energy work",
  "best laptops for college students",
  "what is quantum computing",
  "tips for healthy eating on a budget",
  "how to grow vegetables at home",
];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const runningRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [accsRaw, logsRaw] = await Promise.all([
          AsyncStorage.getItem(ACCOUNTS_KEY),
          AsyncStorage.getItem(LOGS_KEY),
        ]);
        if (accsRaw) setAccounts(JSON.parse(accsRaw));
        if (logsRaw) setLogs(JSON.parse(logsRaw));
      } catch (e) {
        console.error("Failed to load data", e);
      }
    })();
  }, []);

  const saveAccounts = useCallback(async (accs: Account[]) => {
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accs));
  }, []);

  const saveLogs = useCallback(async (ls: RunLog[]) => {
    await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(ls));
  }, []);

  const addAccount = useCallback(
    (account: Omit<Account, "id" | "status" | "totalPoints" | "todayPoints" | "searchesCompleted">) => {
      const newAccount: Account = {
        ...account,
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        status: "idle",
        totalPoints: 0,
        todayPoints: 0,
        searchesCompleted: 0,
      };
      setAccounts((prev) => {
        const updated = [...prev, newAccount];
        saveAccounts(updated);
        return updated;
      });
    },
    [saveAccounts]
  );

  const updateAccount = useCallback(
    (id: string, updates: Partial<Account>) => {
      setAccounts((prev) => {
        const updated = prev.map((a) => (a.id === id ? { ...a, ...updates } : a));
        saveAccounts(updated);
        return updated;
      });
    },
    [saveAccounts]
  );

  const removeAccount = useCallback(
    (id: string) => {
      setAccounts((prev) => {
        const updated = prev.filter((a) => a.id !== id);
        saveAccounts(updated);
        return updated;
      });
    },
    [saveAccounts]
  );

  const addLog = useCallback(
    (log: Omit<RunLog, "id">) => {
      const newLog: RunLog = {
        ...log,
        id: Date.now().toString() + Math.random().toString(36).slice(2),
      };
      setLogs((prev) => {
        const updated = [newLog, ...prev].slice(0, MAX_LOGS);
        saveLogs(updated);
        return updated;
      });
    },
    [saveLogs]
  );

  const clearLogs = useCallback(async () => {
    setLogs([]);
    await AsyncStorage.removeItem(LOGS_KEY);
  }, []);

  const simulateAccountRun = useCallback(
    async (account: Account, setAccs: React.Dispatch<React.SetStateAction<Account[]>>) => {
      const queries = shuffleArray(SEARCH_QUERIES).slice(0, account.searchCount);
      let searchesDone = 0;

      setAccs((prev) => {
        const updated = prev.map((a) =>
          a.id === account.id ? { ...a, status: "running" as AccountStatus, searchesCompleted: 0 } : a
        );
        saveAccounts(updated);
        return updated;
      });

      await new Promise((r) => setTimeout(r, 800));

      const simulatedSuccess = Math.random() > 0.15;

      if (simulatedSuccess) {
        for (let i = 0; i < queries.length; i++) {
          if (!runningRef.current) break;
          await new Promise((r) => setTimeout(r, 400 + Math.random() * 200));
          searchesDone++;
          setAccs((prev) => {
            const updated = prev.map((a) =>
              a.id === account.id ? { ...a, searchesCompleted: searchesDone } : a
            );
            saveAccounts(updated);
            return updated;
          });
        }
      }

      const pointsEarned = simulatedSuccess ? Math.floor(Math.random() * 50) + searchesDone * 3 : 0;
      const dailySetDone = simulatedSuccess && account.dailySetEnabled && Math.random() > 0.2;

      const newStatus: AccountStatus = simulatedSuccess ? "done" : "failed";
      setAccs((prev) => {
        const updated = prev.map((a) =>
          a.id === account.id
            ? {
                ...a,
                status: newStatus,
                todayPoints: (a.todayPoints || 0) + pointsEarned,
                totalPoints: (a.totalPoints || 0) + pointsEarned,
                lastRun: new Date().toISOString(),
                searchesCompleted: searchesDone,
              }
            : a
        );
        saveAccounts(updated);
        return updated;
      });

      addLog({
        accountId: account.id,
        accountName: account.name,
        timestamp: new Date().toISOString(),
        searchesDone,
        dailySetDone,
        pointsEarned,
        status: simulatedSuccess ? "success" : "failed",
      });

      return simulatedSuccess;
    },
    [addLog, saveAccounts]
  );

  const runAccount = useCallback(
    async (id: string) => {
      const account = accounts.find((a) => a.id === id);
      if (!account) return;
      runningRef.current = true;
      setIsRunning(true);
      await simulateAccountRun(account, setAccounts);
      runningRef.current = false;
      setIsRunning(false);
    },
    [accounts, simulateAccountRun]
  );

  const runAll = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsRunning(true);

    const toRun = accounts.filter((a) => a.status !== "running");
    for (const account of toRun) {
      if (!runningRef.current) break;
      await simulateAccountRun(account, setAccounts);
      await new Promise((r) => setTimeout(r, 500));
    }

    runningRef.current = false;
    setIsRunning(false);
  }, [accounts, simulateAccountRun]);

  const stopAll = useCallback(() => {
    runningRef.current = false;
    setIsRunning(false);
    setAccounts((prev) => {
      const updated = prev.map((a) =>
        a.status === "running" ? { ...a, status: "idle" as AccountStatus } : a
      );
      saveAccounts(updated);
      return updated;
    });
  }, [saveAccounts]);

  return (
    <AccountsContext.Provider
      value={{
        accounts,
        logs,
        addAccount,
        updateAccount,
        removeAccount,
        addLog,
        clearLogs,
        runAccount,
        runAll,
        stopAll,
        isRunning,
      }}
    >
      {children}
    </AccountsContext.Provider>
  );
}

export function useAccounts() {
  const ctx = useContext(AccountsContext);
  if (!ctx) throw new Error("useAccounts must be used within AccountsProvider");
  return ctx;
}
