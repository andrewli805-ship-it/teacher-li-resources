import mammoth from "mammoth";
import { A4_HEIGHT, A4_WIDTH } from "../types";
import { measureHtmlSize, paginateHtml } from "./htmlPage";
import type { ImportedDocument, ProgressFn } from "./types";

export async function importWord(
  file: File,
  onProgress?: ProgressFn,
): Promise<ImportedDocument> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".doc") && !name.endsWith(".docx")) {
    throw new Error("暫不支援舊版 .doc 檔，請先在 Word 另存為 .docx 後再匯入。");
  }
  onProgress?.(0, 1, "正在轉換 Word 文件…");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const htmlPages = paginateHtml(result.value, A4_WIDTH, A4_HEIGHT, 48);
  const pages = htmlPages.map((html, i) => {
    const size = measureHtmlSize(html, A4_WIDTH, A4_HEIGHT);
    return {
      width: size.width,
      height: size.height,
      backgroundKind: "html" as const,
      label: `第 ${i + 1} 頁`,
      html,
    };
  });
  onProgress?.(pages.length, pages.length, "Word 文件已轉換。");
  return {
    sourceType: "word",
    sourceName: file.name,
    pages,
  };
}
