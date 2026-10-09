import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

type PublicLoginConfig = {
  projectId?: string;
  oauthPortalUrl?: string;
};

/** A public export is guest-first unless both OAuth coordinates are present. */
export function isLoginConfigured(
  config: PublicLoginConfig | undefined = window.__MANUS_CONFIG__
): boolean {
  if (!config?.projectId?.trim() || !config.oauthPortalUrl?.trim()) return false;
  try {
    const url = new URL(config.oauthPortalUrl);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

// Start the Manus OAuth login from an event handler or effect. It writes the
// one-time state cookie immediately; public guest deployments simply return
// false when no operator-provided OAuth configuration is available.
export const startLogin = () => {
  const config = window.__MANUS_CONFIG__;
  const oauthPortalUrl = config?.oauthPortalUrl;
  const appId = config?.projectId;
  if (!isLoginConfigured(config) || !oauthPortalUrl || !appId) return false;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  const state = encodeOAuthState({ redirectUri, nonce });

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("responseType", "code");

  window.location.href = url.toString();
  return true;
};
