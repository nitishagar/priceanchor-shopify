import { describe, it, expect } from "vitest";
import {
  EXPORT_COLUMNS,
  formatMoney,
  rowsToCsv,
  rowsToPdf,
  type ExportRow,
} from "../services/export.server";

const row = (over: Partial<ExportRow> = {}): ExportRow => ({
  productId: "p1",
  variantId: "11",
  market: "default",
  currency: "USD",
  priceMinor: 1999,
  compareAtMinor: 2499,
  capturedAt: new Date("2026-11-19T10:00:00.000Z"),
  source: "webhook",
  ...over,
});

describe("formatMoney", () => {
  it("formats minor units with currency", () => {
    expect(formatMoney(1999, "USD")).toBe("19.99 USD");
    expect(formatMoney(2000, "EUR")).toBe("20.00 EUR");
  });

  it("renders null as empty", () => {
    expect(formatMoney(null, "USD")).toBe("");
  });
});

describe("rowsToCsv", () => {
  it("emits a header plus one RFC-4180 line per row", () => {
    const csv = rowsToCsv([row()]);
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(","));
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("p1,11,default,USD,19.99 USD,24.99 USD,2026-11-19T10:00:00.000Z,webhook");
  });

  it("escapes commas, quotes, and newlines in cells", () => {
    const csv = rowsToCsv([row({ market: 'de,"x"\n' })]);
    expect(csv).toContain('"de,""x""\n"');
  });

  it("renders cleared compare-at as an empty cell", () => {
    const csv = rowsToCsv([row({ compareAtMinor: null })]);
    expect(csv.split("\r\n").filter(Boolean)[1]).toContain("19.99 USD,,2026-11-19");
  });

  it("emits only the header for an empty history", () => {
    expect(rowsToCsv([])).toBe(`${EXPORT_COLUMNS.join(",")}\r\n`);
  });
});

describe("rowsToPdf", () => {
  it("produces a well-formed minimal PDF containing the rows", () => {
    const bytes = rowsToPdf([row(), row({ variantId: "12", priceMinor: 999 })]);
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("2 snapshot\\(s\\)");
    expect(text).toContain("p1/11");
    expect(text).toContain("p1/12");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("startxref");
  });

  it("produces a valid empty-history PDF", () => {
    const text = new TextDecoder().decode(rowsToPdf([]));
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("0 snapshot\\(s\\)");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });
});
