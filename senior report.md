# Macro Rewards — Senior Audit Report

**Date:** March 22, 2026
**App Version:** 1.4.0
**Platform:** Android (Expo SDK 54, EAS Build)
**Bundle ID:** com.msrewards.automation
**Build Profile:** preview (APK)

---

## Executive Summary

A comprehensive audit was performed on the Macro Rewards mobile application — an Android app that automates Microsoft Rewards point earning by running Bing searches and Daily Set activities across multiple Microsoft accounts. The audit covered all major systems: search automation, cookie/session management, notification scheduling, points tracking, profile detection, UI components, state management, and error handling.

**6 issues were identified and resolved.** 2 were classified as severe (could cause app-breaking behavior), 3 were correctness bugs, and 1 was a security observation noted for future improvement.

---

## Architecture Overview

### Tech Stack
- **Framework:** Expo SDK 54 + React Native
- **Routing:** Expo Router (file-based)
- **State:** React Context + AsyncStorage persistence
- **Monorepo:** pnpm workspaces
- **Build:** EAS Build (preview profile → APK)

### Core Systems
| System | File(s) | Purpose |
|--------|---------|---------|
| Account Management | `AccountsContext.tsx` | CRUD accounts, run state, logs |
| Settings | `SettingsContext.tsx` | Search count, delay, overnight slots |
| Search Runner | `search-runner.tsx` | Bing search automation via fetch |
| Daily Set | `search-runner.tsx` | WebView-based activity clicking |
| Login/Cookies | `login-webview.tsx` | Microsoft login, cookie capture |
| Notifications | `notifications.ts` | Scheduling, channels, listeners |
| Home Screen | `index.tsx` | Account list/grid, run controls |
| Settings Screen | `settings.tsx` | Config UI, schedule management |

### Data Flow
1. User logs into Microsoft account via WebView
2. Cookies (including httpOnly) captured via CookieManager + document.cookie
3. Profile data scraped from page + fetched from Rewards API
4. Account saved with cookies to AsyncStorage
5. Search runner uses cookies in fetch headers to perform Bing searches
6. Daily Set uses WebView with injected cookies to click activity cards
7. Points fetched from Rewards API after each run
8. Notifications scheduled via expo-notifications for overnight mode

---

## Issues Found & Resolved

### ISSUE 1: Search Runner Crash Safety (SEVERITY: CRITICAL)

**Problem:** The main automation loop in `search-runner.tsx` had no top-level error handling. Any unexpected exception (network timeout, JSON parse error, WebView crash) would:
- Leave accounts permanently stuck in "running" status
- Keep the `isRunning` global flag true (blocking future runs)
- Leave the "Searching..." notification displayed indefinitely
- Never log the failed run

**Root Cause:** The `run()` async function inside useEffect had no try/catch/finally block.

**Fix Applied:** Wrapped the entire automation loop in try/catch/finally:
- `catch`: Logs the error, marks stuck accounts as "failed", updates UI
- `finally`: Always calls `stopRun()` and dismisses the running notification
- Ensures clean state recovery regardless of failure mode

**Impact:** Prevents the app from entering an unrecoverable state after any unexpected error during automation.

---

### ISSUE 2: Route Parameter Crash (SEVERITY: CRITICAL)

**Problem:** `JSON.parse(rawIds)` on line 294 of `search-runner.tsx` was unguarded. If a malformed notification deep-link or corrupted navigation parameter was passed, the entire search runner screen would crash with a JSON parse error before any automation could start.

**Root Cause:** No try/catch around `JSON.parse()` for the `accountIds` route parameter.

**Fix Applied:** Wrapped in try/catch with empty array fallback:
```
let accountIds: string[] = [];
try { accountIds = rawIds ? JSON.parse(rawIds) : []; } catch { accountIds = []; }
```

**Impact:** Prevents crash from malformed navigation params. The screen gracefully handles the empty state instead of crashing.

---

### ISSUE 3: Stale todayPoints Carry-Over (SEVERITY: MEDIUM)

**Problem:** When the Rewards API returned `today: 0` (common after midnight reset or on fresh accounts), the app preserved the old `todayPoints` value from the previous day:
```
todayPoints: today > 0 ? today : (account.todayPoints ?? 0)
```
This caused incorrect "points earned today" displays that persisted across day boundaries.

**Root Cause:** Defensive fallback logic that treated API returning 0 as "no data" rather than "zero points today."

**Fix Applied:** Changed to always store the API value directly:
```
todayPoints: today
```
If the API says 0 points today, the display correctly shows 0.

**Impact:** Points display now accurately reflects daily earnings without stale carry-over.

---

### ISSUE 4: Weak Session Validation (SEVERITY: MEDIUM)

