import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { licenseKeysTable, featureConfigTable } from "@workspace/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import crypto from "crypto";

const DEFAULT_CONFIGS = [
  { keyType: "basic", maxAccounts: 2, maxSearches: 20, minDelaySeconds: 5, backgroundEnabled: false, customQueriesEnabled: false, dailySetEnabled: true },
  { keyType: "premium", maxAccounts: 5, maxSearches: 40, minDelaySeconds: 3, backgroundEnabled: true, customQueriesEnabled: true, dailySetEnabled: true },
  { keyType: "unlimited", maxAccounts: 999, maxSearches: 999, minDelaySeconds: 3, backgroundEnabled: true, customQueriesEnabled: true, dailySetEnabled: true },
  { keyType: "admin", maxAccounts: 999, maxSearches: 999, minDelaySeconds: 1, backgroundEnabled: true, customQueriesEnabled: true, dailySetEnabled: true },
];

async function seedFeatureConfigs() {
  for (const cfg of DEFAULT_CONFIGS) {
    const existing = await db.select().from(featureConfigTable).where(eq(featureConfigTable.keyType, cfg.keyType));
    if (existing.length === 0) {
      await db.insert(featureConfigTable).values(cfg);
    }
  }
}
seedFeatureConfigs().catch(console.error);

const router: IRouter = Router();

const ADMIN_SECRET = process.env["ADMIN_SECRET"];
if (!ADMIN_SECRET) {
  console.warn("WARNING: ADMIN_SECRET env var not set — admin endpoints will reject all requests");
}

function requireAdmin(req: any, res: any, next: any) {
  if (!ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized — ADMIN_SECRET not configured" });
  }
  const auth = req.headers["x-admin-secret"] || req.query.secret;
  if (!auth || auth !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function generateKey(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(2).toString("hex").toUpperCase());
  }
  return segments.join("-");
}

router.get("/admin/keys", requireAdmin, async (_req, res) => {
  try {
    const keys = await db.select().from(licenseKeysTable).orderBy(licenseKeysTable.createdAt);
    res.json({ keys });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/admin/keys", requireAdmin, async (req, res) => {
  try {
    const { label, maxAccounts, expiresAt, keyType } = req.body;
    const validTypes = ["basic", "premium", "unlimited", "admin"];
    const key = generateKey();
    const [created] = await db.insert(licenseKeysTable).values({
      key,
      label: label || null,
      keyType: validTypes.includes(keyType) ? keyType : "basic",
      maxAccounts: maxAccounts ?? 3,
      expiresAt: new Date(expiresAt),
    }).returning();
    res.json({ key: created });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/admin/keys/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { label, maxAccounts, expiresAt, isActive, keyType } = req.body;
    const validTypes = ["basic", "premium", "unlimited", "admin"];

    const updates: any = { updatedAt: new Date() };
    if (label !== undefined) updates.label = label;
    if (maxAccounts !== undefined) updates.maxAccounts = maxAccounts;
    if (expiresAt !== undefined) updates.expiresAt = new Date(expiresAt);
    if (isActive !== undefined) updates.isActive = isActive;
    if (keyType !== undefined && validTypes.includes(keyType)) updates.keyType = keyType;

    const [updated] = await db.update(licenseKeysTable)
      .set(updates)
      .where(eq(licenseKeysTable.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Key not found" });
    }
    res.json({ key: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/admin/keys/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [deleted] = await db.delete(licenseKeysTable)
      .where(eq(licenseKeysTable.id, id))
      .returning();
    if (!deleted) {
      return res.status(404).json({ error: "Key not found" });
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/validate-admin", async (req, res) => {
  const { secret } = req.body;
  if (!secret || !ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.json({ valid: false });
  }
  res.json({ valid: true, isAdmin: true });
});

router.get("/admin/feature-config", requireAdmin, async (_req, res) => {
  try {
    const configs = await db.select().from(featureConfigTable);
    res.json({ configs });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/admin/feature-config/:keyType", requireAdmin, async (req, res) => {
  try {
    const { keyType } = req.params;
    const { maxAccounts, maxSearches, minDelaySeconds, backgroundEnabled, customQueriesEnabled, dailySetEnabled } = req.body;
    const updates: any = {};
    if (maxAccounts !== undefined) updates.maxAccounts = maxAccounts;
    if (maxSearches !== undefined) updates.maxSearches = maxSearches;
    if (minDelaySeconds !== undefined) updates.minDelaySeconds = minDelaySeconds;
    if (backgroundEnabled !== undefined) updates.backgroundEnabled = backgroundEnabled;
    if (customQueriesEnabled !== undefined) updates.customQueriesEnabled = customQueriesEnabled;
    if (dailySetEnabled !== undefined) updates.dailySetEnabled = dailySetEnabled;

    const [updated] = await db.update(featureConfigTable)
      .set(updates)
      .where(eq(featureConfigTable.keyType, keyType))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Config not found for key type" });
    }
    res.json({ config: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/admin/keys/:id/reset-device", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [updated] = await db.update(licenseKeysTable)
      .set({ boundDeviceId: null, updatedAt: new Date() })
      .where(eq(licenseKeysTable.id, id))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: "Key not found" });
    }
    res.json({ key: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/validate-key", async (req, res) => {
  try {
    const { key, deviceId } = req.body;
    if (!key) {
      return res.status(400).json({ valid: false, error: "Key is required" });
    }

    const [found] = await db.select().from(licenseKeysTable)
      .where(eq(licenseKeysTable.key, key.trim().toUpperCase()));

    if (!found) {
      return res.json({ valid: false, error: "Invalid key" });
    }

    if (!found.isActive) {
      return res.json({ valid: false, error: "Key has been deactivated" });
    }

    if (new Date(found.expiresAt) < new Date()) {
      return res.json({ valid: false, error: "Key has expired" });
    }

    if (deviceId) {
      if (found.boundDeviceId && found.boundDeviceId !== deviceId) {
        return res.json({ valid: false, error: "Key is already in use on another device" });
      }

      if (!found.boundDeviceId) {
        const result = await db.update(licenseKeysTable)
          .set({ boundDeviceId: deviceId, updatedAt: new Date() })
          .where(and(eq(licenseKeysTable.id, found.id), isNull(licenseKeysTable.boundDeviceId)));
        const rowCount = (result as any).rowCount ?? (result as any).changes ?? 0;
        if (rowCount === 0) {
          return res.json({ valid: false, error: "Key is already in use on another device" });
        }
      }
    }

    const [featureConfig] = await db.select().from(featureConfigTable)
      .where(eq(featureConfigTable.keyType, found.keyType));

    res.json({
      valid: true,
      maxAccounts: found.maxAccounts,
      expiresAt: found.expiresAt,
      label: found.label,
      keyType: found.keyType,
      featureConfig: featureConfig || null,
    });
  } catch (e: any) {
    res.status(500).json({ valid: false, error: e.message });
  }
});

export default router;
