import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Support - PriceAnchor" },
    { name: "description", content: "Get help with PriceAnchor - FAQs, troubleshooting, and contact support." },
  ];
};

export default function Support() {
  const linkStyle = { color: "#2563eb", textDecoration: "none" };
  const h2Style = { fontSize: 20, marginTop: 32 };
  const h3Style = { fontSize: 16, marginTop: 20, marginBottom: 4 };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#1a1a1a", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>PriceAnchor Support</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>
        Need help? Find answers below or reach out to us directly.
      </p>

      <h2 style={h2Style}>Getting Started</h2>
      <p>
        After installing PriceAnchor, let history accumulate and add the storefront block:
      </p>
      <ol>
        <li>Wait for the first price snapshots — history is captured automatically from product webhooks plus a daily snapshot</li>
        <li>Go to <strong>Online Store &gt; Themes &gt; Customize</strong>, open the product template</li>
        <li>Click <strong>Add block &gt; Apps &gt; Lowest price</strong> and click <strong>Save</strong></li>
      </ol>
      <p>
        Shoppers will see the statutory lowest price of the last 30 days next to every
        reduction, with the “% off” computed from that prior price — never from the live
        compare-at price.
      </p>

      <h2 style={h2Style}>Frequently Asked Questions</h2>

      <h3 style={h3Style}>Which prior price does PriceAnchor show?</h3>
      <p>
        The EU Omnibus prior price: the lowest price applied in the 30 days before the
        reduction (Art 6a, Directive 2019/2161), tracked separately per market and
        currency. The “% off” figure is computed from that same prior price (Aldi rule).
      </p>

      <h3 style={h3Style}>Do price changes update automatically?</h3>
      <p>
        Yes. Every price change is captured in real time from product webhooks, with a
        daily snapshot as backup — no re-sync needed.
      </p>

      <h3 style={h3Style}>What is the stale-sale guard?</h3>
      <p>
        Shopify never expires compare-at prices on its own. The guard flags compare-at
        anchors older than your thresholds (default 60/75/90 days) and can auto-clear
        stale ones so old anchors stop showing a sale label.
      </p>

      <h3 style={h3Style}>Which themes are supported?</h3>
      <p>
        PriceAnchor works with all Shopify OS 2.0 themes, including Dawn and most modern themes.
        Legacy themes (vintage) are not supported.
      </p>

      <h3 style={h3Style}>What are the plan limits?</h3>
      <ul>
        <li><strong>Free:</strong> Up to 25 tracked products</li>
        <li><strong>Standard ($3.99/mo):</strong> Up to 250 tracked products, CSV/PDF export, stale-sale guard</li>
        <li><strong>Unlimited ($5.99/mo):</strong> Unlimited tracked products, CSV/PDF export, stale-sale guard, priority support</li>
      </ul>

      <h2 style={h2Style}>Troubleshooting</h2>

      <h3 style={h3Style}>Lowest price is not appearing</h3>
      <ul>
        <li>Ensure the <strong>Lowest price</strong> app block is added to your product template</li>
        <li>Verify the product has recorded history on the <strong>Products</strong> page (new installs need a first snapshot)</li>
        <li>Verify you are using an OS 2.0 theme (Dawn or similar)</li>
        <li>Hard-refresh the storefront to clear cached theme assets</li>
      </ul>

      <h3 style={h3Style}>Stale sale label won&apos;t go away</h3>
      <ul>
        <li>Open <strong>PriceAnchor &gt; Settings</strong> and check your stale-sale guard thresholds</li>
        <li>Enable auto-clear, or clear the compare-at price on the variant in Shopify admin</li>
      </ul>

      <h2 style={h2Style}>Contact Us</h2>
      <p>
        If you need further assistance, reach out to us:
      </p>
      <ul>
        <li>
          <strong>Email:</strong>{" "}
          <a href="mailto:support@applair.in" style={linkStyle}>support@applair.in</a>
        </li>
        <li>
          <strong>GitHub:</strong>{" "}
          <a href="https://github.com/nitishagar/priceanchor-shopify/issues" style={linkStyle} target="_blank" rel="noopener noreferrer">
            Report an issue
          </a>
        </li>
      </ul>
      <p>We typically respond within 24 hours on business days.</p>

      <footer style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #e5e5e5", color: "#999", fontSize: 14 }}>
        <p>
          PriceAnchor — Omnibus-ready lowest-price tracking for EU & US stores.
          {" | "}
          <a href="/privacy" style={{ color: "#999" }}>Privacy Policy</a>
        </p>
      </footer>
    </div>
  );
}
