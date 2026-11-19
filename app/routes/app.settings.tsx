import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { getShopify } from "../shopify.server";
import { getDb } from "../db.server";
import { envFromContext } from "../lib/server-env";
import { shops } from "../db/schema";
import { eq } from "drizzle-orm";
import { getOrCreateShop } from "../services/shop.server";
import {
  DEFAULT_GUARD_SETTINGS,
  parseGuardSettings,
  type GuardSettings,
} from "../lib/guard-settings";
import { getPlanCapabilities, type Plan } from "../services/plan-enforcer.server";
import { managedPricingUrl } from "../services/billing/managed-pricing";

export { DEFAULT_GUARD_SETTINGS, type GuardSettings };

interface LoaderData {
  settings: GuardSettings;
  shopPlan: string;
  trackedCount: number;
  productLimit: number;
  autoClearAllowed: boolean;
  appHandle: string;
}

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const env = envFromContext(context);
  const { authenticate } = getShopify(env);
  const { session } = await authenticate.admin(request);
  const dbClient = getDb(env.DATABASE_URL);

  try {
    const shopRecord = await dbClient.query.shops.findFirst({
      where: eq(shops.domain, session.shop),
    });

    const plan = (shopRecord?.plan as Plan) ?? "free";
    const data: LoaderData = {
      settings: parseGuardSettings(shopRecord?.settings),
      shopPlan: shopRecord?.plan ?? "free",
      trackedCount: shopRecord?.trackedCount ?? 0,
      productLimit: shopRecord?.productLimit ?? 25,
      autoClearAllowed: getPlanCapabilities(plan).autoClear,
      appHandle: env.SHOPIFY_APP_HANDLE ?? "priceanchor",
    };
    return data;
  } catch {
    const data: LoaderData = {
      settings: DEFAULT_GUARD_SETTINGS,
      shopPlan: "free",
      trackedCount: 0,
      productLimit: 25,
      autoClearAllowed: false,
      appHandle: env.SHOPIFY_APP_HANDLE ?? "priceanchor",
    };
    return data;
  }
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const env = envFromContext(context);
  const { authenticate } = getShopify(env);
  const { session } = await authenticate.admin(request);
  const dbClient = getDb(env.DATABASE_URL);
  const formData = await request.formData();

  const settings: GuardSettings = {
    warnDays: Math.max(
      1,
      parseInt(String(formData.get("warnDays") ?? "60"), 10) || 60,
    ),
    reviewDays: Math.max(
      1,
      parseInt(String(formData.get("reviewDays") ?? "75"), 10) || 75,
    ),
    staleDays: Math.max(
      1,
      parseInt(String(formData.get("staleDays") ?? "90"), 10) || 90,
    ),
    autoClear: formData.get("autoClear") === "true",
  };

  try {
    const shopRecord = await getOrCreateShop(session.shop, dbClient);
    if (shopRecord) {
      // Server-side tier enforcement: auto-clear persists only on Unlimited.
      const plan = (shopRecord.plan as Plan) ?? "free";
      if (!getPlanCapabilities(plan).autoClear) settings.autoClear = false;
      await dbClient
        .update(shops)
        .set({ settings })
        .where(eq(shops.id, shopRecord.id));
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save settings",
    };
  }
};

const inputStyle = {
  width: "100%",
  padding: "8px",
  borderRadius: 8,
  border: "1px solid #c9c9c9",
  fontSize: 14,
} as const;

export default function SettingsPage() {
  const { settings, shopPlan, trackedCount, productLimit, autoClearAllowed, appHandle } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const isSaving = fetcher.state !== "idle";
  const saveSuccess = fetcher.data?.success === true;

  return (
    <s-page heading="Settings">
      {saveSuccess && (
        <s-banner tone="success" heading="Settings saved" dismissible>
          Your stale-sale guard preferences have been updated.
        </s-banner>
      )}
      {fetcher.data?.success === false && (
        <s-banner tone="critical" heading="Save failed" dismissible>
          {fetcher.data.error ?? "An error occurred. Please try again."}
        </s-banner>
      )}

      <fetcher.Form method="post">
        <s-section heading="Stale-sale guard">
          <s-paragraph color="subdued">
            Compare-at anchors older than these thresholds are flagged on the
            Products page. Shopify never expires compare-at prices on its own,
            so stale anchors keep showing a sale label indefinitely.
          </s-paragraph>
          <s-stack direction="block" gap="base">
            <label htmlFor="warnDays">
              <s-text>Warn after (days)</s-text>
            </label>
            <input
              id="warnDays"
              style={inputStyle}
              name="warnDays"
              type="number"
              min={1}
              defaultValue={settings.warnDays}
            />
            <label htmlFor="reviewDays">
              <s-text>Review after (days)</s-text>
            </label>
            <input
              id="reviewDays"
              style={inputStyle}
              name="reviewDays"
              type="number"
              min={1}
              defaultValue={settings.reviewDays}
            />
            <label htmlFor="staleDays">
              <s-text>Stale after (days)</s-text>
            </label>
            <input
              id="staleDays"
              style={inputStyle}
              name="staleDays"
              type="number"
              min={1}
              defaultValue={settings.staleDays}
            />
            {autoClearAllowed ? (
              <s-stack direction="inline" gap="base" align-items="center">
                <s-switch
                  label="Auto-clear stale compare-at prices"
                  name="autoClear"
                  value="true"
                  checked={settings.autoClear ? true : undefined}
                />
              </s-stack>
            ) : (
              <s-paragraph color="subdued">
                Automatic clearing of stale compare-at prices is available on
                the Unlimited plan. Flagging on the Products page works on
                Standard and above.
              </s-paragraph>
            )}
          </s-stack>
        </s-section>

        <s-section heading="Plan & Limits">
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base" align-items="center">
              <s-text>Current plan:</s-text>
              <s-badge tone={shopPlan === "free" ? "warning" : "success"}>
                {shopPlan.charAt(0).toUpperCase() + shopPlan.slice(1)}
              </s-badge>
            </s-stack>
            <s-text color="subdued">
              {trackedCount} / {productLimit === 999999 ? "∞" : productLimit}{" "}
              tracked products in use
            </s-text>
            <s-link href={managedPricingUrl(appHandle)} target="_top">
              Manage plan
            </s-link>
          </s-stack>
        </s-section>

        <s-button type="submit" variant="primary" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save settings"}
        </s-button>
      </fetcher.Form>
    </s-page>
  );
}
