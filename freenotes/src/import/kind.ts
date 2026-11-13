export const IMPORT_ACCEPT = [
  ".pdf",
  ".docx",
  ".xls",
  ".xlsx",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",");

const PDF_EXT = /\.pdf$/i;
const DOCX_EXT = /\.docx$/i;
const DOC_EXT = /\.doc$/i;
const EXCEL_EXT = /\.(xlsx|xls)$/i;

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLS_MIME = "application/vnd.ms-excel";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Types that do not identify PDF, Word, or Excel on their own. iPadOS often uses these. */
const UNCLEAR_TYPES = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
  "application/binary",
  "application/zip",
  "application/x-zip",
  "application/x-zip-compressed",
  "application/x-compressed",
  "application/x-download",
  "application/force-download",
  "application/download",
  "application/unknown",
]);

const HEAD_BYTES = 256 * 1024;
const TAIL_BYTES = 64 * 1024;

export type ImportKind = "pdf" | "docx" | "doc" | "excel";

export async function detectImportKind(file: File): Promise<ImportKind | null> {
  const name = file.name ?? "";
  const type = (file.type ?? "").split(";")[0].trim().toLowerCase();

  if (PDF_EXT.test(name) || type === "application/pdf") return "pdf";
  if (DOCX_EXT.test(name) || type === DOCX_MIME) return "docx";
  if (DOC_EXT.test(name)) return "doc";
  if (EXCEL_EXT.test(name) || type === XLS_MIME || type === XLSX_MIME) return "excel";
  if (!UNCLEAR_TYPES.has(type)) return null;
  return sniffKind(file);
}

async function sniffKind(file: File): Promise<ImportKind | null> {
  const headLen = Math.min(file.size, HEAD_BYTES);
  const head = new Uint8Array(await file.slice(0, headLen).arrayBuffer());
  if (hasPdfMagic(head.subarray(0, Math.min(head.length, 1024)))) return "pdf";
  if (!hasZipMagic(head)) return null;

  let probe = head;
  if (file.size > headLen) {
    const tailLen = Math.min(file.size, TAIL_BYTES);
    const tail = new Uint8Array(await file.slice(file.size - tailLen).arrayBuffer());
    const combined = new Uint8Array(head.length + tail.length);
    combined.set(head, 0);
    combined.set(tail, head.length);
    probe = combined;
  }

  const wordAt = indexOfAscii(probe, "word/");
  const sheetAt = indexOfAscii(probe, "xl/");
  if (wordAt >= 0 && (sheetAt < 0 || wordAt <= sheetAt)) return "docx";
  if (sheetAt >= 0) return "excel";
  if (includesAscii(probe, "wordprocessingml")) return "docx";
  if (includesAscii(probe, "spreadsheetml")) return "excel";
  return null;
}

function hasPdfMagic(bytes: Uint8Array): boolean {
  for (let i = 0; i <= bytes.length - 4; i++) {
    if (
      bytes[i] === 0x25 &&
      bytes[i + 1] === 0x50 &&
      bytes[i + 2] === 0x44 &&
      bytes[i + 3] === 0x46
    ) {
      return true;
    }
  }
  return false;
}

function hasZipMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

function includesAscii(bytes: Uint8Array, needle: string): boolean {
  return indexOfAscii(bytes, needle) >= 0;
}

function indexOfAscii(bytes: Uint8Array, needle: string): number {
  const n = needle.length;
  if (n === 0 || bytes.length < n) return -1;
  outer: for (let i = 0; i <= bytes.length - n; i++) {
    for (let j = 0; j < n; j++) {
      if (bytes[i + j] !== needle.charCodeAt(j)) continue outer;
    }
    return i;
  }
  return -1;
}
