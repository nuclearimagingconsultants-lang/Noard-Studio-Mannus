import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerContentRoutes } from "./content";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import {
  isManusLoginConfigured,
  publicPlatformScript,
} from "./_core/publicConfig";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerPublicAssetRedirect } from "./publicAssetOrigin";

/**
 * Serverless API app. It intentionally does not import Vite, serve static
 * files, or listen on a port: Vercel serves dist/public from its CDN and calls
 * this exported app only for API and public-media redirect routes.
 */
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/platform/config.js", (_req, res) => {
  res
    .set("Cache-Control", "no-store")
    .type("application/javascript")
    .send(publicPlatformScript());
});

registerPublicAssetRedirect(app);
registerContentRoutes(app);

// A public Vercel import is guest-first. OAuth is present only when an operator
// supplies both public login coordinates; guest progress and notes stay local.
if (isManusLoginConfigured()) registerOAuthRoutes(app);

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Keep missing API/media requests as JSON 404s; they must never fall through
// to the SPA HTML rewrite.
app.use((req, res) => {
  const apiOrMedia = req.path.startsWith("/api/") || req.path.startsWith("/manus-storage/");
  res.status(404).json({ error: apiOrMedia ? "Not found" : "API route not found" });
});

export default app;
