import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { shops } from "../db/schema";
import { eq } from "drizzle-orm";
import { getPlanLimits } from "../services/plan-enforcer.server";
import type { Plan } from "../services/plan-enforcer.server";
import { managedPricingUrl } from "../services/billing/managed-pricing";

interface LoaderData {
  shopPlan: Plan;
  trackedCount: number;
  productLimit: number;
  setupDone: boolean;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const shopRecord = await db.query.shops.findFirst({
      where: eq(shops.domain, session.shop),
    });

    const plan = ((shopRecord?.plan ?? "free") as Plan) ?? "free";
    const limits = getPlanLimits(plan);
    const trackedCount = shopRecord?.trackedCount ?? 0;

    const data: LoaderData = {
      shopPlan: plan,
      trackedCount,
      productLimit: limits.productLimit,
      setupDone: trackedCount > 0,
    };
    return data;
  } catch {
    const data: LoaderData = {
      shopPlan: "free",
      trackedCount: 0,
      productLimit: 25,
      setupDone: false,
    };
    return data;
  }
};

export default function Dashboard() {
  const { shopPlan, trackedCount, productLimit, setupDone } =
    useLoaderData<typeof loader>();
  const limitLabel = productLimit === Infinity ? "Unlimited" : String(productLimit);

  return (
    <s-page heading="PriceAnchor Dashboard">
      {!setupDone && (
        <s-banner tone="warning" heading="Finish setup in 2 steps">
          Edit a product price (or wait for the daily snapshot) so PriceAnchor
          starts recording history, then add the “Lowest price” block to your
          product template in the theme editor.
        </s-banner>
      )}

      <s-section heading="Overview">
        <s-grid
          grid-template-columns="repeat(auto-fit, minmax(200px, 1fr))"
          gap="base"
        >
          <s-box padding="base" background="subdued" border-radius="base">
            <s-stack direction="block" gap="base">
              <s-text color="subdued">Tracked products</s-text>
              <s-heading>
                {String(trackedCount)} / {limitLabel}
              </s-heading>
              <s-text color="subdued">products with price history</s-text>
            </s-stack>
          </s-box>
          <s-box padding="base" background="subdued" border-radius="base">
            <s-stack direction="block" gap="base">
              <s-text color="subdued">Current plan</s-text>
              <s-heading>
                {shopPlan.charAt(0).toUpperCase() + shopPlan.slice(1)}
              </s-heading>
              <s-link href={managedPricingUrl()} target="_top">
                Manage plan
              </s-link>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      <s-section heading="Setup checklist">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base" align-items="center">
            <s-badge tone={trackedCount > 0 ? "success" : "warning"}>
              {trackedCount > 0 ? "Done" : "To do"}
            </s-badge>
            <s-text>
              Price history is captured automatically from product webhooks.
              Review tracked products on the{" "}
              <s-link href="/app/products">Products</s-link> page.
            </s-text>
          </s-stack>
          <s-stack direction="inline" gap="base" align-items="center">
            <s-badge tone="info">Theme editor</s-badge>
            <s-text>
              Add the “Lowest price” app block to your product template so
              shoppers see the statutory lowest price of the last 30 days
              (EU Omnibus) next to every reduction.
            </s-text>
          </s-stack>
          <s-link
            href="shopify://admin/themes/current/editor?template=product"
            target="_top"
          >
            Open theme editor
          </s-link>
        </s-stack>
      </s-section>

      <s-section heading="How PriceAnchor keeps you compliant">
        <s-stack direction="block" gap="base">
          <s-text>
            Every price change is recorded per variant and per market. The EU
            prior price is the lowest price of the last 30 days, and the “% off”
            figure is computed from that prior price — never from the live
            compare-at price. The stale-sale guard flags compare-at anchors
            older than 90 days for review or auto-clear.
          </s-text>
          <s-text color="subdued">
            Export your full price history as CSV or PDF evidence from the
            Products page (Standard plan and up).
          </s-text>
        </s-stack>
      </s-section>
    </s-page>
  );
}
