# MS Rewards Automation — Junior Dev Report

**Date:** March 20, 2026  
**Author:** Junior Developer  
**Project:** MS Rewards Automation (Expo React Native)

---

## 1. What Is This Project?

This is a mobile app (Android/iOS) built with Expo and React Native that automates Microsoft Rewards daily tasks across multiple accounts. The idea is simple: instead of manually opening Bing and doing 30+ searches every day on each of your Microsoft accounts, this app does it for you in the background.

It stores each account's login session (cookies), then fires real HTTP requests to `bing.com` with those cookies — so from Microsoft's perspective, a real user is searching. It also tries to fetch your updated points balance from the Rewards dashboard after each run.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK (React Native) |
| Language | TypeScript |
| Navigation | Expo Router (file-based, like Next.js) |
| State / Storage | React Context + AsyncStorage |
| Icons | lucide-react-native (SVG, no font loading) |
| Fonts | Inter (via @expo-google-fonts) |
| Animations | React Native Animated API |
| Haptics | expo-haptics |
| Login WebView | react-native-webview |
| Gradients | expo-linear-gradient |
| Workspace | pnpm monorepo |

There is also a companion Express API server (`artifacts/api-server`) in the monorepo, though the mobile app currently runs self-contained without depending on it.

---

## 3. Project Structure

```
artifacts/mobile/
├── app/
│   ├── _layout.tsx              # Root layout, font loading, providers
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab bar (Accounts / Queries / Logs / Settings)
│   │   ├── index.tsx            # Home — account list + Run All button
│   │   ├── queries.tsx          # Search query pool management
│   │   ├── logs.tsx             # Run history log viewer
│   │   └── settings.tsx        # App settings (search count, delay, schedule)
│   ├── account/[id].tsx         # Account detail & edit modal
│   ├── add-account.tsx          # Add account (MS login or manual)
│   ├── login-webview.tsx        # Microsoft sign-in WebView + cookie capture
│   └── search-runner.tsx        # Automation runner screen
├── components/
│   ├── AccountCard.tsx          # Card shown on home screen per account
│   ├── EmptyState.tsx           # Reusable empty list placeholder
│   ├── StatsBar.tsx             # Summary stats (points, done, running, failed)
│   ├── LogItem.tsx              # Single row in the run log list
│   ├── ErrorBoundary.tsx        # Top-level React error boundary
│   └── ErrorFallback.tsx        # UI shown when the app crashes
├── context/
│   ├── AccountsContext.tsx      # Accounts list, run logs, isRunning flag
│   ├── QueriesContext.tsx       # Query pool (unused / used buckets)
│   └── SettingsContext.tsx      # User settings (searchCount, delay, schedule)
└── constants/
    └── colors.ts                # Light/dark color tokens
```

---

## 4. How the Core Features Work

### 4.1 Adding an Account

There are two paths:

**Path A — Microsoft Login (recommended)**  
User taps "Sign in with Microsoft" → a full-screen WebView opens at `login.live.com`. As the user navigates through Microsoft's auth pages (login, 2FA, consent, Rewards landing), the app injects a JavaScript snippet into each page that reads `document.cookie` and relevant `localStorage` tokens. These cookies are merged and accumulated across all visited domains (`login.live.com`, `bing.com`, `rewards.bing.com`, etc.). When the user lands on the Rewards domain, a "Session captured" banner appears and they can save the account.

**Path B — Manual entry**  
User can type a name and email without logging in. The account is saved but has no cookies, so automation will fail with "No session cookies" until they refresh the session via the login flow.

**Limitation:** `document.cookie` in JavaScript only returns non-httpOnly cookies. Microsoft sets some auth tokens as httpOnly (invisible to JS), which is why some searches might fail — those tokens can't be captured this way from a WebView without native cookie manager access.

### 4.2 Running Searches (the actual automation)

The `search-runner.tsx` screen is the core of the app. When triggered, it:

1. **Snapshots** the target accounts at start time (avoids stale React state during async loop)
2. **For each account in sequence:**
   - Validates the account has cookies stored
   - Sends a probe search to Bing (`GET /search?q=bing`) with the account's cookies as the `Cookie` HTTP header — this is a real network request
   - Runs the configured number of Bing searches (default 30), each with the account's unique cookie string as the `Cookie` header
   - Adds a human-like delay between searches (configurable 3–30s + ±1s jitter)
   - Marks the Daily Set as attempted (actual Daily Set automation would need WebView-level UI interaction)
   - Calls the Rewards API (`/api/getuserinfo`) with the account's cookies to fetch real points
3. **After each account**, waits 3 seconds before moving to the next to avoid rate limiting
4. **Writes a RunLog** entry per account with results

**Account isolation:** Each account's cookies are passed as a plain string to `fetch()` headers. Since `fetch()` in React Native (unlike browsers) allows setting the `Cookie` header directly, each account's requests are completely isolated — they don't share or interfere with each other or the device's browser session.

### 4.3 Query Pool

The app maintains two lists of search queries stored in AsyncStorage:
- **Pool** — queries waiting to be used
- **Used** — queries that have been consumed

During a run, `consumeQueries(n)` moves `n` queries from the pool to used. If the pool runs dry, fallback generic queries are used. Users can edit the pool freely and restore used queries back.

### 4.4 Settings

| Setting | Default | Range |
|---|---|---|
| Searches per account | 30 | 5–50 |
| Delay between searches | 5s | 3–30s |
| Daily Set | Enabled | Toggle |
| First run time | Configurable | Schedule |

Settings are persisted in AsyncStorage via `SettingsContext`.

---

## 5. Changes Made During This Session

