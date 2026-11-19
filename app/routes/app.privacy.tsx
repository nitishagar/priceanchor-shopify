export default function PrivacyPolicyPage() {
  return (
    <s-page heading="Privacy Policy">
      <s-section>
        <s-paragraph>
          PriceAnchor (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is committed to protecting your privacy.
          This policy explains what data we collect, how we use it, and your rights.
        </s-paragraph>
        <s-paragraph>
          <s-text type="strong">Data We Collect:</s-text> Store domain, plan tier, display
          preferences, and product identifiers with price snapshots needed for Omnibus
          prior-price tracking. Computed lowest prices are stored as metafields on your
          own products.
        </s-paragraph>
        <s-paragraph>
          <s-text type="strong">How We Use It:</s-text> To record price history, render the
          lowest-price block, flag stale compare-at anchors, and enforce plan limits.
          No customer data is ever collected.
        </s-paragraph>
        <s-paragraph>
          <s-text type="strong">Data Storage:</s-text> Data is stored securely in encrypted
          databases hosted on Cloudflare Workers. We do not sell or share your data with third parties.
        </s-paragraph>
        <s-paragraph>
          <s-text type="strong">Data Retention:</s-text> Store settings are retained
          while your app subscription is active. All data is automatically deleted once Shopify sends the data-erasure request following app uninstallation.
        </s-paragraph>
        <s-paragraph>
          <s-text type="strong">Your Rights:</s-text> You may request data export or deletion
          at any time by contacting us. Uninstalling the app triggers automatic data deletion.
        </s-paragraph>
        <s-paragraph>
          <s-text type="strong">Contact:</s-text> For privacy inquiries, email
          privacy@applair.in.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
