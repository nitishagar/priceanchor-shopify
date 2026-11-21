import type { LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: true };
};

const page: React.CSSProperties = {
  fontFamily: "system-ui, -apple-system, sans-serif",
  background: "#0f1115",
  color: "#f4f4f5",
  minHeight: "100vh",
  margin: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "4rem 1.5rem",
};

const card: React.CSSProperties = {
  maxWidth: "640px",
  width: "100%",
  background: "#17191f",
  border: "1px solid #2a2d36",
  borderRadius: "12px",
  padding: "2.5rem",
};

const title: React.CSSProperties = { fontSize: "2rem", margin: "0 0 0.5rem" };

const sub: React.CSSProperties = { color: "#a1a1aa", margin: "0 0 1.5rem" };

const list: React.CSSProperties = {
  paddingLeft: "1.25rem",
  color: "#d4d4d8",
  lineHeight: 1.8,
  margin: "0 0 1.5rem",
};

const form: React.CSSProperties = { display: "flex", gap: "0.5rem" };

const input: React.CSSProperties = {
  flex: 1,
  padding: "0.65rem 0.9rem",
  borderRadius: "8px",
  border: "1px solid #3f3f46",
  background: "#0f1115",
  color: "#f4f4f5",
  fontSize: "1rem",
};

const button: React.CSSProperties = {
  padding: "0.65rem 1.25rem",
  borderRadius: "8px",
  border: "none",
  background: "#5e6ad2",
  color: "#fff",
  fontSize: "1rem",
  cursor: "pointer",
};

export default function Index() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div style={page}>
      <div style={card}>
        <h1 style={title}>PriceAnchor</h1>
        <p style={sub}>
          EU 30-day lowest-price tracking and US 90-day former-price guard for
          every discount you run.
        </p>
        <ul style={list}>
          <li>Statutory 30-day prior price for EU visitors (Omnibus Art 6a)</li>
          <li>§17501-safe &quot;Previously … last offered …&quot; framing for US visitors</li>
          <li>Stale-sale guard with optional auto-clear and CSV/PDF evidence export</li>
        </ul>
        {showForm && (
          <Form style={form} method="post" action="/auth/login">
            <input
              style={input}
              type="text"
              name="shop"
              placeholder="your-store.myshopify.com"
            />
            <button style={button} type="submit">
              Install
            </button>
          </Form>
        )}
      </div>
    </div>
  );
}
