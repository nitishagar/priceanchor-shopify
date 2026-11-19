// Price-history export: CSV (RFC 4180) + minimal uncompressed PDF.
// Dependency-free: CSV escaping is hand-rolled and the PDF writer emits a
// tiny valid single/multi-page PDF (Helvetica, 1 table-ish line list) so
// merchants can archive Omnibus evidence without extra packages.

export interface ExportRow {
  productId: string;
  variantId: string;
  market: string;
  currency: string;
  priceMinor: number;
  compareAtMinor: number | null;
  capturedAt: Date;
  source: string;
}

export const EXPORT_COLUMNS = [
  "product_id",
  "variant_id",
  "market",
  "currency",
  "price",
  "compare_at_price",
  "captured_at",
  "source",
] as const;

export function formatMoney(minor: number | null, currency: string): string {
  if (minor === null) return "";
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function rowsToCsv(rows: ExportRow[]): string {
  const lines = [EXPORT_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.productId,
        r.variantId,
        r.market,
        r.currency,
        formatMoney(r.priceMinor, r.currency),
        formatMoney(r.compareAtMinor, r.currency),
        r.capturedAt.toISOString(),
        r.source,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

function pdfEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// Minimal valid PDF: one Helvetica font, fixed line height, automatic page
// breaks. Content is the same rows as CSV, one line per snapshot.
export function rowsToPdf(rows: ExportRow[], title = "PriceAnchor price history"): Uint8Array {
  const bodyLines = rows.map(
    (r) =>
      `${r.capturedAt.toISOString()} ${r.productId}/${r.variantId} ${r.market} ` +
      `${formatMoney(r.priceMinor, r.currency)}` +
      (r.compareAtMinor !== null
        ? ` (was ${formatMoney(r.compareAtMinor, r.currency)})`
        : "") +
      ` [${r.source}]`,
  );
  const header = `${title} — ${rows.length} snapshot(s)`;
  const all = [header, "", ...bodyLines];

  const linesPerPage = 60;
  const lineHeight = 12;
  const topY = 800;
  const pages: string[][] = [];
  for (let i = 0; i < all.length; i += linesPerPage) {
    pages.push(all.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([header]);

  const objects: string[] = [];
  // 1: catalog, 2: pages, 3: font. Page objects + content streams follow.
  const pageObjNums: number[] = [];
  let nextObj = 4;
  for (const page of pages) {
    const content = page
      .map(
        (line, i) =>
          `BT /F1 9 Tf 36 ${topY - i * lineHeight} Td (${pdfEscape(line.slice(0, 140))}) Tj ET`,
      )
      .join("\n");
    const pageObj = nextObj++;
    const contentObj = nextObj++;
    pageObjNums.push(pageObj);
    objects.push(
      `${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObj} 0 R >>\nendobj`,
      `${contentObj} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj`,
    );
  }

  const head = `%PDF-1.4\n`;
  const catalog = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`;
  const kids = pageObjNums.map((n) => `${n} 0 R`).join(" ");
  const pagesObj = `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageObjNums.length} >>\nendobj`;
  const font = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`;
  const parts = [head, catalog, pagesObj, font, ...objects];

  let offset = 0;
  const offsets: number[] = [];
  let pdf = "";
  for (const part of parts) {
    offsets.push(offset);
    pdf += `${part}\n`;
    offset += part.length + 1;
  }
  const xrefAt = offset;
  const count = parts.length + 1;
  pdf += `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (const o of offsets) {
    pdf += `${String(o).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