### 5.1 Icon Library Migration (Feather → Lucide)

**Problem:** `@expo/vector-icons` Feather icons were rendering as broken rectangular boxes on the user's device. These icons depend on a font file being loaded, and the font was not loading reliably.

**Fix:** Migrated the entire app from `@expo/vector-icons` (Feather, font-based) to `lucide-react-native` (SVG-based, no font dependency).

- Installed `lucide-react-native`
- Removed `Feather.font` from `useFonts` in `_layout.tsx`
- Rewrote all 15 files that used Feather icons
- Changed `EmptyState` component's `icon` prop from a string name to a direct LucideIcon component reference (e.g. `icon={Users}` instead of `icon="users"`)
- Changed `AccountCard`, `StatsBar`, `LogItem`, and all screens to import and use named Lucide icon components

**Files changed:** `_layout.tsx`, `(tabs)/_layout.tsx`, `index.tsx`, `queries.tsx`, `logs.tsx`, `settings.tsx`, `account/[id].tsx`, `add-account.tsx`, `login-webview.tsx`, `search-runner.tsx`, `AccountCard.tsx`, `EmptyState.tsx`, `StatsBar.tsx`, `LogItem.tsx`, `ErrorFallback.tsx`

### 5.2 Settings — Search Delay Control

Added a "Delay between searches" stepper in the Settings screen (3–30 seconds). Previously hardcoded to a random 5–8 seconds, now the user controls it and it's applied in the search runner via `settings.searchDelay`.

### 5.3 Per-Account Search Count

Added a search count stepper to the Account detail screen's edit form. Users can now configure each account to run a different number of daily searches (5–50), separate from the global default.

### 5.4 Removed "Add Account" Button from Empty State

The home screen's empty state previously showed both a message and an "Add Account" action button in the middle of the screen. The button was removed — the + button in the header is the correct entry point.

### 5.5 Real Search Implementation

**Problem:** The search runner was 100% fake — it only used `setTimeout` calls and random numbers. No real network requests were made. This meant Microsoft never "saw" any account switching.

**Fix:** Implemented real HTTP-based Bing search:
- `performBingSearch(query, cookies)` — makes a real `GET` request to `https://www.bing.com/search?q=...` with the account's cookies as the `Cookie` header and a mobile User-Agent
- `fetchRewardsPoints(cookies)` — calls `https://rewards.bing.com/api/getuserinfo` with the account's cookies and parses the real points balance
- Each account uses its own isolated cookie string — no cross-account contamination
- Network errors are detected and surfaced in the UI
- Proper account-by-account sequential execution with 3s inter-account pause

### 5.6 Improved Cookie Capture in Login WebView

**Before:** Cookies were only captured when the user reached the Rewards domain.

**After:** The cookie-capture JavaScript is injected on every page navigation during login. Cookies from all Microsoft domains visited (`login.live.com`, `bing.com`, `rewards.bing.com`) are merged together rather than replaced. Email and username detection is also improved with more CSS selectors.

### 5.7 Bug Fix — Account Deletion

`account/[id].tsx` was calling `deleteAccount(id)` but the `AccountsContext` only exports `removeAccount`. This would have thrown a runtime crash when the user tried to delete an account. Fixed to call `removeAccount`.

---

## 6. Known Limitations

| Issue | Reason | Potential Fix |
|---|---|---|
| httpOnly cookies not captured | `document.cookie` JS API can't access httpOnly cookies | Use native `@react-native-cookies/cookies` package (requires custom dev build, won't work in Expo Go) |
| Daily Set not automated | Requires tapping UI elements in a browser — can't do with plain HTTP | Implement a hidden WebView that navigates and taps the Daily Set cards |
| Microsoft bot detection | Repeated identical `fetch()` calls may be fingerprinted | Randomize User-Agent, vary search patterns, use per-account proxy if needed |
| Schedule / background runs | Expo Go doesn't support background tasks | Requires Expo Application Services (EAS) build with `expo-task-manager` and `expo-background-fetch` |
| Web preview incomplete | WebView and some native APIs don't work in web mode | Mobile-only features need a real device or Android emulator |

---

## 7. Data Flow Summary

```
User taps "Run All"
       ↓
index.tsx calls startRun() + router.push("/search-runner")
       ↓
search-runner.tsx snapshots accounts from context
       ↓
For each account:
  1. Read account.cookies (Record<string, string>)
  2. Build Cookie header string from cookies
  3. GET https://www.bing.com/search?q={query}
     with Cookie: {cookie string}  ← real HTTP request
  4. Wait searchDelay seconds
  5. Repeat for each query
  6. GET https://rewards.bing.com/api/getuserinfo
     with Cookie: {cookie string}  ← real HTTP request
  7. updateAccount() with new points/status
  8. addLog() with results
       ↓
stopRun() called, user sees completion screen
```

---

## 8. What's Working Well

- Clean tab-based navigation with smooth animations and haptic feedback
- Dark mode fully supported everywhere
- Per-account cookie isolation in the search runner is correct
- Query pool properly tracks used vs. available queries across runs
- Run logs persist across app restarts
- Error states are clearly communicated in the UI (no session, network failure, etc.)
- The account card shows real-time progress during a run (search count, progress bar)

---

## 9. What I Would Improve Next

1. **Hidden WebView per account** to handle httpOnly cookies and Daily Set automation properly
2. **Background task scheduling** with EAS Build so searches run automatically overnight
3. **Proxy support** per account to reduce bot detection risk
4. **Points history chart** — track points over time per account
5. **Retry logic** — if a search fails, retry once before marking as failed
6. **Session health check** — proactively warn when cookies are about to expire rather than failing mid-run
