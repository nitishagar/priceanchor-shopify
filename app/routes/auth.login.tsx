import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";

import { LoginErrorType } from "@shopify/shopify-app-react-router/server";
import { getShopify } from "../shopify.server";
import { envFromContext } from "../lib/server-env";

function toMessage(errors: { shop?: LoginErrorType }): { shop?: string } {
  if (!errors.shop) return {};
  if (errors.shop === LoginErrorType.MissingShop)
    return { shop: "Enter your shop domain" };
  if (errors.shop === LoginErrorType.InvalidShop)
    return { shop: "Enter a valid .myshopify.com domain" };
  return { shop: "Something went wrong — try again" };
}

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const env = envFromContext(context);
  const { login } = getShopify(env);
  const errors = toMessage(await login(request));

  return { errors };
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const env = envFromContext(context);
  const { login } = getShopify(env);
  const errors = toMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;

  return (
    <AppProvider embedded={false}>
      <s-page>
        <Form method="post">
        <s-section heading="Log in">
          <s-text-field
            name="shop"
            label="Shop domain"
            details="example.myshopify.com"
            value={shop}
            onChange={(e) => setShop(e.currentTarget.value)}
            autocomplete="on"
            error={errors.shop}
          ></s-text-field>
          <s-button type="submit">Log in</s-button>
        </s-section>
        </Form>
      </s-page>
    </AppProvider>
  );
}
