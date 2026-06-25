# Macro Rewards

Android app that automates Microsoft Rewards point earning through Bing searches and Daily Set completion across multiple accounts.

**Stack:** Expo SDK 54 · React Native · Express 5 · PostgreSQL (Neon) · Drizzle ORM · pnpm monorepo

---

## What's in this repo

| Directory | Purpose |
|---|---|
| `artifacts/api-server` | Express 5 API server — license keys, admin panel, cookie sync |
| `artifacts/mobile` | Expo React Native Android app |
| `lib/db` | Drizzle ORM schema + database connection |
| `lib/api-spec` | OpenAPI spec + Orval codegen config |

---

## Prerequisites

- **Node.js 20+** and **pnpm** (`npm i -g pnpm`)
- **Expo account** — [expo.dev](https://expo.dev) (free)
- **EAS CLI** — `npm i -g eas-cli`
- **Neon account** — [neon.tech](https://neon.tech) (free PostgreSQL)
- **Render account** — [render.com](https://render.com) (free tier for the API server)

---

## Setup: Replit users

### 1. Fork the Repl

Click **Fork** on the Repl to get your own copy. All pnpm dependencies are already installed.

### 2. Create a Neon database

1. Go to [neon.tech](https://neon.tech) → create a free project
2. Copy the **Connection string** (looks like `postgresql://user:pass@host/db?sslmode=require`)
3. In your Repl, open **Secrets** (padlock icon) and add:
   - `DATABASE_URL` = your Neon connection string

### 3. Set required secrets

In Replit **Secrets**, add:

| Secret | Value |
|---|---|
| `DATABASE_URL` | Neon connection string from step 2 |
| `ADMIN_SECRET` | A strong random password you choose (e.g. `openssl rand -hex 32`) |

### 4. Push the database schema

Open the **Shell** tab and run:

```bash
cd lib/db && pnpm run push
```

This creates the `license_keys`, `feature_config`, and `device_cookies` tables in your Neon database.

### 5. Start the API server

The workflow **API Server** is already configured. Click **Run** or start it from the Workflows panel. You should see:

```
Server running on port XXXX
```

Visit `https://<your-repl-slug>.replit.app/api/healthz` — it should return `{"status":"ok"}`.

### 6. Deploy the API to Render (for production APK builds)

The Replit dev server is fine for testing, but APK builds need a permanent URL. See the **Render deployment** section below.

### 7. Build the Android APK

See the **EAS Build** section below.

---

## Setup: GitHub users

### 1. Clone and install

```bash
git clone https://github.com/your-username/macro-rewards.git
cd macro-rewards
pnpm install
```

### 2. Create a Neon database

1. Go to [neon.tech](https://neon.tech) → create a free project
2. Copy the **Connection string**

### 3. Set environment variables

Create a `.env` file in the repo root (this is only used locally by the API server):

```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
ADMIN_SECRET=your-strong-random-secret
PORT=3001
```

### 4. Push the database schema

```bash
cd lib/db && pnpm run push
```

### 5. Run the API server locally

```bash
pnpm --filter @workspace/api-server run dev
```

The server starts on `http://localhost:3001`. Test it:

```bash
curl http://localhost:3001/api/healthz
# {"status":"ok"}
```

### 6. Deploy the API to Render

See the **Render deployment** section below — you need a public URL to bake into the APK.

### 7. Build the Android APK

See the **EAS Build** section below.

---

## Render deployment (API server)

Render hosts the API server so the Android app can reach it from anywhere.

### 1. Create a new Web Service on Render

Go to [render.com](https://render.com) → **New → Web Service** → connect your GitHub repo.

### 2. Configure the service

| Field | Value |
|---|---|
| **Root directory** | *(leave blank — monorepo root)* |
| **Build command** | `pnpm install && pnpm --filter @workspace/api-server run build` |
| **Start command** | `node artifacts/api-server/dist/index.cjs` |
| **Instance type** | Free |

### 3. Add environment variables in Render

In the Render service → **Environment**:

| Key | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string |
| `ADMIN_SECRET` | Same strong secret you chose earlier |

Render automatically sets `PORT` — do not override it.

### 4. Deploy

Click **Deploy**. Once live, test your service URL:

```
https://your-service.onrender.com/api/healthz
```

### 5. (Optional) Keep it awake with UptimeRobot

Render free tier spins down after 15 minutes of inactivity. Set up a free monitor at [uptimerobot.com](https://uptimerobot.com) that pings `https://your-service.onrender.com/api/healthz` every 5 minutes.

---

## EAS Build (Android APK)

### 1. Log in to EAS

```bash
cd artifacts/mobile
eas login
```

### 2. Set the API URL in eas.json

Open `artifacts/mobile/eas.json` and update the `EXPO_PUBLIC_API_URL` in the `preview` and `production` profiles to point to your Render URL:

```json
"env": {
  "EXPO_PUBLIC_API_URL": "https://your-service.onrender.com/api"
}
```

### 3. Configure your EAS project

If you're using your own Expo account (not the original), run:

```bash
eas init
```

This creates a new project under your account and updates `app.json`.

### 4. Build the APK

```bash
eas build --platform android --profile preview --non-interactive
```

The build runs in the cloud. When it finishes, download the `.apk` from the EAS dashboard and install it on your Android device.

### 5. Push OTA updates (JS-only changes)

For changes that don't touch native code (no new permissions or native modules):

```bash
pnpm --filter @workspace/mobile run update "your update message"
```

The app downloads the update silently on next launch.

> **Note:** Any change that adds a new native module, permission, or Expo plugin requires a full EAS build.

---

## Environment variables reference

### API server

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `ADMIN_SECRET` | Yes | Secret for admin panel login and API auth |
| `PORT` | Auto | Set by Render/Replit automatically |

### Mobile app (EAS env)

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Yes | Full API base URL, e.g. `https://your-service.onrender.com/api` |
| `EXPO_PUBLIC_OWNER_MODE` | No | Set to `"true"` to bypass the license gate entirely (owner/dev builds) |
| `EXPO_PUBLIC_ADMIN_SECRET` | No | Same value as `ADMIN_SECRET` — needed for the in-app admin panel in owner mode |

---

## Admin panel

The web-based admin panel is at:

```
https://your-service.onrender.com/api/admin
```

Log in with your `ADMIN_SECRET`. From here you can:

- Create and manage license keys
- Set per-tier feature limits (max accounts, max searches, delays)
- View device bindings and reset them
- View synced account cookies

### Creating your first license key

1. Open the admin panel
2. Click **Create Key**
3. Set a label, expiry date, account limit, and key type (`basic` / `premium` / `unlimited` / `admin`)
4. Copy the generated `XXXX-XXXX-XXXX-XXXX` key and enter it in the app

---

## License key types

| Type | Accounts | Searches | Background | Custom queries |
|---|---|---|---|---|
| `basic` | 2 | 20 | No | No |
| `premium` | 5 | 40 | Yes | Yes |
| `unlimited` | 999 | 999 | Yes | Yes |
| `admin` | 999 | 999 | Yes | Yes |

Limits can be changed per-tier from the admin panel without rebuilding.

---

## Local development tips

- The API server hot-reloads with `pnpm --filter @workspace/api-server run dev`
- Schema changes: edit files in `lib/db/src/schema/`, then run `cd lib/db && pnpm run push`
- The mobile app in Expo Go connects to the API via the dev domain automatically (no extra config needed for local testing)
- `EXPO_PUBLIC_OWNER_MODE=true` in your local `.env` skips the license screen entirely
