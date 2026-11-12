export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 4;

export function clampScale(scale: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

export function fitTransform(
  pageW: number,
  pageH: number,
  viewW: number,
  viewH: number,
  padding = 20,
): ViewTransform {
  const availW = Math.max(80, viewW - padding * 2);
  const availH = Math.max(80, viewH - padding * 2);
  const scale = clampScale(Math.min(availW / pageW, availH / pageH));
  return {
    x: (viewW - pageW * scale) / 2,
    y: Math.max(padding * 0.4, (viewH - pageH * scale) / 2),
    scale,
  };
}

export function screenToPage(
  view: ViewTransform,
  sx: number,
  sy: number,
): { x: number; y: number } {
  return {
    x: (sx - view.x) / view.scale,
    y: (sy - view.y) / view.scale,
  };
}

export function zoomAt(
  view: ViewTransform,
  screenX: number,
  screenY: number,
  nextScale: number,
): ViewTransform {
  const scale = clampScale(nextScale);
  const page = screenToPage(view, screenX, screenY);
  return {
    scale,
    x: screenX - page.x * scale,
    y: screenY - page.y * scale,
  };
}

export function applyCssTransform(
  el: HTMLElement,
  view: ViewTransform,
): void {
  el.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
}
