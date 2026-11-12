import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { ImportedDocument, ProgressFn } from "./types";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function importPdf(
  file: File,
  onProgress?: ProgressFn,
): Promise<ImportedDocument> {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress?.(i, doc.numPages, `正在匯入 PDF 第 ${i} / ${doc.numPages} 頁…`);
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("無法繪製 PDF 頁面。");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvas,
      canvasContext: ctx,
      viewport,
    }).promise;
    const image = await canvasToJpeg(canvas, 0.86);
    pages.push({
      width: canvas.width / 2,
      height: canvas.height / 2,
      backgroundKind: "image" as const,
      label: `第 ${i} 頁`,
      image,
      mime: "image/jpeg",
    });
  }
  return {
    sourceType: "pdf",
    sourceName: file.name,
    pages,
  };
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("無法產生頁面影像。"));
      },
      "image/jpeg",
      quality,
    );
  });
}
