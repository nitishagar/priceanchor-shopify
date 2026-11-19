// Minimal structural type for Shopify Admin GraphQL clients, shared by
// billing sync, spec sync, and webhook handlers (avoids service coupling).
export interface AdminGraphQLClient {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<{ json: () => Promise<unknown> }>;
}
