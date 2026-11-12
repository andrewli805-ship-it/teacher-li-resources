import * as XLSX from "xlsx";
import { A4_HEIGHT, A4_WIDTH } from "../types";
import { measureHtmlSize, wrapHtmlPage } from "./htmlPage";
import type { ImportedDocument, ProgressFn } from "./types";

const MAX_ROWS_PER_PAGE = 60;

export async function importExcel(
  file: File,
  onProgress?: ProgressFn,
): Promise<ImportedDocument> {
  onProgress?.(0, 1, "正在讀取試算表…");
  const data = new Uint8Array(await file.arrayBuffer());
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const sheetNames = workbook.SheetNames;
  if (!sheetNames.length) throw new Error("此試算表沒有工作表。");

  const pages = [];
  let done = 0;
  const totalEstimate = Math.max(1, sheetNames.length);

  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(
      sheet,
      {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
      },
    );
    const chunks = chunkRows(normalizeRows(rows), MAX_ROWS_PER_PAGE);
    const parts = Math.max(1, chunks.length);
    for (let i = 0; i < parts; i++) {
      done += 1;
      onProgress?.(done, Math.max(totalEstimate, done), `正在匯入工作表「${name}」…`);
      const html = sheetToHtml(name, chunks[i] ?? [[]], i, parts);
      const minWidth = Math.max(A4_WIDTH, estimateTableWidth(chunks[i] ?? [[]]));
      const size = measureHtmlSize(html, minWidth, A4_HEIGHT);
      const label = parts > 1 ? `${name}（${i + 1}）` : name;
      pages.push({
        width: size.width,
        height: size.height,
        backgroundKind: "html" as const,
        label,
        html,
      });
    }
  }

  return {
    sourceType: "excel",
    sourceName: file.name,
    pages,
  };
}

function normalizeRows(
  rows: (string | number | boolean | Date | null)[][],
): string[][] {
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  if (width === 0) return [[""]];
  return rows.map((row) => {
    const cells = Array.from({ length: width }, (_, i) => stringify(row[i]));
    return cells;
  });
}

function stringify(value: string | number | boolean | Date | null | undefined): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("zh-Hant-HK", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Hong_Kong",
    }).format(value);
  }
  return String(value);
}

function chunkRows(rows: string[][], size: number): string[][][] {
  if (rows.length <= size) return [rows];
  const chunks: string[][][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

function estimateTableWidth(rows: string[][]): number {
  const cols = rows[0]?.length ?? 1;
  return Math.min(1600, Math.max(A4_WIDTH, 64 + cols * 96));
}

function sheetToHtml(
  title: string,
  rows: string[][],
  part: number,
  parts: number,
): string {
  const subtitle = parts > 1 ? `（第 ${part + 1} / ${parts} 段）` : "";
  const cols = Math.max(1, rows[0]?.length ?? 1);
  const letters = Array.from({ length: cols }, (_, i) => colLetter(i));
  const head = letters.map((l) => `<th>${escapeHtml(l)}</th>`).join("");
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((cell) => `<td>${escapeHtml(cell)}</td>`)
        .join("");
      return `<tr><th class="rn">${r + 1 + part * MAX_ROWS_PER_PAGE}</th>${cells}</tr>`;
    })
    .join("");
  const inner = `
    <h2 class="sheet-title">${escapeHtml(title)}${subtitle}</h2>
    <div class="sheet-wrap">
      <table class="sheet-table">
        <thead><tr><th></th>${head}</tr></thead>
        <tbody>${body || `<tr><th class="rn">1</th><td></td></tr>`}</tbody>
      </table>
    </div>
  `;
  const width = estimateTableWidth(rows);
  return wrapHtmlPage(inner, width, 28);
}

function colLetter(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
