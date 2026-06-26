import { Router, type IRouter } from "express";

const router: IRouter = Router();

const RENDER_API_URL = process.env["RENDER_API_URL"];

const PROXIED_ROUTES = ["/validate-key", "/validate-admin", "/sync-cookies"];

if (RENDER_API_URL) {
  console.log(`[proxy] Forwarding ${PROXIED_ROUTES.join(", ")} → ${RENDER_API_URL}`);

  for (const route of PROXIED_ROUTES) {
    router.post(route, async (req, res) => {
      try {
        const upstream = await fetch(`${RENDER_API_URL}${route}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req.body),
        });
        const data = await upstream.json();
        res.status(upstream.status).json(data);
      } catch (e: any) {
        console.error(`[proxy] ${route} error:`, e?.message);
        res.status(502).json({ error: "Upstream server unavailable. Please try again." });
      }
    });
  }
}

export default router;
