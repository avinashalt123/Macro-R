# Macro Rewards — Complete Project Report

**Date:** March 22, 2026
**Project:** Macro Rewards — React Native (Expo SDK 54), pnpm monorepo
**Location:** `artifacts/mobile/`

---

## 1. What This App Does

This Android app automates Microsoft Rewards point earning. You add your Microsoft accounts, and the app:

1. **Runs Bing searches** — sends fake search queries to Bing using your account's session cookies, earning ~5 points per search
2. **Completes Daily Set activities** — opens the Rewards dashboard in a WebView and clicks on daily activity cards (quizzes, polls, etc.)
3. **Runs on a schedule** — overnight mode fires notifications at preset times; tapping auto-starts the run
4. **Supports multiple accounts** — add 2, 5, or 10 Microsoft accounts; the app runs through each one sequentially

---

## 2. How Account Switching Works (The Core Mechanism)

### 2.1 — Two Completely Separate Systems Handle Authentication

| System | Used For | How It Authenticates |
|--------|----------|---------------------|
| **`fetch()` requests** | Bing searches, points checking | Manual `Cookie:` header — the app builds a cookie string from stored data and sends it directly in the HTTP request |
| **WebView** (embedded browser) | Daily Set card clicking | OS cookie jar — Android's built-in cookie store that all WebViews share |

### 2.2 — How Accounts Are Stored