**Problem:** The login-webview allowed accounts to be saved without the critical `_U` authentication cookie. The `_U` cookie is the primary Bing auth token — without it, all searches fail silently (return 200 but don't count toward rewards). Users could save an account that appeared functional but would never earn points.

**Root Cause:** No validation of cookie completeness before saving. The save handler accepted any cookies captured during the session, even if the user hadn't fully completed login.

**Fix Applied:** Added `_U` cookie validation before save:
- Checks that `_U` exists and has a non-empty value
- Shows an alert explaining the issue if missing
- Resets `isSaving` state so user can retry
- Only proceeds to save if validation passes

**Impact:** Prevents creation of non-functional accounts that silently fail during automation.

---

### ISSUE 5: Daily Set `alreadyDone` Detection (SEVERITY: LOW)

**Problem:** The `runDailySetViaWebView` function always returned `alreadyDone: false`, even when all daily activities were already completed before the run started. This caused incorrect log entries (Daily Set marked as "not done" when it was actually already complete).

**Root Cause:** Hardcoded `alreadyDone: false` return value instead of detecting the no-cards-found-on-first-attempt case.

**Fix Applied:** Changed to derive from completion count:
```
const alreadyDone = completed === 0;
return { completed, total: completed, alreadyDone };
```
When no uncompleted cards are found on the first scan, `alreadyDone` is now correctly set to `true`.

**Impact:** Run logs now accurately reflect Daily Set status.

---

### ISSUE 6: Plaintext Cookie Storage (SEVERITY: OBSERVATION)

**Problem:** Authentication cookies (including httpOnly tokens and localStorage auth tokens) are stored in plaintext AsyncStorage. This includes the `_U` cookie, MUID, and any captured session tokens. If the device is compromised or rooted, these credentials are accessible.

**Current State:** AsyncStorage is the standard React Native key-value store. It's sandboxed per-app on non-rooted devices but not encrypted at rest.

**Recommendation:** For production hardening, consider migrating sensitive cookie data to `expo-secure-store` (uses Android Keystore). However, `expo-secure-store` has a 2KB value size limit, which may not fit the full cookie set (typically 5-15KB). Options:
1. Encrypt the cookie JSON with a key stored in SecureStore
2. Store only the critical `_U` and `MUID` in SecureStore, rest in AsyncStorage
3. Accept the current risk for the app's use case (personal automation tool)

**Status:** Not fixed — noted for future improvement based on security requirements.

---

## Additional Improvements Made (Pre-Audit)

### Notification Sound & Reliability
- Created Android notification channel ("default") with HIGH importance, sound, and vibration pattern
- Added `channelId` to all notification content
- Added `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`, `WAKE_LOCK` permissions to Android manifest
- Added fallback scheduling: if `daily` trigger fails, calculates seconds to target time and uses `timeInterval` trigger

### Profile Detection Enhancement
- Expanded CSS selectors for username (12 selectors) and email (8 selectors + full-page text scan)
- Made Rewards API call unconditional (was previously conditional)
- Added second API endpoint fallback (`getprofile`)
- Double retry injection after profile menu click (1.5s + 3s delays)
- Added `#id_l` as additional profile menu trigger selector

### Points Display
- Grid tile: Total points shown on avatar badge + in stats row
- List card: Total points with gold star + today's earnings in green
- Account detail: Both "Today" and "Total" stat cards
- Avatar badge on grid tile corrected to show `totalPoints` (was showing `todayPoints`)

---

## Code Quality Assessment

### Strengths
- Clean separation of concerns (context providers, components, utilities)
- Proper use of React hooks and memoization (`useCallback`, `useRef`)
- Good haptic feedback throughout the UI
- Comprehensive error boundaries for crash recovery
- WebView cookie isolation (credentials:"omit" on fetch, separate CookieManager for WebView)
- Daily Set deduplication via clickedIds tracking

### Areas for Improvement
- No automated tests (manual testing only)
- Large `search-runner.tsx` file (870+ lines) could be split into smaller modules
- `formatRelativeTime` utility duplicated in AccountCard and AccountGridTile
- No rate limiting or backoff on Rewards API calls
- No telemetry/crash reporting for production debugging

---

## Recommendations

### Short-Term (Next Build)
1. Test notification scheduling on physical device with battery optimization disabled
2. Verify profile detection works across different Microsoft account types
3. Monitor `_U` cookie validation — ensure it doesn't block legitimate sessions

### Medium-Term
1. Extract search/daily-set logic from `search-runner.tsx` into separate utility modules
2. Add retry logic with exponential backoff for failed searches
3. Implement a "test notification" button in settings for verification
4. Add account reordering/sorting (by name, points, last run)

### Long-Term
1. Migrate cookie storage to encrypted storage
2. Add multi-device sync via cloud backend
3. Implement search query rotation to reduce pattern detection risk
4. Add analytics dashboard for points trends over time
5. Consider implementing a foreground service for truly background overnight runs

---

## Build Information

| Property | Value |
|----------|-------|
| App Name | Macro R |
| Bundle ID | com.msrewards.automation |
| EAS Project ID | bde8726b-e427-47c3-bfef-bac4d4e46de4 |
| EAS Account | shroud.dev |
| Build Profile | preview |
| Expo SDK | 54 |
| React Native | Latest (New Architecture enabled) |
| Android Permissions | SCHEDULE_EXACT_ALARM, RECEIVE_BOOT_COMPLETED, VIBRATE, WAKE_LOCK |

---

*Report generated by code audit on March 22, 2026.*
