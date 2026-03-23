import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

const LICENSE_KEY_STORAGE = "@ms_rewards_license_key";
const LICENSE_DATA_STORAGE = "@ms_rewards_license_data";
const API_BASE = process.env.EXPO_PUBLIC_API_URL || "";

interface LicenseData {
  key: string;
  maxAccounts: number;
  expiresAt: string;
  label: string | null;
  validatedAt: number;
}

interface LicenseContextValue {
  isLicensed: boolean;
  isLoading: boolean;
  licenseData: LicenseData | null;
  error: string | null;
  activateKey: (key: string) => Promise<boolean>;
  removeLicense: () => Promise<void>;
  revalidate: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextValue>({
  isLicensed: false,
  isLoading: true,
  licenseData: null,
  error: null,
  activateKey: async () => false,
  removeLicense: async () => {},
  revalidate: async () => {},
});

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [isLicensed, setIsLicensed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [licenseData, setLicenseData] = useState<LicenseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateKey = useCallback(async (key: string): Promise<{ valid: boolean; error?: string; maxAccounts?: number; expiresAt?: string; label?: string; offline?: boolean }> => {
    try {
      const resp = await fetch(`${API_BASE}/api/validate-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      return await resp.json();
    } catch {
      return { valid: false, error: "Could not connect to server", offline: true };
    }
  }, []);

  const loadStoredLicense = useCallback(async () => {
    try {
      const storedKey = await AsyncStorage.getItem(LICENSE_KEY_STORAGE);
      const storedData = await AsyncStorage.getItem(LICENSE_DATA_STORAGE);

      if (!storedKey) {
        setIsLoading(false);
        return;
      }

      if (storedData) {
        const data: LicenseData = JSON.parse(storedData);
        const now = Date.now();
        const expiresAt = new Date(data.expiresAt).getTime();

        if (expiresAt < now) {
          setError("License key has expired");
          setIsLicensed(false);
          setIsLoading(false);
          return;
        }

        const hoursSinceValidation = (now - data.validatedAt) / (1000 * 60 * 60);
        if (hoursSinceValidation < 24) {
          setLicenseData(data);
          setIsLicensed(true);
          setIsLoading(false);
          return;
        }
      }

      const result = await validateKey(storedKey);
      if (result.valid) {
        const data: LicenseData = {
          key: storedKey,
          maxAccounts: result.maxAccounts!,
          expiresAt: result.expiresAt!,
          label: result.label ?? null,
          validatedAt: Date.now(),
        };
        await AsyncStorage.setItem(LICENSE_DATA_STORAGE, JSON.stringify(data));
        setLicenseData(data);
        setIsLicensed(true);
        setError(null);
      } else if (result.offline && storedData) {
        const data: LicenseData = JSON.parse(storedData);
        if (new Date(data.expiresAt).getTime() > Date.now()) {
          setLicenseData(data);
          setIsLicensed(true);
        } else {
          setError("License key has expired");
          setIsLicensed(false);
        }
      } else {
        setError(result.error || "Invalid key");
        setIsLicensed(false);
      }
    } catch {
      const cachedData = await AsyncStorage.getItem(LICENSE_DATA_STORAGE);
      if (cachedData) {
        const data: LicenseData = JSON.parse(cachedData);
        if (new Date(data.expiresAt).getTime() > Date.now()) {
          setLicenseData(data);
          setIsLicensed(true);
        }
      }
    }
    setIsLoading(false);
  }, [validateKey]);

  useEffect(() => {
    loadStoredLicense();
  }, [loadStoredLicense]);

  const activateKey = useCallback(async (key: string): Promise<boolean> => {
    setError(null);
    const trimmed = key.trim().toUpperCase();
    const result = await validateKey(trimmed);

    if (!result.valid) {
      setError(result.error || "Invalid key");
      return false;
    }

    const data: LicenseData = {
      key: trimmed,
      maxAccounts: result.maxAccounts!,
      expiresAt: result.expiresAt!,
      label: result.label ?? null,
      validatedAt: Date.now(),
    };

    await AsyncStorage.setItem(LICENSE_KEY_STORAGE, trimmed);
    await AsyncStorage.setItem(LICENSE_DATA_STORAGE, JSON.stringify(data));
    setLicenseData(data);
    setIsLicensed(true);
    return true;
  }, [validateKey]);

  const removeLicense = useCallback(async () => {
    await AsyncStorage.removeItem(LICENSE_KEY_STORAGE);
    await AsyncStorage.removeItem(LICENSE_DATA_STORAGE);
    setLicenseData(null);
    setIsLicensed(false);
    setError(null);
  }, []);

  const revalidate = useCallback(async () => {
    setIsLoading(true);
    await loadStoredLicense();
  }, [loadStoredLicense]);

  return (
    <LicenseContext.Provider value={{ isLicensed, isLoading, licenseData, error, activateKey, removeLicense, revalidate }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  return useContext(LicenseContext);
}
