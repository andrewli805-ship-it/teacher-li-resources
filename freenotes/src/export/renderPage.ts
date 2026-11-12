import { drawPaper, renderStrokes } from "../ink/render";
import type { BackgroundRecord, Page, PaperTemplate, Stroke } from "../types";

const HTML_EXPORT_STYLE = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fffdf9; }
  body {
    font-family: "PingFang TC", "Noto Sans TC", "Heiti TC", -apple-system, sans-serif;
    font-size: 15px;
    line-height: 1.55;
    color: #1c1917;
  }
  h1,h2,h3 { font-weight: 650; margin: 0 0 0.6em; }
  p { margin: 0 0 0.7em; }
  table.sheet-table, .sheet-table {
    border-collapse: collapse;
    width: 100%;
    font-size: 12px;
  }
  .sheet-table th, .sheet-table td {
    border: 1px solid #d7c9b6;
    padding: 4px 8px;
    vertical-align: top;
    text-align: left;
  }
  .sheet-table th { background: #f3eadc; font-weight: 600; }
  .sheet-table .rn { width: 36px; text-align: center; color: #6b6258; }
  .sheet-title { font-size: 16px; margin: 0 0 12px; }
  img { max-width: 100%; }
`;

export async function rasterizePage(
  page: Page,
  strokes: Stroke[],
  background: BackgroundRecord | undefined,
  scale = 2,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(page.width * scale));
  canvas.height = Math.max(1, Math.round(page.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法建立匯出畫布。");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = "#fffdf9";
  ctx.fillRect(0, 0, page.width, page.height);

  if (page.backgroundKind === "template") {
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const tctx = tmp.getContext("2d");
    if (tctx) {
      tctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawPaper(tctx, page.width, page.height, page.paperTemplate ?? "blank");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(tmp, 0, 0);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    }
  } else if (background?.kind === "image" && background.data instanceof Blob) {
    const url = URL.createObjectURL(background.data);
    try {
      const img = await loadImage(url);
      ctx.drawImage(img, 0, 0, page.width, page.height);
    } finally {
      URL.revokeObjectURL(url);
    }
  } else if (background?.kind === "html" && typeof background.data === "string") {
    const img = await htmlToImage(background.data, page.width, page.height);
    if (img) ctx.drawImage(img, 0, 0, page.width, page.height);
  }

  renderStrokes(ctx, strokes);
  return canvas;
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: "image/png" | "image/jpeg" = "image/png",
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("無法產生圖片。"));
      },
      type,
      quality,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("無法載入頁面影像。"));
    img.src = src;
  });
}

async function htmlToImage(
  html: string,
  width: number,
  height: number,
): Promise<HTMLImageElement | null> {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <style>${HTML_EXPORT_STYLE}</style>
      ${html}
    </div>
  </foreignObject>
</svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  try {
    return await loadImage(url);
  } catch {
    return null;
  }
}

export function paperLabel(template: PaperTemplate | undefined): string {
  if (template === "lined") return "橫線";
  if (template === "grid") return "方格";
  return "空白";
}
