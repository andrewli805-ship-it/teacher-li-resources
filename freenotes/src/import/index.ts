import { importExcel } from "./excel";
import { importPdf } from "./pdf";
import type { ImportedDocument, ProgressFn } from "./types";
import { importWord } from "./word";

const PDF = /\.pdf$/i;
const DOCX = /\.docx$/i;
const DOC = /\.doc$/i;
const EXCEL = /\.(xlsx|xls)$/i;

export function describeImportError(file: File, error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return `無法匯入「${file.name}」。`;
}

export async function importFile(
  file: File,
  onProgress?: ProgressFn,
): Promise<ImportedDocument> {
  const name = file.name;
  if (PDF.test(name) || file.type === "application/pdf") {
    return importPdf(file, onProgress);
  }
  if (DOCX.test(name) || isDocx(file)) {
    return importWord(file, onProgress);
  }
  if (DOC.test(name)) {
    return importWord(file, onProgress);
  }
  if (EXCEL.test(name) || isExcel(file)) {
    return importExcel(file, onProgress);
  }
  throw new Error("僅支援 PDF、Word（.docx）與 Excel（.xls / .xlsx）檔案。");
}

function isDocx(file: File): boolean {
  return file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function isExcel(file: File): boolean {
  return (
    file.type === "application/vnd.ms-excel" ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

export type { ImportedDocument, ProgressFn } from "./types";
