import type { CSSProperties } from "react";
import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Pricing - PriceAnchor" },
    { name: "description", content: "PriceAnchor pricing plans - EU Omnibus and California reference-price compliance starting free, scale as you grow." },
  ];
};

const checkIcon = "\u2713";

// Set to the Shopify App Store listing URL when published. While null, install CTAs are hidden.
const APP_STORE_URL: string | null = null;

const installButtonStyle: CSSProperties = {
  display: "inline-block",
  background: "#1a1a2e",
  color: "#fff",
  padding: "14px 32px",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 16,
  marginTop: 16,
};

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
  yearlyMonthly: string;
  badge?: string;
  features: PlanFeature[];
}

const plans: Plan[] = [
  {
    name: "Free",
    monthlyPrice: "$0",
    yearlyPrice: "$0",
    yearlyMonthly: "$0",
    features: [
      { text: "Up to 25 tracked products", included: true },
      { text: "30-day lowest-price tracking", included: true },
      { text: "Per-market price history", included: true },
      { text: "Lowest-price theme block", included: true },
      { text: "CSV evidence export", included: false },
      { text: "Stale-sale flagging", included: false },
      { text: "PDF export + auto-clear", included: false },
      { text: "Priority support", included: false },
    ],
  },
  {
    name: "Standard",
    monthlyPrice: "$3.99",
    yearlyPrice: "$40",
    yearlyMonthly: "$3.33",
    badge: "Popular",
    features: [
      { text: "Up to 250 tracked products", included: true },
      { text: "30-day lowest-price tracking", included: true },
      { text: "Per-market price history", included: true },
      { text: "Lowest-price theme block", included: true },
      { text: "CSV evidence export", included: true },
      { text: "Stale-sale flagging", included: true },
      { text: "PDF export + auto-clear", included: false },
      { text: "Priority support", included: false },
    ],
  },
  {
    name: "Unlimited",
    monthlyPrice: "$5.99",
    yearlyPrice: "$60",
    yearlyMonthly: "$5.00",
    features: [
      { text: "Unlimited tracked products", included: true },
      { text: "30-day lowest-price tracking", included: true },
      { text: "Per-market price history", included: true },
      { text: "Lowest-price theme block", included: true },
      { text: "CSV evidence export", included: true },
      { text: "Stale-sale flagging", included: true },
      { text: "PDF export + auto-clear", included: true },
      { text: "Priority support", included: true },
    ],
  },
];

export default function Pricing() {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#1a1a1a", lineHeight: 1.7 }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>Simple, transparent pricing</h1>
        <p style={{ color: "#666", fontSize: 18, maxWidth: 520, margin: "0 auto" }}>
          Start free. Upgrade as your store grows. All plans include a 7-day free trial.
        </p>
        {APP_STORE_URL && (
          <a href={APP_STORE_URL} style={installButtonStyle}>
            Install on Shopify
          </a>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 24, marginBottom: 48 }}>
        {plans.map((plan) => (
          <div
            key={plan.name}
            style={{
              border: plan.badge ? "2px solid #1a1a2e" : "1px solid #e5e5e5",
              borderRadius: 12,
              padding: 32,
              position: "relative",
              background: "#fff",
            }}
          >
            {plan.badge && (
              <span style={{
                position: "absolute",
                top: -12,
                left: "50%",
                transform: "translateX(-50%)",
                background: "#1a1a2e",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                padding: "4px 16px",
                borderRadius: 20,
                letterSpacing: 0.5,
              }}>
                {plan.badge}
              </span>
            )}

            <h2 style={{ fontSize: 22, marginBottom: 4, marginTop: 0 }}>{plan.name}</h2>

            <div style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 36, fontWeight: 700 }}>{plan.monthlyPrice}</span>
              <span style={{ color: "#666", fontSize: 16 }}>/month</span>
            </div>

            {plan.yearlyPrice !== "$0" && (
              <p style={{ color: "#666", fontSize: 14, margin: "0 0 24px" }}>
                or {plan.yearlyPrice}/year ({plan.yearlyMonthly}/mo)
              </p>
            )}
            {plan.yearlyPrice === "$0" && (
              <p style={{ color: "#666", fontSize: 14, margin: "0 0 24px" }}>
                Free forever
              </p>
            )}

            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {plan.features.filter((f) => f.text).map((feature) => (
                <li
                  key={feature.text}
                  style={{
                    padding: "8px 0",
                    borderTop: "1px solid #f3f4f6",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: feature.included ? "#1a1a1a" : "#ccc",
                  }}
                >
                  <span style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                    background: feature.included ? "#ecfdf5" : "#f9fafb",
                    color: feature.included ? "#059669" : "#ccc",
                  }}>
                    {feature.included ? checkIcon : "\u2014"}
                  </span>
                  {feature.text}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h2 style={{ fontSize: 22, marginBottom: 8 }}>All plans include</h2>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 24, color: "#666" }}>
          {["Webhook price capture", "Aldi-rule % off", "US + EU storefront modes", "OS 2.0 theme support", "No customer data stored"].map((item) => (
            <span key={item} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#059669", fontWeight: 700 }}>{checkIcon}</span> {item}
            </span>
          ))}
        </div>
        {APP_STORE_URL && (
          <div style={{ marginTop: 24 }}>
            <a href={APP_STORE_URL} style={installButtonStyle}>
              Install on Shopify
            </a>
          </div>
        )}
      </div>

      <footer style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #e5e5e5", color: "#999", fontSize: 14, textAlign: "center" }}>
        <p>
          PriceAnchor — Omnibus-ready lowest-price tracking for EU & US stores.
          {" | "}
          <a href="/privacy" style={{ color: "#999" }}>Privacy Policy</a>
          {" | "}
          <a href="/support" style={{ color: "#999" }}>Support</a>
        </p>
      </footer>
    </div>
  );
}
