import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

interface ScheduleTime {
  hour: number;
  minute: number;
}

interface Settings {
  defaultSearchCount: number;
  searchDelay: number;
  firstRunTime: ScheduleTime;
  dailySetEnabled: boolean;
  retrySchedule: ScheduleTime[];
}

const DEFAULT_SETTINGS: Settings = {
  defaultSearchCount: 30,
  searchDelay: 5,
  firstRunTime: { hour: 13, minute: 0 },
  dailySetEnabled: true,
  retrySchedule: [
    { hour: 22, minute: 0 },
    { hour: 22, minute: 30 },
    { hour: 23, minute: 0 },
    { hour: 23, minute: 30 },
    { hour: 0, minute: 0 },
  ],
};

interface SettingsContextType {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);
const SETTINGS_KEY = "@ms_rewards_settings";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((raw) => {
      if (raw) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
        } catch {}
      }
    });
  }, []);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
