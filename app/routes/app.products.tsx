import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { getShopify } from "../shopify.server";
import { getDb } from "../db.server";
import { envFromContext } from "../lib/server-env";
import { priceSnapshots, shops } from "../db/schema";
import { desc, eq } from "drizzle-orm";
import { getPlanCapabilities } from "../services/plan-enforcer.server";
import type { Plan } from "../services/plan-enforcer.server";
import { euPriorPrice } from "../lib/pricing";

interface TrackedProduct {
  productId: string;
  snapshotCount: number;
  lastPriceMinor: number | null;
  currency: string;
  lastCapturedAt: string | null;
  prior30dMinor: number | null;
}

interface LoaderData {
  products: TrackedProduct[];
  canExport: boolean;
  plan: Plan;
}

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const env = envFromContext(context);
  const { authenticate } = getShopify(env);
  const { session } = await authenticate.admin(request);
  const dbClient = getDb(env.DATABASE_URL);

  const shopRecord = await dbClient.query.shops.findFirst({
    where: eq(shops.domain, session.shop),
  });
  const plan = ((shopRecord?.plan ?? "free") as Plan) ?? "free";
  const canExport = getPlanCapabilities(plan).exportCsv;

  if (!shopRecord) {
    return { products: [], canExport, plan } satisfies LoaderData;
  }

  const rows = await dbClient.query.priceSnapshots.findMany({
    where: eq(priceSnapshots.shopId, shopRecord.id),
    orderBy: [desc(priceSnapshots.capturedAt)],
    limit: 5000,
  });

  const byProduct = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byProduct.get(r.productId) ?? [];
    list.push(r);
    byProduct.set(r.productId, list);
  }

  const products: TrackedProduct[] = [...byProduct.entries()].map(
    ([productId, list]) => {
      const latest = list[0]!;
      const prior = euPriorPrice(
        list.map((r) => ({
          priceMinor: r.priceMinor,
          capturedAt: r.capturedAt,
          market: r.market,
          currency: r.currency,
        })),
      );
      return {
        productId,
        snapshotCount: list.length,
        lastPriceMinor: latest.priceMinor,
        currency: latest.currency,
        lastCapturedAt: latest.capturedAt.toISOString(),
        prior30dMinor: prior.lowestMinor,
      };
    },
  );

  return { products, canExport, plan } satisfies LoaderData;
};

function formatMinor(minor: number | null, currency: string): string {
  if (minor === null) return "—";
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

export default function Products() {
  const { products, canExport } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Tracked products">
      <s-section>
        <s-stack direction="block" gap="base">
          <s-text color="subdued">
            {products.length} product(s) with recorded price history. History is
            captured automatically from product webhooks plus a daily snapshot.
          </s-text>
          {canExport ? (
            <s-stack direction="inline" gap="base">
              <s-link href="/api/export?format=csv" target="_blank">
                Export CSV
              </s-link>
              <s-link href="/api/export?format=pdf" target="_blank">
                Export PDF
              </s-link>
            </s-stack>
          ) : (
            <s-text color="subdued">
              CSV/PDF evidence export is available on the Standard plan and up.
            </s-text>
          )}
        </s-stack>
      </s-section>

      <s-section heading="History">
        <s-table>
          <s-table-header-row>
            <s-table-header>Product</s-table-header>
            <s-table-header>Snapshots</s-table-header>
            <s-table-header>Last price</s-table-header>
            <s-table-header>Lowest (30d)</s-table-header>
            <s-table-header>Last seen</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {products.map((p) => (
              <s-table-row key={p.productId}>
                <s-table-cell>{p.productId}</s-table-cell>
                <s-table-cell>{String(p.snapshotCount)}</s-table-cell>
                <s-table-cell>
                  {formatMinor(p.lastPriceMinor, p.currency)}
                </s-table-cell>
                <s-table-cell>
                  {formatMinor(p.prior30dMinor, p.currency)}
                </s-table-cell>
                <s-table-cell>{p.lastCapturedAt ?? "—"}</s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
        {products.length === 0 && (
          <s-text color="subdued">
            No history yet — edit a product price to record the first snapshot.
          </s-text>
        )}
      </s-section>
    </s-page>
  );
}
