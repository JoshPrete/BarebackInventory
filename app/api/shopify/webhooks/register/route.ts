/**
 * POST /api/shopify/webhooks/register
 *
 * Registers the orders/create webhook subscription with Shopify so that new
 * orders are pushed to this app in real time.
 *
 * Call this once after deploying to production:
 *   curl -X POST https://your-domain.com/api/shopify/webhooks/register
 *
 * Idempotent — if the webhook URL is already registered the existing
 * subscription is returned and no duplicate is created.
 *
 * Required env var:
 *   NEXT_PUBLIC_APP_URL — your production domain, e.g. https://your-domain.vercel.app
 *   (Vercel's VERCEL_URL is deployment-specific and changes on every deploy;
 *    use NEXT_PUBLIC_APP_URL for a stable production URL.)
 *
 * GET /api/shopify/webhooks/register
 *   Lists all currently registered orders/create webhook subscriptions.
 */

import { NextResponse } from "next/server";
import { shopifyAdminGraphql } from "@/lib/shopify/admin";
import { isShopifyConfigured } from "@/lib/shopify/config";

// ─── GraphQL ──────────────────────────────────────────────────────────────────

const LIST_WEBHOOKS_QUERY = `
  query ListOrdersWebhooks {
    webhookSubscriptions(first: 25, topics: ORDERS_CREATE) {
      edges {
        node {
          id
          topic
          createdAt
          updatedAt
          endpoint {
            ... on WebhookHttpEndpoint {
              callbackUrl
            }
          }
        }
      }
    }
  }
`;

const CREATE_WEBHOOK_MUTATION = `
  mutation RegisterWebhook($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
    webhookSubscriptionCreate(
      topic: $topic
      webhookSubscription: { callbackUrl: $callbackUrl, format: JSON }
    ) {
      webhookSubscription {
        id
        topic
        createdAt
        endpoint {
          ... on WebhookHttpEndpoint {
            callbackUrl
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebhookEndpoint {
  callbackUrl?: string;
}

interface WebhookNode {
  id: string;
  topic: string;
  createdAt: string;
  updatedAt?: string;
  endpoint: WebhookEndpoint;
}

interface ListWebhooksResponse {
  webhookSubscriptions: {
    edges: { node: WebhookNode }[];
  };
}

interface CreateWebhookResponse {
  webhookSubscriptionCreate: {
    webhookSubscription: WebhookNode | null;
    userErrors: { field: string; message: string }[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAppUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (url) return url.replace(/\/$/, ""); // strip trailing slash
  // Fallback: Vercel auto-sets VERCEL_URL (no https://) — use only if present.
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;
  return null;
}

// ─── GET — list current subscriptions ────────────────────────────────────────

export async function GET() {
  if (!isShopifyConfigured()) {
    return NextResponse.json({ error: "Shopify not configured" }, { status: 500 });
  }

  const res = await shopifyAdminGraphql<ListWebhooksResponse>(LIST_WEBHOOKS_QUERY);
  if (res.errors?.length) {
    return NextResponse.json({ error: res.errors.map((e) => e.message).join(", ") }, { status: 500 });
  }

  const webhooks = (res.data?.webhookSubscriptions.edges ?? []).map((e) => ({
    id: e.node.id,
    topic: e.node.topic,
    callbackUrl: e.node.endpoint.callbackUrl ?? null,
    createdAt: e.node.createdAt,
  }));

  return NextResponse.json({ webhooks });
}

// ─── POST — register webhook ──────────────────────────────────────────────────

export async function POST() {
  if (!isShopifyConfigured()) {
    return NextResponse.json({ error: "Shopify not configured" }, { status: 500 });
  }

  const appUrl = getAppUrl();
  if (!appUrl) {
    return NextResponse.json(
      {
        error: "NEXT_PUBLIC_APP_URL is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.",
        example: "https://your-project.vercel.app",
      },
      { status: 500 },
    );
  }

  const callbackUrl = `${appUrl}/api/shopify/webhooks/orders/create`;

  // Check for existing subscription at this URL to stay idempotent.
  const listRes = await shopifyAdminGraphql<ListWebhooksResponse>(LIST_WEBHOOKS_QUERY);
  const existing = (listRes.data?.webhookSubscriptions.edges ?? []).find(
    (e) => e.node.endpoint.callbackUrl === callbackUrl,
  );

  if (existing) {
    console.log(`[webhooks/register] Already registered: ${existing.node.id}`);
    return NextResponse.json({
      status: "already_registered",
      webhookId: existing.node.id,
      callbackUrl,
    });
  }

  // Register new subscription.
  const createRes = await shopifyAdminGraphql<CreateWebhookResponse>(CREATE_WEBHOOK_MUTATION, {
    topic: "ORDERS_CREATE",
    callbackUrl,
  });

  const userErrors = createRes.data?.webhookSubscriptionCreate.userErrors ?? [];
  if (userErrors.length > 0 || createRes.errors?.length) {
    const messages = [
      ...(createRes.errors ?? []).map((e) => e.message),
      ...userErrors.map((e) => `${e.field}: ${e.message}`),
    ];
    console.error("[webhooks/register] Failed:", messages);
    return NextResponse.json({ error: messages.join(", ") }, { status: 500 });
  }

  const subscription = createRes.data?.webhookSubscriptionCreate.webhookSubscription;
  console.log(`[webhooks/register] Registered webhook ${subscription?.id} → ${callbackUrl}`);

  return NextResponse.json({
    status: "registered",
    webhookId: subscription?.id,
    callbackUrl,
  });
}
