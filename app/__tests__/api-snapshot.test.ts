import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ActionFunctionArgs } from "react-router";

const makeArgs = (request: Request) =>
  ({ request, params: {}, context: {} }) as unknown as ActionFunctionArgs;

vi.mock("../shopify.server", () => ({
  unauthenticated: {
    admin: vi.fn(),
  },
}));

vi.mock("../services/snapshot.server", () => ({
  runSnapshotForAllShops: vi.fn(),
}));

const SECRET = "test-cron-secret-0123456789";
let previousSecret: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = SECRET;
});

afterEach(() => {
  if (previousSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previousSecret;
});

function post(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, { method: "POST", ...init });
}

describe("POST /api/snapshot", () => {
  it("fails closed when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const { action } = await import("../routes/api.snapshot");
    const response = await action(makeArgs(post("/api/snapshot")));

    expect(response.status).toBe(500);
  });

  it("rejects missing or wrong bearer tokens", async () => {
    const { action } = await import("../routes/api.snapshot");

    const missing = await action(makeArgs(post("/api/snapshot")));
    expect(missing.status).toBe(401);

    const wrong = await action(
      makeArgs(
        post("/api/snapshot", {
          headers: { authorization: "Bearer wrong-secret-value-here" },
        }),
      ),
    );
    expect(wrong.status).toBe(401);

    const { runSnapshotForAllShops } = await import(
      "../services/snapshot.server"
    );
    expect(runSnapshotForAllShops).not.toHaveBeenCalled();
  });

  it("runs the snapshot for all shops on a valid token", async () => {
    const { runSnapshotForAllShops } = await import(
      "../services/snapshot.server"
    );
    vi.mocked(runSnapshotForAllShops).mockImplementation(async (getAdmin) => {
      // Exercise the injected admin lookup: ok, null, throw.
      const { unauthenticated } = await import("../shopify.server");
      vi.mocked(unauthenticated.admin)
        .mockResolvedValueOnce({ admin: { graphql: vi.fn() } } as never)
        .mockResolvedValueOnce({ admin: null } as never)
        .mockRejectedValueOnce(new Error("boom"));
      const ok = await getAdmin("a.myshopify.com");
      const none = await getAdmin("b.myshopify.com");
      const failed = await getAdmin("c.myshopify.com");
      expect(ok).not.toBeNull();
      expect(none).toBeNull();
      expect(failed).toBeNull();
      return {
        shops: 3,
        productsSeen: 12,
        recorded: 2,
        results: [
          {
            shop: "a.myshopify.com",
            productsSeen: 12,
            recorded: 2,
            skippedUnchanged: 10,
            metafieldsWritten: 4,
            autoCleared: 0,
            errors: [],
          },
        ],
      };
    });

    const { action } = await import("../routes/api.snapshot");
    const response = await action(
      makeArgs(
        post("/api/snapshot", {
          headers: { authorization: `Bearer ${SECRET}` },
        }),
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      shops: number;
      productsSeen: number;
      recorded: number;
      results: Array<{ shop: string; errors: string[] }>;
    };
    expect(body).toMatchObject({ shops: 3, productsSeen: 12, recorded: 2 });
    expect(body.results[0]).toMatchObject({
      shop: "a.myshopify.com",
      errors: [],
    });
  });
});
