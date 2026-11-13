import { describe, expect, it } from "vitest";
import { IMPORT_ACCEPT, detectImportKind } from "./kind";
import { importWord } from "./word";

function file(name: string, type: string, bytes: Uint8Array): File {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new File([copy], name, { type });
}

function zipNamed(entryName: string): Uint8Array {
  const name = new TextEncoder().encode(entryName);
  const header = new Uint8Array(30 + name.length);
  header[0] = 0x50;
  header[1] = 0x4b;
  header[2] = 0x03;
  header[3] = 0x04;
  header[26] = name.length & 0xff;
  header[27] = (name.length >> 8) & 0xff;
  header.set(name, 30);
  return header;
}

describe("IMPORT_ACCEPT", () => {
  it("offers pdf, docx, and excel, and does not offer legacy .doc", () => {
    const tokens = IMPORT_ACCEPT.split(",");
    expect(tokens).toContain(".pdf");
    expect(tokens).toContain(".docx");
    expect(tokens).toContain(".xls");
    expect(tokens).toContain(".xlsx");
    expect(tokens).toContain("application/pdf");
    expect(tokens).not.toContain(".doc");
    expect(tokens).not.toContain("application/msword");
  });
});

describe("detectImportKind", () => {
  it("trusts a clear extension or MIME type", async () => {
    expect(await detectImportKind(file("notes.PDF", "", new Uint8Array()))).toBe("pdf");
    expect(await detectImportKind(file("sheet", "application/pdf", new Uint8Array()))).toBe("pdf");
    expect(await detectImportKind(file("essay.docx", "application/octet-stream", new Uint8Array()))).toBe(
      "docx",
    );
    expect(await detectImportKind(file("marks.xlsx", "", new Uint8Array()))).toBe("excel");
    expect(await detectImportKind(file("marks.xls", "", new Uint8Array()))).toBe("excel");
    expect(await detectImportKind(file("old.DOC", "application/octet-stream", new Uint8Array()))).toBe("doc");
  });

  it("sniffs PDF, docx, and xlsx when the type is empty or generic", async () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    expect(await detectImportKind(file("掃描檔", "", pdf))).toBe("pdf");
    expect(await detectImportKind(file("download", "application/octet-stream", pdf))).toBe("pdf");
    expect(await detectImportKind(file("blob", "application/zip", zipNamed("word/document.xml")))).toBe(
      "docx",
    );
    expect(
      await detectImportKind(file("blob", "application/octet-stream", zipNamed("xl/workbook.xml"))),
    ).toBe("excel");
  });

  it("finds an office entry stored past the first 256KB", async () => {
    const pad = new Uint8Array(300 * 1024);
    pad[0] = 0x50;
    pad[1] = 0x4b;
    pad[2] = 0x03;
    pad[3] = 0x04;
    const name = new TextEncoder().encode("xl/workbook.xml");
    const bytes = new Uint8Array(pad.length + name.length);
    bytes.set(pad, 0);
    bytes.set(name, pad.length);
    expect(await detectImportKind(file("blob", "application/octet-stream", bytes))).toBe("excel");
  });

  it("does not sniff a specific unsupported type", async () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    expect(await detectImportKind(file("photo", "image/jpeg", pdf))).toBeNull();
    expect(await detectImportKind(file("notes.txt", "text/plain", new Uint8Array([1, 2, 3])))).toBeNull();
  });
});

describe("legacy .doc", () => {
  it("keeps the save-as-docx message", async () => {
    await expect(importWord(file("lecture.doc", "application/msword", new Uint8Array([1])))).rejects.toThrow(
      "暫不支援舊版 .doc 檔，請先在 Word 另存為 .docx 後再匯入。",
    );
  });
});
