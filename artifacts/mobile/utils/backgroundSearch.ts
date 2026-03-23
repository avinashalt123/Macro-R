import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";

const ACCOUNTS_KEY = "@ms_rewards_accounts";
const QUERIES_KEY = "@ms_rewards_queries_v2";
const SETTINGS_KEY = "@ms_rewards_settings_v2";
const LOGS_KEY = "@ms_rewards_logs";
const BACKGROUND_SEARCH_TASK = "BACKGROUND-SEARCH-TASK";
const BG_RUNNING_KEY = "@ms_rewards_bg_running";

const BING_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36";

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function randomHex(len: number): string {
  return Array.from({ length: len }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

function buildCookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .filter(([k]) => !k.startsWith("_ls_"))
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function performBingSearch(
  query: string,
  cookies: Record<string, string>
): Promise<{ ok: boolean; status?: number; networkError?: boolean }> {
  const cookieStr = buildCookieHeader(cookies);
  const cvid = randomHex(32).toUpperCase();
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&form=QBLH&cvid=${cvid}`;
  try {
    const resp = await fetch(url, {
      method: "GET",
      credentials: "omit",
      headers: {
        Cookie: cookieStr,
        "User-Agent": BING_UA,
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.bing.com/",
        "Cache-Control": "no-cache",
      },
    });
    return { ok: resp.ok || resp.status === 302, status: resp.status };
  } catch (e: any) {
    if (e?.message?.includes("Network request failed")) {
      return { ok: false, status: 0, networkError: true };
    }
    return { ok: false, status: 0 };
  }
}

async function fetchRewardsPoints(
  cookies: Record<string, string>
): Promise<{ available: number; today: number }> {
  const cookieStr = buildCookieHeader(cookies);
  try {
    const resp = await fetch(
      "https://rewards.bing.com/api/getuserinfo?type=1&X-Requested-With=XMLHttpRequest",
      {
        credentials: "omit",
        headers: {
          Cookie: cookieStr,
          "User-Agent": BING_UA,
          Accept: "application/json, text/javascript, */*",
          Referer: "https://rewards.bing.com/",
          "X-Requested-With": "XMLHttpRequest",
        },
      }
    );
    if (!resp.ok) return { available: 0, today: 0 };
    const json = await resp.json();
    const status = json?.dashboard?.userStatus ?? json?.userStatus;
    const available = status?.availablePoints ?? 0;

    function dailyProgress(counter: any): number {
      if (!counter) return 0;
      const entry = Array.isArray(counter) ? counter[0] : counter;
      if (!entry) return 0;
      const progress = Math.max(0, Math.floor(Number(entry.pointProgress) || 0));
      const max = Math.max(0, Math.floor(Number(entry.pointProgressMax) || 0));
      if (max > 0 && progress > max) return max;
      return progress;
    }

    const counters = status?.counters;
    const pcToday = dailyProgress(counters?.pcSearch);
    const mobileToday = dailyProgress(counters?.mobileSearch);
    const edgeToday = dailyProgress(counters?.edgeSearch);
    const dailyPt = dailyProgress(counters?.dailyPoint);
    const totalToday = pcToday + mobileToday + edgeToday + dailyPt;

    return { available, today: totalToday };
  } catch {
    return { available: 0, today: 0 };
  }
}

async function getAccounts(): Promise<any[]> {
  const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function getQueriesAndRotate(needed: number): Promise<string[]> {
  const raw = await AsyncStorage.getItem(QUERIES_KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    const unused: string[] = data.unused ?? [];
    const used: string[] = data.used ?? [];

    let available = unused;
    if (available.length < needed) {
      available = [...unused, ...used];
      used.length = 0;
    }

    const picked = available.slice(0, needed);
    const remaining = available.slice(needed);
    const newUsed = [...used, ...picked];

    await AsyncStorage.setItem(
      QUERIES_KEY,
      JSON.stringify({ unused: remaining, used: newUsed })
    );

    return picked;
  } catch {
    return [];
  }
}

async function getSettings(): Promise<any> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function updateAccountInStorage(accountId: string, updates: Record<string, any>): Promise<void> {
  const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return;
  try {
    const accounts = JSON.parse(raw);
    const idx = accounts.findIndex((a: any) => a.id === accountId);
    if (idx >= 0) {
      accounts[idx] = { ...accounts[idx], ...updates };
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    }
  } catch {}
}

async function appendLog(entry: any): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LOGS_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    logs.unshift(entry);
    if (logs.length > 200) logs.length = 200;
    await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  } catch {}
}

async function showNotification(title: string, body: string): Promise<void> {
  try {
    const Notifications = require("expo-notifications");
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
        ...(Platform.OS === "android" && { channelId: "alarms" }),
      },
      trigger: null,
    });
  } catch {}
}

export function isAppInForeground(): boolean {
  return AppState.currentState === "active";
}

export async function isBackgroundRunning(): Promise<boolean> {
  const val = await AsyncStorage.getItem(BG_RUNNING_KEY);
  return val === "true";
}

export async function runBackgroundSearches(): Promise<void> {
  if (isAppInForeground()) {
    console.log("[BackgroundSearch] App is in foreground — skipping background run, foreground handler will take over");
    return;
  }

  const alreadyRunning = await isBackgroundRunning();
  if (alreadyRunning) {
    console.log("[BackgroundSearch] Already running, skipping");
    return;
  }

  await AsyncStorage.setItem(BG_RUNNING_KEY, "true");
  console.log("[BackgroundSearch] Starting background search run");

  try {
    const accounts = await getAccounts();
    if (accounts.length === 0) {
      console.log("[BackgroundSearch] No accounts found");
      return;
    }

    const settings = await getSettings();
    const searchCount = settings.searchCount ?? 30;
    const queries = await getQueriesAndRotate(searchCount);

    let totalSearchesDone = 0;
    let totalPointsEarned = 0;

    for (const account of accounts) {
      const cookies = account.cookies;
      if (!cookies || !cookies._U) {
        console.log(`[BackgroundSearch] ${account.name}: No cookies, skipping`);
        await appendLog({
          id: Date.now().toString(),
          accountName: account.name || account.email,
          timestamp: Date.now(),
          searchesDone: 0,
          dailySetDone: false,
          pointsEarned: 0,
          errorMessage: "No session cookies (background)",
        });
        continue;
      }

      await updateAccountInStorage(account.id, { status: "running" });

      const pointsBefore = await fetchRewardsPoints(cookies);
      let searchesDone = 0;

      for (let i = 0; i < searchCount; i++) {
        const query = queries[i] ?? `microsoft rewards tip ${i + 1}`;

        const result = await performBingSearch(query, cookies);
        if (result.networkError) {
          console.log(`[BackgroundSearch] ${account.name}: Network lost, stopping`);
          break;
        }
        if (result.ok) searchesDone++;

        if (i < searchCount - 1) {
          await sleep(1500 + Math.floor(Math.random() * 1000));
        }
      }

      const pointsAfter = await fetchRewardsPoints(cookies);
      const earned = Math.max(0, pointsAfter.available - pointsBefore.available);

      totalSearchesDone += searchesDone;
      totalPointsEarned += earned;

      await updateAccountInStorage(account.id, {
        status: "idle",
        lastRun: Date.now(),
        searchesCompleted: searchesDone,
        totalPoints: pointsAfter.available,
        todayPoints: pointsAfter.today,
      });

      await appendLog({
        id: Date.now().toString(),
        accountName: account.name || account.email,
        timestamp: Date.now(),
        searchesDone,
        dailySetDone: false,
        pointsEarned: account.lastRun ? earned : 0,
        backgroundRun: true,
      });

      console.log(`[BackgroundSearch] ${account.name}: ${searchesDone}/${searchCount} searches, +${earned} points`);
    }

    await showNotification(
      "Background Searches Complete",
      `${totalSearchesDone} searches across ${accounts.length} account${accounts.length > 1 ? "s" : ""}. +${totalPointsEarned} points earned.`
    );

    console.log("[BackgroundSearch] Finished all accounts");
  } finally {
    await AsyncStorage.removeItem(BG_RUNNING_KEY);
  }
}

export function registerBackgroundSearchTask(): void {
  if (Platform.OS === "web") return;
  try {
    const TaskManager = require("expo-task-manager");
    TaskManager.defineTask(BACKGROUND_SEARCH_TASK, async () => {
      try {
        await runBackgroundSearches();
        return 2;
      } catch (e) {
        console.log("[BackgroundSearch] Task error:", e);
        await AsyncStorage.removeItem(BG_RUNNING_KEY);
        return 3;
      }
    });
    console.log("[BackgroundSearch] Task defined");
  } catch (e) {
    console.log("[BackgroundSearch] Failed to define task:", e);
  }
}

export const BACKGROUND_SEARCH_TASK_NAME = BACKGROUND_SEARCH_TASK;
