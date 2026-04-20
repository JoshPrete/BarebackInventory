/**
 * Shopify client-credentials token provider.
 *
 * Fetches a short-lived access token from the Shopify OAuth token endpoint
 * using the Dev Dashboard client_credentials grant, then caches it in memory
 * until 60 seconds before expiry. The Next.js process is long-lived in dev
 * (and warm in serverless), so this avoids a token round-trip on every request.
 *
 * Token endpoint:
 *   POST https://{shop}.myshopify.com/admin/oauth/access_token
 *   Content-Type: application/x-www-form-urlencoded
 *   Body: grant_type=client_credentials&client_id=…&client_secret=…
 *
 * Response: { access_token, expires_in, token_type }
 */

import type { ShopifyConfig } from "./config";

interface TokenCache {
  accessToken: string;
  /** Epoch ms at which the token should be considered expired. */
  expiresAt: number;
}

// Module-level cache — one entry per shop (single-store app, so effectively one entry).
const cache = new Map<string, TokenCache>();

/** Seconds before true expiry at which we pro-actively refresh the token. */
const REFRESH_BUFFER_SECONDS = 60;

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type?: string;
}

async function fetchAccessToken(cfg: ShopifyConfig): Promise<TokenCache> {
  const url = `https://${cfg.shopDomain}/admin/oauth/access_token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });

  console.log(`[shopify/auth] Requesting access token for shop: ${cfg.shop}`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    // Never serve a stale cached response for auth requests.
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    console.error(
      `[shopify/auth] Token request failed — HTTP ${res.status} for shop: ${cfg.shop}. Response body: ${text}`,
    );
    throw new Error(
      `Shopify token request failed (HTTP ${res.status}): ${text}`,
    );
  }

  const json = (await res.json()) as TokenResponse;
  if (!json.access_token) {
    const safeJson = JSON.stringify({ ...json, access_token: "[REDACTED]" });
    console.error(
      `[shopify/auth] Token response missing access_token for shop: ${cfg.shop}. Response: ${safeJson}`,
    );
    throw new Error(
      `Shopify token response missing access_token: ${JSON.stringify(json)}`,
    );
  }

  const expiresAt =
    Date.now() + (json.expires_in - REFRESH_BUFFER_SECONDS) * 1000;

  console.log(
    `[shopify/auth] Token acquired for shop: ${cfg.shop} — expires_in: ${json.expires_in}s, effective TTL: ${json.expires_in - REFRESH_BUFFER_SECONDS}s`,
  );

  return { accessToken: json.access_token, expiresAt };
}

/**
 * Return a valid Shopify Admin access token, fetching a new one if the
 * cached token is absent or within 60 s of expiry.
 */
export async function getAccessToken(cfg: ShopifyConfig): Promise<string> {
  const cached = cache.get(cfg.shop);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.accessToken;
  }

  const entry = await fetchAccessToken(cfg);
  cache.set(cfg.shop, entry);
  return entry.accessToken;
}
