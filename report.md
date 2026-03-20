# MS Rewards Automation — Junior Dev Report

**Date:** March 20, 2026
**Author:** Junior Developer
**Project:** MS Rewards Automation (Expo React Native)
**Status:** In active development — core automation works, multi-account WebView isolation is a known blocker

---

## 1. What Is This Project?

A mobile app (Android/iOS) built with Expo React Native that automates Microsoft Rewards daily Bing searches across multiple accounts. Instead of manually opening Bing and doing 30+ searches every day on each Microsoft account, the app does it automatically.

It stores each account's login session (browser cookies captured via WebView during login), then fires real HTTP requests to Bing with those cookies — so Microsoft's servers see real searches from real sessions and credit points accordingly.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK (React Native) |
| Language | TypeScript |
| Navigation | Expo Router (file-based) |
| State / Persistence | React Context + AsyncStorage |
| Icons | lucide-react-native (SVG — no font dependency) |
| Fonts | Inter via @expo-google-fonts |
| Haptics | expo-haptics |
| WebView | react-native-webview |
| Gradients | expo-linear-gradient |
| Workspace | pnpm monorepo |

There is a companion Express API server (`artifacts/api-server`) in the monorepo but the mobile app currently runs self-contained without it.

---

## 3. Project Structure

```
artifacts/mobile/
├── app/
│   ├── _layout.tsx                  # Root layout, fonts, providers
│   ├── (tabs)/
│   │   ├── index.tsx                # Home: account list + Run All
│   │   ├── queries.tsx              # Search query pool editor
│   │   ├── logs.tsx                 # Run history
│   │   └── settings.tsx            # Search count, delay, schedule
│   ├── account/[id].tsx             # Account detail / edit
│   ├── add-account.tsx              # Add account screen
│   ├── login-webview.tsx            # Microsoft login + cookie capture
│   └── search-runner.tsx            # Live automation runner
├── components/
│   ├── AccountCard.tsx              # Per-account card on home screen
│   ├── StatsBar.tsx                 # Summary stats (points, done, failed)
│   ├── LogItem.tsx                  # Single row in run log
│   ├── EmptyState.tsx               # Reusable empty list placeholder
│   ├── ErrorBoundary.tsx            # Top-level crash boundary
│   └── ErrorFallback.tsx            # UI for uncaught crashes
├── context/
│   ├── AccountsContext.tsx          # Account list, logs, isRunning flag
│   ├── QueriesContext.tsx           # Query pool (unused/used buckets)
│   └── SettingsContext.tsx          # User preferences
└── constants/
    └── colors.ts                    # Light/dark color tokens
```

---

## 4. How Core Features Work

### 4.1 Adding an Account

**Path A — Microsoft Login (recommended)**
User taps "Sign in with Microsoft" → full-screen WebView opens on `login.live.com`. As the user navigates through Microsoft auth pages, the app injects JavaScript that reads `document.cookie` and relevant `localStorage` values on every page load. These are merged and accumulated across all visited Microsoft domains. When the user reaches the Rewards landing page, a "Session captured" banner appears and they save the account.

**Path B — Manual Entry**
User types name and email. No cookies are captured. Automation will skip this account with "No session cookies" until they go through the login flow.

**Critical limitation:** `document.cookie` in JavaScript ONLY returns non-httpOnly cookies. Microsoft marks most real auth tokens as httpOnly — JS cannot read those. This is the root cause of the biggest problem in this project. See Section 6.

### 4.2 Running Searches — Current Hybrid Approach

The `search-runner.tsx` screen runs when the user taps "Run All":

1. Snapshots target accounts from context at start time (avoids stale state during async loop)
2. Shows a live Bing WebView using the **shared device cookie store** (non-incognito) — this shows whichever account was most recently logged in, purely for visual feedback
3. For each account in sequence:
   - Validates the account has cookies stored
   - Picks search queries from the pool via `pickQueries(count)`
   - For each query: fires a real `fetch()` to `https://www.bing.com/search?q=...` with `credentials: 'omit'` and the account's cookies explicitly set in the `Cookie` header — this is isolated from the WebView and the device cookie jar
   - Also navigates the visible WebView to the same URL (visual only, not what earns the points)
   - Applies configured delay + ±1s jitter between searches
4. After each account, fetches updated points from `rewards.bing.com/api/getuserinfo` with that account's cookies
5. Writes a RunLog entry, then waits 3s before moving to the next account

**Important:** The `fetch()` calls with explicit Cookie headers are what actually credit points. The WebView is visual noise. The WebView and fetch() run completely independently.

### 4.3 Query Pool

Two buckets in AsyncStorage: unused pool and used pool. `pickQueries(n)` moves n queries from unused to used. If the pool is empty, generic fallback queries are used. Users can restore used queries back to the pool.

