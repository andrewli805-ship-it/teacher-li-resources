import type { PaperTemplate, Stroke } from "../types";

export const PAPER_COLOR = "#fbf8f2";
const LINE_COLOR = "rgba(70, 58, 46, 0.16)";
const MARGIN_COLOR = "rgba(155, 48, 48, 0.28)";
const GRID_COLOR = "rgba(70, 58, 46, 0.12)";

export function drawPaper(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  template: PaperTemplate,
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = PAPER_COLOR;
  ctx.fillRect(0, 0, width, height);

  if (template === "lined") {
    const top = 56;
    const gap = 32;
    const margin = 64;
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1;
    for (let y = top; y < height - 24; y += gap) {
      ctx.beginPath();
      ctx.moveTo(36, y);
      ctx.lineTo(width - 28, y);
      ctx.stroke();
    }
    ctx.strokeStyle = MARGIN_COLOR;
    ctx.beginPath();
    ctx.moveTo(margin, 28);
    ctx.lineTo(margin, height - 24);
    ctx.stroke();
  } else if (template === "grid") {
    const gap = 24;
    const inset = 20;
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    for (let x = inset; x < width - 12; x += gap) {
      ctx.beginPath();
      ctx.moveTo(x, inset);
      ctx.lineTo(x, height - inset);
      ctx.stroke();
    }
    for (let y = inset; y < height - 12; y += gap) {
      ctx.beginPath();
      ctx.moveTo(inset, y);
      ctx.lineTo(width - inset, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function renderStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
): void {
  for (const stroke of strokes) drawStroke(ctx, stroke);
}

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const pts = stroke.points;
  if (pts.length === 0) return;

  ctx.save();
  if (stroke.tool === "highlighter") {
    ctx.globalAlpha = 0.34;
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.width;
    strokePath(ctx, pts);
  } else {
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (pts.length === 1) {
      const r = (stroke.width * (0.4 + 0.6 * clampPressure(pts[0].p))) / 2;
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, Math.max(r, 0.6), 0, Math.PI * 2);
      ctx.fill();
    } else {
      drawVariableStroke(ctx, stroke);
    }
  }
  ctx.restore();
}

function strokePath(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
): void {
  ctx.beginPath();
  if (pts.length === 1) {
    ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();
    return;
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2;
    const midY = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function drawVariableStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
): void {
  const pts = stroke.points;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const pa = 0.35 + 0.65 * clampPressure(a.p);
    const pb = 0.35 + 0.65 * clampPressure(b.p);
    ctx.lineWidth = stroke.width * ((pa + pb) / 2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function clampPressure(p: number): number {
  if (!Number.isFinite(p) || p <= 0) return 0.55;
  return Math.max(0.12, Math.min(1, p));
}

export function resizeCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  quality = 1,
): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const scale = dpr * quality;
  const w = Math.max(1, Math.round(cssWidth * scale));
  const h = Math.max(1, Math.round(cssHeight * scale));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法建立畫布。");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  return ctx;
}
