import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy - PriceAnchor" },
    { name: "description", content: "PriceAnchor privacy policy - how we handle your data." },
  ];
};

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#1a1a1a", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#666", marginBottom: 8 }}>Last updated: November 19, 2026</p>

      <p>
        PriceAnchor (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) operates the PriceAnchor Shopify application. This Privacy
        Policy explains what data we collect from merchants who install our app, how we use it, and
        your rights regarding that data.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>1. Data We Collect</h2>
      <p>When you install PriceAnchor, we access and store the following data from your Shopify store:</p>
      <ul>
        <li><strong>Store information:</strong> Your store domain name, installed plan tier, and display preferences.</li>
        <li><strong>Product data:</strong> Product and variant identifiers and price snapshots, read only to build per-market price history for Omnibus compliance.</li>
        <li><strong>Lowest-price metafields:</strong> Computed prior/lowest prices are stored as app-owned metafields on your own products so the storefront block can render them — never customer data.</li>
      </ul>
      <p>
        <strong>We do not collect any customer data.</strong> PriceAnchor does not access, store, or
        process any data about your store&apos;s customers, including personal information, order history,
        or browsing behavior. Storefront unit-price math runs entirely in the shopper&apos;s browser.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>2. How We Use Your Data</h2>
      <p>We use the data collected solely to provide PriceAnchor&apos;s functionality:</p>
      <ul>
        <li>Building per-market price history for your products and variants.</li>
        <li>Saving nominal quantities to your products&apos; metafields via the Shopify Admin API.</li>
        <li>Enforcing plan limits and displaying plan status in the admin dashboard.</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>3. Data Storage and Security</h2>
      <p>
        Your data is stored in encrypted databases hosted on <strong>Amazon Web Services (AWS)</strong> in
        the <strong>us-east-1</strong> region and <strong>Neon PostgreSQL</strong> (cloud-hosted PostgreSQL).
        All data is transmitted over HTTPS/TLS. Shopify session tokens are stored in our database
        via Shopify&apos;s official session storage library and are used only to authenticate API calls on your store&apos;s behalf.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>4. Data Sharing</h2>
      <p>
        <strong>We do not sell, rent, or share your data with any third parties.</strong> Your data is
        only processed by our infrastructure providers (AWS, Neon) as necessary to operate the service.
        These providers act as data processors under our direction and are bound by their own privacy
        and security commitments.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>5. Data Retention</h2>
      <ul>
        <li><strong>While installed:</strong> Store settings and plan state are retained for the duration of your app subscription.</li>
        <li><strong>After uninstall:</strong> All data associated with your store is automatically deleted once Shopify sends the data-erasure request following app uninstallation, in compliance with Shopify&apos;s data protection requirements. App-owned lowest-price metafields remain on your products until you remove them.</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>6. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li><strong>Access:</strong> Request a copy of all data we hold about your store.</li>
        <li><strong>Correction:</strong> Request correction of inaccurate data.</li>
        <li><strong>Deletion:</strong> Request deletion of your data at any time. Uninstalling the app also triggers automatic deletion.</li>
        <li><strong>Portability:</strong> Request your data in a machine-readable format.</li>
      </ul>
      <p>
        These rights apply under GDPR (for EU/EEA merchants), CCPA/CPRA (for California merchants),
        and similar data protection laws worldwide.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>7. Cookies and Tracking</h2>
      <p>
        PriceAnchor does not use cookies, analytics trackers, or any third-party tracking technologies.
        The embedded admin dashboard uses Shopify&apos;s session token authentication, which does not rely
        on third-party cookies.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>8. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Changes will be reflected on this page
        with an updated &ldquo;Last updated&rdquo; date. Continued use of PriceAnchor after changes constitutes
        acceptance of the revised policy.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>9. Contact Us</h2>
      <p>
        For privacy inquiries, data requests, or questions about this policy, contact us at:
      </p>
      <p style={{ marginTop: 8 }}>
        <strong>Email:</strong>{" "}
        <a href="mailto:privacy@priceanchor.example.com" style={{ color: "#2563eb" }}>privacy@priceanchor.example.com</a>
      </p>

      <footer style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #e5e5e5", color: "#999", fontSize: 14 }}>
        <p>PriceAnchor — Market-adaptive unit pricing for EU & US stores.</p>
      </footer>
    </div>
  );
}