### 4.4 Settings

| Setting | Default | Range |
|---|---|---|
| Searches per account | 30 | 5–50 |
| Delay between searches | 5s | 3–30s |

---

## 5. The Big Problem: Multi-Account WebView Isolation

This is the most important issue in the whole project. I want to explain it clearly so the senior dev understands exactly what is and isn't possible.

### 5.1 Why account switching is hard

The device has one shared WebView cookie store. When account 1 logs in, their full Microsoft session (including httpOnly cookies — the ones that prove you're logged in) gets written to that shared store. When account 2 logs in, their cookies REPLACE account 1's in the shared store. There's no built-in way to have two separate authenticated Microsoft sessions simultaneously in a WebView without native code.

### 5.2 Why incognito mode doesn't fix it

We tried using incognito mode on the search WebView to isolate account sessions. Incognito gives each WebView instance its own empty, isolated store. The idea was to inject the account's captured cookies via the `Cookie` request header on the initial load, so Bing would see them as authenticated.

It doesn't work because: the cookies we captured during login came from `document.cookie` in JavaScript. `document.cookie` cannot read httpOnly cookies. Microsoft's real auth tokens are httpOnly. So when we give the incognito WebView only the non-httpOnly cookies, Microsoft doesn't recognise the user as logged in and shows the sign-in page.

### 5.3 Current state

The visual WebView shows whichever account is currently active in the shared store. The fetch()-based requests handle actual per-account search attribution correctly. The searches ARE being sent with the right cookies per account via fetch(). The visual just doesn't match.

### 5.4 The Three Options (senior dev must pick one)

**Option A — Persistent per-account incognito WebViews (best Expo Go option)**

Each account gets its own incognito WebView component mounted when the account is saved and kept alive for the entire app session. Because each incognito instance has its own private cookie store, and the user logs in through that specific WebView, Microsoft's full session (httpOnly and all) is held inside that WebView's private store — we never need to read or write the cookies ourselves.

- Login flow: instead of a separate login screen, the login happens inside the account's dedicated background WebView which then stays mounted
- Search flow: the search runner navigates each account's own WebView through Bing queries
- Correct per-account visual AND correct per-account credit
- Downside: sessions are in-memory only — they don't survive the app being killed. User must re-login on next app open. Memory use scales with account count.

This requires significant refactoring of the login flow and a global "session manager" layer in the root layout.

**Option B — Native cookie manager (best long-term option, needs EAS build)**

The package `@react-native-cookies/cookies` can read and write cookies at OS level, including httpOnly ones. After each account logs in (shared non-incognito store), we read the full cookie set (httpOnly included) and save it to AsyncStorage. Before each account's WebView searches, we programmatically load that account's full cookie set into the shared store.

- Full session fidelity including httpOnly tokens
- Sessions persist across app restarts
- Requires EAS custom build — won't run in Expo Go

**Option C — Keep current fetch() approach, drop visual WebView**

The fetch()-based searches already work correctly for per-account isolation and point attribution. Remove the WebView from the search runner entirely, show a clean animated log of searches happening instead.

- Simplest to implement
- Works perfectly for the actual automation goal
- No visual browser — some users may find this less satisfying

---

## 6. Known Limitations

| Issue | Root Cause | Fix |
|---|---|---|
| httpOnly cookies not captured | `document.cookie` JS API limitation | Option A or B above |
| Visual WebView doesn't match active account | Shared OS cookie store | Option A or B above |
|
| No background / scheduled runs | Expo Go doesn't support background tasks | EAS build + `expo-task-manager` + `expo-background-fetch` |
| Sessions lost on app restart | Incognito WebViews are in-memory | EAS build + native cookie manager (Option B) |
| Bot detection risk | Identical `fetch()` calls, same User-Agent pattern | Randomise UA per account, vary timing, consider per-account proxy |
| Points balance not always accurate | Only non-httpOnly cookies in fetch() requests — Rewards API may require httpOnly auth | Fixed by Option A or B |

---

## 7. Things That Are Working Well

- Clean tab navigation with haptics and animations
- Full dark/light mode support
- fetch()-based search automation correctly isolates per-account cookies
- Query pool tracks used vs available across runs and persists properly
- Run logs persist across app restarts
- Error states are clearly surfaced (no session, network failure)
- Account cards show live search progress during a run
- No font-based icon dependency (Lucide SVG icons load reliably)
- TypeScript throughout with zero build errors

---

## 8. Recommended Next Actions for Senior Dev (Priority Order)

### P0 — Fix account isolation properly
Pick one of the three options in Section 5.4 and implement it. Option A is the best bang-for-buck inside Expo Go. Option B is the right long-term answer but needs EAS.

### P2 — Background scheduling with EAS
Use `expo-task-manager` + `expo-background-fetch` to run searches on a schedule (e.g. 2am daily) without the user opening the app. This requires an EAS build.

### P3 — Session health check
Before starting a run, probe the Rewards API with each account's cookies. If the response indicates an expired or invalid session, mark the account as "needs re-login" before wasting time running searches that won't credit.

### P4 — Retry logic
If a search returns a non-2xx status, retry once with a 5s gap before marking it as failed. Currently a single failed request counts as a failed search.

### P5 — Points history chart
Store a daily snapshot of each account's points balance. Show a 30-day line chart on the account detail screen. Users want to see trends.

### P6 — Per-account proxy support
Allow the user to configure a proxy (host:port:user:pass) per account. Routes all fetch() calls for that account through the proxy. Reduces bot detection risk for power users with many accounts.

---

## 9. Architecture Notes for Senior Dev

- All state is React Context + AsyncStorage. Fine for this scale, but if accounts grow beyond ~10 consider SQLite via expo-sqlite for better query performance on logs.
- The QueriesContext file is 3162 lines — the largest in the project by far. It contains the full built-in query pool as a static array. Consider moving the built-in queries to a separate `defaultQueries.ts` file to keep the context readable.
- The companion API server (`artifacts/api-server`) is not connected to anything. It was scaffolded early. Either wire it up (useful for server-side scheduling, proxy management, multi-device sync) or remove it to reduce confusion.
- There is no error retry mechanism anywhere in the fetch loop. A single network blip aborts the current search. Wrapping the fetch calls in a simple exponential-backoff utility would make the runner much more resilient.
- `login-webview.tsx` injects a JS snippet on every page load to capture cookies. The snippet does string manipulation on `document.cookie`. If Microsoft changes their cookie naming, it silently captures nothing. Adding a health-check after capture (e.g. verify the captured cookies can reach the Rewards API) would catch this early.



What it is

A React Native (Expo) mobile app that automates Microsoft Rewards daily tasks across multiple accounts — specifically the 30 daily Bing searches and the "Daily Set" activities. User adds accounts, saves their session cookies, and the app runs everything automatically in the background via a WebView.

How searches work (this part is solid)

Searches use plain fetch() with the account's cookies passed as an explicit header. This works great because it's completely isolated per-account — no shared state. Each account gets its own independent HTTP request with its own cookies. No issues here.

The big complication — httpOnly cookies

This is the core headache. When a user logs into Microsoft Rewards in the device's browser, their real auth tokens are stored as httpOnly cookies. That means JavaScript running on a page (document.cookie) can't read them. Our app can only capture the non-httpOnly cookies.

This causes two problems:

For searches — not an issue because Bing's search endpoint happens to work with the non-httpOnly cookies we can capture.
For Daily Set — Microsoft's Rewards API (/api/getuserinfo) requires those httpOnly tokens. So when we tried to fetch the activity list via API, it returned nothing because it saw us as unauthenticated.
How Daily Set currently works (WebView approach)

The fix was to stop using the API entirely and instead drive the WebView directly. The device's WebView has the full OS cookie store including httpOnly cookies, so it's properly authenticated. The flow is:

Navigate the WebView to rewards.bing.com — it loads as a fully logged-in user
Wait ~3.5s for the page's JavaScript to render the activity cards
Inject a JS script that finds the first uncompleted daily-set card and calls .click() on it — this fires Microsoft's own event handlers which register the completion
Wait for whatever page the click navigates to (quiz, Bing search, etc.)
Navigate back to rewards.bing.com and repeat until no more cards are found
This is better than opening the URL directly because Microsoft registers completion through the click event, not the URL visit.

What still isn't perfect

Multi-account isolation for Daily Set — The WebView uses one shared OS cookie store. So whichever account was last logged into the device browser is the one the Daily Set runs as. If you have 3 accounts, the Daily Set will only actually work for the currently active session. The searches don't have this problem because they use isolated fetch() headers.
Card selectors may break — The JavaScript selectors that find the card elements are based on Microsoft's current DOM structure. If they update their front-end, the selectors could miss cards. There are about 12 fallback selectors stacked up to be resilient, but it's not guaranteed forever.
No quiz completion — If a Daily Set activity is a quiz (multiple choice), clicking the card opens the quiz but doesn't answer it automatically. Points for quiz completion require answering questions, which we don't do yet.
Pending things from the original plan

Session health check (detect when cookies expire and alert the user)
Retry logic on failure
Points history chart
Per-account proxy support (would help with the multi-account isolation problem)
The multi-account Daily Set isolation is the most impactful unresolved issue. The cleanest solution would be per-account proxy routing so each account gets its own WebView context, but that's a significant piece of work.

