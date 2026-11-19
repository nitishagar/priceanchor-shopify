import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { priceSnapshots, shops } from "../db/schema";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import {
  rowsToCsv,
  rowsToPdf,
  type ExportRow,
} from "../services/export.server";
import {
  getPlanCapabilities,
  type Plan,
} from "../services/plan-enforcer.server";

// GET /api/export?format=csv|pdf&product_id=&from=&to=
// Omnibus evidence export. Standard/Unlimited only (free plan: 403).
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
  const productId = url.searchParams.get("product_id") ?? undefined;
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");

  if (format !== "csv" && format !== "pdf") {
    return Response.json(
      { error: "format must be csv or pdf" },
      { status: 400 },
    );
  }

  const shopRecord = await db.query.shops.findFirst({
    where: eq(shops.domain, session.shop),
  });
  if (!shopRecord) {
    return Response.json({ error: "Shop not found" }, { status: 404 });
  }

  const capabilities = getPlanCapabilities((shopRecord.plan as Plan) ?? "free");
  if (format === "pdf" && !capabilities.exportPdf) {
    return Response.json(
      { error: "PDF export requires the Unlimited plan" },
      { status: 403 },
    );
  }
  if (format === "csv" && !capabilities.exportCsv) {
    return Response.json(
      { error: "CSV export requires the Standard plan or higher" },
      { status: 403 },
    );
  }

  const conditions = [eq(priceSnapshots.shopId, shopRecord.id)];
  if (productId) conditions.push(eq(priceSnapshots.productId, productId));
  if (fromRaw) {
    const from = new Date(fromRaw);
    if (!Number.isNaN(from.getTime())) {
      conditions.push(gte(priceSnapshots.capturedAt, from));
    }
  }
  if (toRaw) {
    const to = new Date(toRaw);
    if (!Number.isNaN(to.getTime())) {
      conditions.push(lte(priceSnapshots.capturedAt, to));
    }
  }

  const rows = await db.query.priceSnapshots.findMany({
    where: and(...conditions),
    orderBy: [desc(priceSnapshots.capturedAt)],
    limit: 10000,
  });

  const exportRows: ExportRow[] = rows.map((r) => ({
    productId: r.productId,
    variantId: r.variantId,
    market: r.market,
    currency: r.currency,
    priceMinor: r.priceMinor,
    compareAtMinor: r.compareAtMinor,
    capturedAt: r.capturedAt,
    source: r.source,
  }));

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "pdf") {
    const pdf = rowsToPdf(exportRows);
    return new Response(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="priceanchor-history-${stamp}.pdf"`,
      },
    });
  }
  return new Response(rowsToCsv(exportRows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="priceanchor-history-${stamp}.csv"`,
    },
  });
};
