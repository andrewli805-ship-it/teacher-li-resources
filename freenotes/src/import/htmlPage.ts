import { A4_HEIGHT, A4_WIDTH } from "../types";

export const HTML_PAGE_STYLE = `
  box-sizing: border-box;
  font-family: "PingFang TC", "Noto Sans TC", "Heiti TC", -apple-system, sans-serif;
  font-size: 15px;
  line-height: 1.55;
  color: #1c1917;
  background: #fffdf9;
`;

export function wrapHtmlPage(inner: string, width: number, padding: number): string {
  return `<div class="fn-html-page" style="width:${width}px;min-height:100%;padding:${padding}px;${HTML_PAGE_STYLE}">${inner}</div>`;
}

export function paginateHtml(
  html: string,
  pageWidth = A4_WIDTH,
  pageHeight = A4_HEIGHT,
  padding = 48,
): string[] {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-12000px;top:0;width:${pageWidth}px;pointer-events:none;visibility:hidden;`;
  const measure = document.createElement("div");
  measure.style.cssText = `width:${pageWidth}px;padding:${padding}px;${HTML_PAGE_STYLE}`;
  measure.innerHTML = html.trim() || "<p>（空白文件）</p>";
  host.appendChild(measure);
  document.body.appendChild(host);

  const children = Array.from(measure.children) as HTMLElement[];
  const maxContent = pageHeight - padding * 2;
  const pages: string[] = [];

  if (children.length === 0) {
    pages.push(wrapHtmlPage(measure.innerHTML, pageWidth, padding));
    host.remove();
    return pages;
  }

  let bucket: HTMLElement[] = [];
  let height = 0;

  const flush = () => {
    if (!bucket.length) return;
    const inner = bucket.map((el) => el.outerHTML).join("");
    pages.push(wrapHtmlPage(inner, pageWidth, padding));
    bucket = [];
    height = 0;
  };

  for (const child of children) {
    const style = window.getComputedStyle(child);
    const margin =
      parseFloat(style.marginTop || "0") + parseFloat(style.marginBottom || "0");
    const h = child.offsetHeight + margin;
    if (bucket.length && height + h > maxContent) flush();
    bucket.push(child);
    height += h;
    if (h > maxContent && bucket.length === 1) flush();
  }
  flush();
  host.remove();
  return pages.length ? pages : [wrapHtmlPage("<p>（空白文件）</p>", pageWidth, padding)];
}

export function measureHtmlSize(
  html: string,
  minWidth: number,
  minHeight: number,
): { width: number; height: number } {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-12000px;top:0;width:${minWidth}px;pointer-events:none;visibility:hidden;`;
  host.innerHTML = html;
  document.body.appendChild(host);
  const el = host.firstElementChild as HTMLElement | null;
  const width = Math.max(minWidth, Math.ceil(el?.scrollWidth ?? minWidth));
  const height = Math.max(minHeight, Math.ceil(el?.scrollHeight ?? minHeight));
  host.remove();
  return { width, height };
}
