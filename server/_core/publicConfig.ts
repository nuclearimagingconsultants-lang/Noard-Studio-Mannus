// This is the complete browser-visible allowlist. Never serialize process.env.
export const PUBLIC_PLATFORM_CONFIG_KEYS = [
  "MANUS_PROJECT_ID",
  "MANUS_OAUTH_PORTAL_URL",
  "MANUS_API_URL",
  "MANUS_API_BROWSER_KEY",
] as const;

export function publicPlatformConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    projectId: env.MANUS_PROJECT_ID ?? "",
    oauthPortalUrl: env.MANUS_OAUTH_PORTAL_URL ?? "",
    apiUrl: env.MANUS_API_URL ?? "",
    apiBrowserKey: env.MANUS_API_BROWSER_KEY ?? "",
  };
}

/** OAuth is optional in public guest deployments. */
export function isManusLoginConfigured(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const { projectId, oauthPortalUrl } = publicPlatformConfig(env);
  if (!projectId.trim() || !oauthPortalUrl.trim()) return false;
  try {
    const parsed = new URL(oauthPortalUrl);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

export function publicPlatformScript(env: NodeJS.ProcessEnv = process.env): string {
  const json = JSON.stringify(publicPlatformConfig(env)).replaceAll("<", "\\u003c");
  return `window.__MANUS_CONFIG__=${json};`;
}
