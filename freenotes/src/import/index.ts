import { importExcel } from "./excel";
import { detectImportKind } from "./kind";
import { importPdf } from "./pdf";
import type { ImportedDocument, ProgressFn } from "./types";
import { importWord } from "./word";

export function describeImportError(file: File, error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return `無法匯入「${file.name}」。`;
}

export async function importFile(
  file: File,
  onProgress?: ProgressFn,
): Promise<ImportedDocument> {
  const kind = await detectImportKind(file);
  if (kind === "pdf") return importPdf(file, onProgress);
  if (kind === "docx" || kind === "doc") return importWord(file, onProgress);
  if (kind === "excel") return importExcel(file, onProgress);
  throw new Error("僅支援 PDF、Word（.docx）與 Excel（.xls / .xlsx）檔案。");
}

export type { ImportedDocument, ProgressFn } from "./types";
