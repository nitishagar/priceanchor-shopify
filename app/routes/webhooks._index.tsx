import type { ActionFunctionArgs } from "react-router";
import { eq } from "drizzle-orm";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { priceSnapshots, shops, sessionTable } from "../db/schema";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
    case "customers/data_request":
      return new Response(null, { status: 200 });

    case "CUSTOMERS_REDACT":
    case "customers/redact":
      return new Response(null, { status: 200 });

    case "SHOP_REDACT":
    case "shop/redact": {
      const shopRecord = await db.query.shops.findFirst({
        where: eq(shops.domain, shop),
      });

      if (shopRecord) {
        await db.transaction(async (tx) => {
          await tx
            .delete(priceSnapshots)
            .where(eq(priceSnapshots.shopId, shopRecord.id));
          await tx.delete(sessionTable).where(eq(sessionTable.shop, shop));
          await tx.delete(shops).where(eq(shops.id, shopRecord.id));
        });
        console.log(`Erased all data for shop ${shop} (id: ${shopRecord.id})`);
      }

      return new Response(null, { status: 200 });
    }

    default:
      console.warn(`Unhandled compliance topic: ${topic}`);
      return new Response(null, { status: 404 });
  }
};