Each account is a JavaScript object stored in AsyncStorage (phone's local storage):

```
{
  id: "172...",
  name: "User 1",
  email: "user@outlook.com",
  cookies: {
    "MUID": "abc123...",
    "_U": "eyJ0eX...",        <-- THE critical auth token
    "ANON": "A=s:abc...",
    "SRCHHPGUSR": "...",
    ... (30-40 cookies total)
  },
  status: "idle",
  searchCount: 30,
  ...
}
```

The `cookies` field is a flat key-value map of ALL cookies captured during login — including httpOnly cookies that normal JavaScript can't see. These cookies ARE the session.

### 2.3 — How Login Captures Cookies (`login-webview.tsx`)

```
Step 1:  Clear the entire OS cookie jar → CookieManager.clearAll(true)
Step 2:  Open WebView to Microsoft sign-out page → forces clean start
Step 3:  User types email + password + 2FA → Microsoft redirects through domains
Step 4:  On every page load, inject JavaScript to read document.cookie
Step 5:  Before saving, navigate WebView to www.bing.com → triggers _U cookie
Step 6:  Read the OS cookie jar using CookieManager.get() → captures httpOnly cookies
Step 7:  Merge JS cookies + native cookies → store in account object
```

**Why this matters:** The `_U` cookie is the main authentication token. It's httpOnly (invisible to `document.cookie`). Without Step 6, searches would return HTTP 200 but earn zero points.

### 2.4 — How Searches Switch Between Accounts (`search-runner.tsx`)

```
FOR each account in the list:
├── 1. Read this account's stored cookies
├── 2. Inject cookies into OS cookie jar (CookieManager.clearAll → set → flush)
├── 3. Run Bing searches via fetch() with credentials: "omit"
├── 4. Run Daily Set via WebView (if enabled)
├── 5. Fetch points earned
├── 6. Update account status
├── 7. Pause 3 seconds before next account
└── NEXT account
```

### 2.5 — Why `credentials: "omit"` Is the Whole Trick

```javascript
fetch(url, { credentials: "omit", headers: { Cookie: cookieString } })
```

- Without `credentials: "omit"`: OS cookie jar would mix cookies between accounts
- With `credentials: "omit"`: Each account is completely isolated; OS jar stays clean for WebView

---

## 3. The Three Run Modes

| Button | Color | Mode | What It Does |
|--------|-------|------|-------------|
| **Search All** | Blue | `searchonly` | Runs Bing searches only. No Daily Set. |
| **Daily Set** | Purple | `dailyset` | Runs Daily Set card clicking only. No searches. |
| **Run All** | Green | `both` | Runs searches first, then Daily Set. |
| **Stop** | Red | — | Stops any running operation. |

Per-account buttons: Blue play → searches only, Purple checkbox → Daily Set only.

---

## 4. Overnight Mode

### 4.1 — How It Works

Overnight mode schedules multiple automated runs around midnight to maximize daily points (Microsoft resets search points at midnight).

**Default schedule:** 10 PM · 11 PM · 1 AM · 2 AM (4 runs)

### 4.2 — Configuration

| Setting | Description |
|---------|-------------|
| **Run Slots** | 1–10 customizable time slots, each with hour, minute, and AM/PM |
| **Daily Sets in overnight** | Toggle (default OFF) — if ON, runs both searches + Daily Set; if OFF, search-only |
| **Default/Restore** | Toggle button — first tap applies preset schedule, second tap restores saved user schedule |

### 4.3 — Edit Mode

The overnight section has a clean summary view by default, showing each run time with a colored dot (blue = AM, purple = PM) and Daily Set status. Tapping "Edit" reveals the full editing UI:

- Hour/minute text inputs for each slot
- AM/PM toggle buttons
- Add Run / Remove Run controls (up to 10 slots)
- Default/Restore toggle
- Daily Sets in overnight toggle

Tapping "Done" auto-commits any in-progress text field edits before closing.

### 4.4 — Technical Details

- Notifications are scheduled via `expo-notifications`
- Scheduling only works in EAS/dev builds (not Expo Go, SDK 53+ restriction)
- Notification tap sets a pending run flag → app navigates to home → auto-starts run
- Run mode respects `overnightDailySet` setting (`both` if ON, `searchonly` if OFF)
- Settings stored under key `@ms_rewards_settings_v2` in AsyncStorage

---

## 5. View Modes (List & Grid)

The home screen has a view mode toggle in the header:

### 5.1 — List View (Default)

Full-width account cards with:
- Avatar with initial letter
- Account name, email
- Status badge (Idle / Running / Done / Failed) with progress animation
- Search count, points earned today, last run time
- Session status banner (active / expired / no session — tap to refresh)
- Play button (searches) and Daily Set button

### 5.2 — Grid View

Compact 3-per-row tiles showing:
- Session status banner at top with status badge
- Large centered avatar with initial
- Account name and email
- Play and Daily Set action buttons
- Allows seeing up to 9 accounts without scrolling

Toggle between views with the grid/list icon in the header.

---

## 6. Branding

| Asset | Description |
|-------|-------------|
| **App Name** | Macro Rewards |
| **App Icon** | "R" gift logo (dark blue background) |
| **Splash Screen** | "R" gift logo on `#0f172a` dark background |
| **Header Logo** | "MACRO REWARDS" transparent text image (bold white with black outline) |
| **Notification Title** | "Macro Rewards — Overnight Run" |

---

## 7. All Bugs Fixed

### Critical Bugs

| # | Bug | Fix |
|---|-----|-----|
| 1 | **CookieManager never loaded** — native cookie capture returned 0 cookies | Changed `require(...).default` to `const mod = require(...); mod.default \|\| mod` |
| 2 | **Cookie save alert invisible on Android** | Moved save + navigation into Alert's `onPress` callback |
| 3 | **EAS build failed — missing project ID** | Added `extra.eas.projectId` and `owner` to `app.json` |
| 4 | **EAS build failed — Kotlin version mismatch** | Removed `expo-dev-client`, switched to `preview` profile |
| 5 | **EAS build failed — CLI version constraint** | Removed the constraint from `eas.json` |

### Medium Bugs

| # | Bug | Fix |
|---|-----|-----|
| 6 | **Cookie variable inconsistency** | Changed both functions to use prepared `acctCookies` variable |
| 7 | **Silent cookie injection failures** | Function now returns result object with error details |
| 8 | **Search count setting ignored** | Runner now uses `settings.defaultSearchCount` |
| 9 | **`_U` cookie not captured** — zero points | Added WebView navigation to `www.bing.com` before capture |

---

## 8. File Map

| File | Purpose |
|------|---------|
| `app/(tabs)/index.tsx` | Home screen — account list/grid, settings steppers, three FAB buttons, view mode toggle |
| `app/(tabs)/settings.tsx` | Settings — search count, delay, Daily Set toggle, overnight mode with edit/summary view |
| `app/(tabs)/queries.tsx` | Query pool editor — view/edit/restore 3000+ search queries |
| `app/(tabs)/logs.tsx` | Run history log viewer |
| `app/(tabs)/_layout.tsx` | Tab bar layout |
| `app/login-webview.tsx` | Microsoft login WebView + cookie capture |
| `app/search-runner.tsx` | Main automation engine — searches, Daily Set, account switching |
| `app/add-account.tsx` | Add account form + "Sign in with Microsoft" button |
| `app/account/[id].tsx` | Account detail screen — edit, delete, session refresh |
| `app/_layout.tsx` | Root layout with font loading, context providers, notification handler |
| `context/AccountsContext.tsx` | Account state, persistence, run tracking |
| `context/SettingsContext.tsx` | Settings state (`OvernightSlot[]`, `overnightDailySet`), persistence (v2 key) |
| `context/QueriesContext.tsx` | Search query pool management |
| `components/AccountCard.tsx` | Full account card (list view) with status, session banner, action buttons |
| `components/AccountGridTile.tsx` | Compact account tile (grid view) with session banner, avatar, actions |
| `components/StatsBar.tsx` | Total points summary bar |
| `components/LogItem.tsx` | Log entry renderer |
| `components/EmptyState.tsx` | Empty list placeholder |
| `components/ErrorBoundary.tsx` | Error boundary wrapper |
| `components/ErrorFallback.tsx` | Error fallback UI |
| `utils/notifications.ts` | Scheduled notification management (`scheduleOvernightNotifications`) |
| `constants/defaultQueries.ts` | 3000+ default Bing search queries |
| `constants/colors.ts` | Light/dark theme color definitions |
| `assets/images/icon.png` | App icon — "R" gift logo |
| `assets/images/splash-icon.png` | Splash screen icon |
| `assets/images/macro-rewards-logo.png` | Header logo — "MACRO REWARDS" transparent text |

---

## 9. Build & Deploy

| Setting | Value |
|---------|-------|
| EAS Profile | `preview` (release APK, not dev client) |
| Build Command | `cd artifacts/mobile && eas build --platform android --profile preview --non-interactive` |
| EAS Account | shroud.dev |
| Project ID | bde8726b-e427-47c3-bfef-bac4d4e46de4 |
| Bundle ID | com.msrewards.automation |
| App Version | 1.3.0 |

---

## 10. Known Limitations

| Issue | Impact | Notes |
|-------|--------|-------|
| Cookies in AsyncStorage (plaintext) | Low | Acceptable for personal use. SecureStore would be better for shared devices. |
| No session expiry check before runs | Low | `isSessionExpired` is time-based (>24h). No real auth check. |
| No per-search retry | Low | Failed searches are skipped; run continues. |
| Shared User-Agent across accounts | Low | All accounts use same Pixel 7 UA string. |
| Daily Set requires screen on | Medium | WebView-based card clicking can't reliably run with screen locked. Overnight mode defaults to search-only for this reason. |
| Notification scheduling requires EAS build | Medium | `expo-notifications` scheduling doesn't work in Expo Go (SDK 53+). |

---

## 11. Recent Changes (This Session)

| Change | Files Modified |
|--------|---------------|
| Renamed app to "Macro Rewards" | `app.json`, `index.tsx`, `login-webview.tsx`, `notifications.ts` |
| Custom branded logo in header | `index.tsx`, `assets/images/macro-rewards-logo.png` |
| Custom app icon (R gift logo) | `assets/images/icon.png`, `assets/images/splash-icon.png` |
| Dark splash screen (#0f172a) | `app.json` |
| Grid view (3-per-row accounts) | `index.tsx`, `components/AccountGridTile.tsx` |
| Overnight mode Edit/Done toggle | `app/(tabs)/settings.tsx` |
| Dynamic run slots (1–10) with add/remove | `app/(tabs)/settings.tsx`, `context/SettingsContext.tsx` |
| Added Inter_300Light and Inter_800ExtraBold fonts | `app/_layout.tsx` |
