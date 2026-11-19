import { describe, it, expect } from "vitest";
import { getDb } from "../db.server";
import { getShopify } from "../shopify.server";
import type { ServerEnv } from "../lib/server-env";

// Interleaved isolation: B constructs its clients while A is suspended. Each
// flow's captured handle must differ from the other's, and re-fetching A's
// env after eviction must rebuild (never return B's client). Sequential-only
// calls would pass despite a module-global bleed bug, so the barrier overlap
// is the oracle.
describe("env isolation across overlapping requests", () => {
  const envA: ServerEnv = {
    DATABASE_URL: "postgresql://a:a@localhost/a",
    SHOPIFY_API_KEY: "key-a",
    SHOPIFY_API_SECRET: "secret-a",
    SHOPIFY_APP_URL: "https://a.test",
  };
  const envB: ServerEnv = {
    DATABASE_URL: "postgresql://b:b@localhost/b",
    SHOPIFY_API_KEY: "key-b",
    SHOPIFY_API_SECRET: "secret-b",
    SHOPIFY_APP_URL: "https://b.test",
  };

  it("isolates db clients across interleaved flows", async () => {
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const flowA = (async () => {
      const before = getDb(envA.DATABASE_URL);
      await barrier;
      return before;
    })();
    const flowB = (async () => {
      const b = getDb(envB.DATABASE_URL);
      release();
      return b;
    })();
    const [a, b] = await Promise.all([flowA, flowB]);
    expect(a).not.toBe(b);
    expect(getDb(envA.DATABASE_URL)).not.toBe(b);
  });

  it("isolates shopify apps across interleaved flows", async () => {
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const flowA = (async () => {
      const before = getShopify(envA);
      await barrier;
      return before;
    })();
    const flowB = (async () => {
      const b = getShopify(envB);
      release();
      return b;
    })();
    const [a, b] = await Promise.all([flowA, flowB]);
    expect(a).not.toBe(b);
    expect(getShopify(envA)).not.toBe(b);
  });

  it("reuses the cached client for identical env", () => {
    expect(getDb(envA.DATABASE_URL)).toBe(getDb(envA.DATABASE_URL));
    expect(getShopify(envA)).toBe(getShopify(envA));
  });

  it("keys adjacent-field collisions differently", () => {
    const left: ServerEnv = {
      ...envA,
      SHOPIFY_API_KEY: "ab",
      SHOPIFY_API_SECRET: "c",
    };
    const right: ServerEnv = {
      ...envA,
      SHOPIFY_API_KEY: "a",
      SHOPIFY_API_SECRET: "bc",
    };
    // Would collide under separator-less join ("ab"+"c" === "a"+"bc").
    expect(getShopify(left)).not.toBe(getShopify(right));
  });
});
