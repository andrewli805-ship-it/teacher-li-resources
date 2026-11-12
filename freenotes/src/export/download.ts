import { jsPDF } from "jspdf";
import type { BackgroundRecord, Page, Stroke } from "../types";
import { canvasToBlob, rasterizePage } from "./renderPage";

export async function shareOrDownload(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (typeof nav.share === "function") {
    try {
      const data: ShareData = { files: [file], title: filename };
      if (!nav.canShare || nav.canShare(data)) {
        await nav.share(data);
        return;
      }
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function exportPagePng(
  page: Page,
  strokes: Stroke[],
  background: BackgroundRecord | undefined,
  filename: string,
): Promise<void> {
  const canvas = await rasterizePage(page, strokes, background, 2);
  const blob = await canvasToBlob(canvas);
  await shareOrDownload(blob, filename);
}

export async function exportPagesPdf(
  pages: { page: Page; strokes: Stroke[]; background?: BackgroundRecord }[],
  filename: string,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  if (!pages.length) throw new Error("沒有可匯出的頁面。");
  let pdf: jsPDF | undefined;
  for (let i = 0; i < pages.length; i++) {
    onProgress?.(i + 1, pages.length);
    const { page, strokes, background } = pages[i];
    const canvas = await rasterizePage(page, strokes, background, 2);
    const orientation = page.width >= page.height ? "l" : "p";
    const format: [number, number] = [page.width, page.height];
    if (!pdf) {
      pdf = new jsPDF({ orientation, unit: "pt", format, compress: true });
    } else {
      pdf.addPage(format, orientation);
    }
    const image = canvas.toDataURL("image/jpeg", 0.88);
    pdf.addImage(image, "JPEG", 0, 0, page.width, page.height);
  }
  if (!pdf) throw new Error("無法建立 PDF。");
  const blob = pdf.output("blob");
  await shareOrDownload(blob, filename);
}

export function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "Freenotes";
}
