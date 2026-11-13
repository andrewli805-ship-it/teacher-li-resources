import { describe, expect, it } from "vitest";
import { importPickerHtml } from "./library";

describe("importPickerHtml", () => {
  it("puts the file input on the control itself, without a clipped scripted input", () => {
    const html = importPickerHtml();
    expect(html.startsWith('<label class="btn ghost file-import">')).toBe(true);
    expect(html).toContain('class="file-import-input"');
    expect(html).toContain('type="file"');
    expect(html).toContain("匯入檔案");
    expect(html).not.toContain("sr-only");
    expect(html).not.toContain(".doc,");
    expect(html).not.toContain("application/msword");
    expect(html).toContain(".docx");
  });
});