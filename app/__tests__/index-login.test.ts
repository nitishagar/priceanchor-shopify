import { describe, it, expect, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";
import { testContext } from "./helpers/test-env";

const mockLogin = vi.hoisted(() => vi.fn());

vi.mock("../shopify.server", () => ({
  getShopify: () => ({
    login: mockLogin,
  }),
}));

describe("index loader", () => {
  it("redirects to /app preserving shop params", async () => {
    const { loader } = await import("../routes/_index");
    const request = new Request(
      "http://localhost/?shop=test.myshopify.com&host=abc",
    );
    await expect(
      loader({ request, params: {}, context: testContext() } as unknown as ActionFunctionArgs),
    ).rejects.toMatchObject({
      status: 302,
      headers: expect.anything(),
    });
  });

  it("renders the landing when no shop param", async () => {
    const { loader } = await import("../routes/_index");
    const data = (await loader({
      request: new Request("http://localhost/"),
      params: {},
      context: testContext(),
    } as unknown as ActionFunctionArgs)) as { showForm: boolean };
    expect(data.showForm).toBe(true);
  });
});

describe("auth.login action", () => {
  it("maps a missing shop to a message", async () => {
    mockLogin.mockResolvedValue({ shop: "MISSING_SHOP" });
    const { action } = await import("../routes/auth.login");
    const body = new URLSearchParams();
    const data = (await action({
      request: new Request("http://localhost/auth/login", {
        method: "POST",
        body,
      }),
      params: {},
      context: testContext(),
    } as unknown as ActionFunctionArgs)) as { errors: { shop?: string } };
    expect(data.errors.shop).toMatch(/shop domain/i);
  });
});
