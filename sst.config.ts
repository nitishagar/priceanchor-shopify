/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "priceanchor",
      home: "aws",
      providers: {
        aws: {
          region: "us-east-1",
          defaultTags: {
            tags: {
              project: "priceanchor",
              stage: input.stage,
              "managed-by": "sst",
            },
          },
        },
      },
      removal: input.stage === "production" ? "retain" : "remove",
    };
  },
  async run() {
    // No dedicated app domain: SST serves the backend from its generated
    // CloudFront URL (copied into shopify.app.toml after first deploy — see
    // docs/SUBMISSION.md). Marketing/privacy/support are served by this app
    // (/privacy, /support, /pricing) on the app domain.
    const app = new sst.aws.React("PriceAnchor", {
      server: {
        memory: "256 MB",
        architecture: "arm64",
        timeout: "20 seconds",
      },
      environment: {
        DATABASE_URL: process.env.DATABASE_URL!,
        SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ?? "",
        SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET ?? "",
        SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL ?? "",
        SCOPES: "read_products,write_products",
        CRON_SECRET: process.env.CRON_SECRET ?? "",
      },
    });
    return { url: app.url };
  },
});
