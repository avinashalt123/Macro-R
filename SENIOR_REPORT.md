# MS Rewards Automation — Senior Developer Report

**From:** Agent (acting Sr. Dev)
**Date:** March 21, 2026
**Project:** MS Rewards Automation — React Native (Expo SDK 54), pnpm monorepo

---

## 1. Project Overview

This is a mobile automation app that runs Microsoft Rewards daily Bing searches and Daily Set activities across multiple user accounts without manual interaction. It is built with:

- **React Native** via **Expo SDK 54** with Expo Router (file-based navigation)
- **TypeScript** throughout
- **pnpm monorepo** at the repo root (`artifacts/mobile` is the app)
- **EAS Build** (Expo's cloud build service) for producing Android APKs

### Core Features

| Feature | File | Status |
|---|---|---|
| Multi-account management | `app/(tabs)/index.tsx`, `context/AccountsContext.tsx` | Working |
| Microsoft login + cookie capture | `app/login-webview.tsx` | Working |
| Bing search automation (fetch-based) | `app/search-runner.tsx` | Working — do not touch |
| Daily Set automation (WebView injection) | `app/search-runner.tsx` | Working after fixes below |
| Scheduled daily notifications | `utils/notifications.ts` | Working in APK (not Expo Go) |
| Query pool management | `context/QueriesContext.tsx`, `constants/defaultQueries.ts` | Working |
| Settings screen | `app/(tabs)/settings.tsx` | Working, extended |

---

## 2. How Account Switching Works

### Login Phase (`app/login-webview.tsx`)

When a user adds an account:

1. A WebView opens in **incognito mode** (`incognito={true}`) to give it a clean, isolated cookie store — this prevents any existing session from leaking into the new login.
2. The user logs into `login.live.com` and is redirected to `rewards.bing.com`.
3. JavaScript is injected on every page load that reads `document.cookie` and relevant `localStorage` tokens.
4. These cookies are accumulated across all visited domains (login.live.com, bing.com, rewards.bing.com) and merged into a single `Record<string, string>`.
5. On save, this cookie map is stored in `AccountsContext` (persisted to AsyncStorage) against that account's ID.

**Key point:** The incognito WebView is discarded after login. The device's main OS cookie jar is **not** written to during new account login.

### Search Phase (`app/search-runner.tsx` — `performBingSearch`)

Searches use `fetch` with `credentials: "omit"` and manually build a `Cookie:` header string from the account's stored cookies. This completely bypasses the device OS cookie jar and is entirely per-account — it was already correct before any changes were made.

### Daily Set Phase (`app/search-runner.tsx` — `runDailySetViaWebView`)

This is where the account-switching bug lived. The Daily Set uses a visible WebView that loads `rewards.bing.com` and injects JavaScript to click reward activity cards. Unlike the fetch-based searches, a WebView uses the **device's OS cookie jar** (shared system-wide) — not the per-account stored cookies.

**The bug:** When the user logged into Account 2 (even in incognito mode), refreshing an existing account session used a non-incognito WebView which wrote Account 2's session to the OS cookie jar. The Daily Set WebView then authenticated as Account 2 regardless of which account was selected to run.

---

## 3. Changes Made This Session

### Fix 1 — EAS Build: Missing Project ID (`app.json`)

The junior dev ran `eas init` and got a project ID but never saved it to `app.json`. Added:

```json
"extra": {
  "eas": {
    "projectId": "bde8726b-e427-47c3-bfef-bac4d4e46de4"
  }
},
"owner": "shroud.dev"
```

### Fix 2 — EAS Build: CLI Version Constraint (`eas.json`)

Removed `"cli": { "version": ">= 16.0.0" }` which was causing EAS to silently reject the build request when the installed CLI version didn't satisfy it.

### Fix 3 — EAS Build: Kotlin Incompatibility (`package.json`)

`expo-dev-client@~5.0.0` brings in `expo-dev-launcher@5.0.35` which has its Gradle plugin compiled with Kotlin 1.9.0. React Native 0.81.5's Gradle plugin is compiled with Kotlin 2.1.0 — these two are binary-incompatible and crash the entire Gradle build.

**Fix:** Removed `expo-dev-client` from `dependencies`. Switched from the `development` EAS profile to the `preview` profile, which produces a standard APK without the dev client. All native features still work.

### Fix 4 — Account Cookie Isolation (`app/search-runner.tsx`)

Wired up `@react-native-cookies/cookies` (already installed, not connected) to solve the Daily Set session conflict.

**Added `injectAccountCookies(cookies)`:** Before every account's run begins (covering both searches and the Daily Set), this function:
1. Calls `CookieManager.clearAll(true)` — flushes the entire WebView OS cookie jar
2. Calls `CookieManager.set()` for each stored cookie across `bing.com`, `rewards.bing.com`, and `login.live.com`

This ensures the WebView always reflects the correct account's session at the start of every run, regardless of what was previously in the OS jar.

**Dynamic require pattern:** The library is loaded via `require()` inside the function rather than a top-level import. This is intentional — `@react-native-cookies/cookies` is a native module that crashes Expo Go on import. The dynamic require catches the error silently in Expo Go while working fully in the compiled APK.

### Fix 5 — Daily Set Toggle (`settings.tsx`, `index.tsx`, `AccountCard.tsx`)

Added a user-facing toggle in Settings → Search section to enable or disable Daily Set globally.

- **Off:** "Run All" only performs Bing searches. The purple "Daily Set" FAB button on the home screen is hidden. The per-account Daily Set icon button on each card is hidden.
- **On:** Full behavior — searches run first, then Daily Set. Both buttons are visible.

The `dailySetEnabled` field already existed in `SettingsContext` but had no UI. The search runner already read it. This change wired up the UI and propagated the setting to `AccountCard` via a new `showDailySet` prop.

### Fix 6 — Screen Routing Crash (`app/search-runner.tsx`)

The top-level `import CookieManager from "@react-native-cookies/cookies"` was added in Fix 4 and immediately caused the search-runner module to throw on load in Expo Go (`react-native link` error). This caused Expo Router to report the route as missing ("Oops, this screen doesn't exist").

**Fix:** Removed the top-level import and moved the `require` inside `injectAccountCookies` where it's wrapped in `try/catch`.

---

## 4. Current State

### What Works (on the APK)
- All searches run correctly per-account using stored cookies
- Daily Set now runs under the correct account's session after cookie injection
- Scheduled notifications trigger daily and auto-start the run
- Daily Set can be toggled on/off globally from Settings
- Session refresh (re-login) properly updates stored cookies for an account

### Known Limitations / Remaining Work
- **Cookie capture completeness:** `document.cookie` only captures non-httpOnly cookies. httpOnly cookies (which Bing uses for some auth tokens) are captured only during active WebView sessions and may not persist across OS-level cookie jar flushes. If Daily Set shows "not authenticated" after the fix, the user needs to refresh their session.
- **No expired session detection:** Before a run starts, there is no check whether the stored cookies are still valid. If they've expired, searches will fail silently (returning 200 but earning no points). The `isSessionExpired` function in AccountCard only estimates based on time — it does not make a real auth check.
- **No retry logic:** If a search request fails mid-run (non-network error), it does not retry. Failed accounts are logged and the run continues to the next account.
- **Shared User-Agent:** All accounts use the same Pixel 7 User-Agent string. Long-term, Microsoft may detect the pattern if running many accounts from one device.
- **Session refresh uses non-incognito WebView:** When a user refreshes an existing account's session (not adding new), `incognito` is `false`, so the device's OS cookie jar gets written to. This is by design (the real httpOnly cookies need to reach the jar for Daily Set), but it means whichever account was refreshed last "owns" the OS jar until the next `injectAccountCookies` call clears it.

### Build Configuration
- **EAS Profile in use:** `preview` (not `development`)
- **Build command:** `eas build --platform android --profile preview --non-interactive`
- **EAS Account:** shroud.dev
- **Project ID:** bde8726b-e427-47c3-bfef-bac4d4e46de4
- **Bundle ID:** com.msrewards.automation
- **Build time:** ~2.5 minutes on EAS free tier
- **Remaining Android builds:** 14 of 15 (free tier)

---

## 5. File Map — What Was Changed

| File | Change |
|---|---|
| `app.json` | Added `extra.eas.projectId` and `owner` |
| `eas.json` | Removed `cli.version` constraint |
| `package.json` | Removed `expo-dev-client` dependency |
| `app/search-runner.tsx` | Added `injectAccountCookies()`, dynamic require pattern, call at start of each account run |
| `app/(tabs)/settings.tsx` | Added Daily Set toggle (Switch) in Search section |
| `app/(tabs)/index.tsx` | Gated Daily Set FAB on `settings.dailySetEnabled`, passed `showDailySet` to AccountCard |
| `components/AccountCard.tsx` | Added `showDailySet` prop, conditionally renders Daily Set button |
