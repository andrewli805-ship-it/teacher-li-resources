import {
  deletePageCascade,
  deleteStrokes,
  getBackground,
  getNotebook,
  listPages,
  listStrokes,
  putNotebook,
  putPages,
  putStroke,
  touchNotebook,
  type FreenotesDB,
} from "../db";
import { uid } from "../id";
import { eraseStrokes } from "../ink/eraseSplit";
import { StrokeHistory } from "../ink/history";
import { simplifyPoints } from "../ink/geometry";
import { drawStroke, renderStrokes, resizeCanvas } from "../ink/render";
import {
  A4_HEIGHT,
  A4_WIDTH,
  ERASER_RADII,
  HIGHLIGHTER_WIDTHS,
  PEN_WIDTHS,
  PRESET_COLORS,
  eraserRadiusFromStorage,
  type BackgroundRecord,
  type HistoryAction,
  type Notebook,
  type Page,
  type Point,
  type Stroke,
  type Tool,
} from "../types";
import {
  applyCssTransform,
  fitTransform,
  screenToPage,
  zoomAt,
  type ViewTransform,
} from "../viewport";
import { icon } from "./icons";
import {
  actionSheet,
  confirmDialog,
  escapeHtml,
  progressDialog,
  promptDialog,
  showToast,
} from "./modals";

export async function renderEditor(
  root: HTMLElement,
  db: FreenotesDB,
  notebookId: string,
  goHome: () => void,
): Promise<void> {
  const editor = new Editor(root, db, notebookId, goHome);
  await editor.mount();
}

class Editor {
  private notebook!: Notebook;
  private pages: Page[] = [];
  private pageIndex = 0;
  private strokes: Stroke[] = [];
  private background: BackgroundRecord | undefined;
  private backgroundUrl: string | null = null;
  private history = new StrokeHistory();
  private tool: Tool = "pen";
  private color: string = PRESET_COLORS[0];
  private penWidth: number = PEN_WIDTHS[1];
  private highlighterWidth: number = HIGHLIGHTER_WIDTHS[1];
  private eraserRadius = readEraserRadius();
  private eraserPreview: { x: number; y: number } | null = null;
  private eraserPreviewAlpha = 1;
  private eraserFadeRaf = 0;
  private mouseInView = false;
  private mouseClient: { x: number; y: number } | null = null;
  private view: ViewTransform = { x: 0, y: 0, scale: 1 };
  private pointers = new Map<number, { x: number; y: number; type: string }>();
  private ignoreUntilUp = new Set<number>();
  private drawingId: number | null = null;
  private currentStroke: Stroke | null = null;
  private eraserPath: Point[] = [];
  /** Page strokes as they were at pointerdown, before this eraser gesture. */
  private eraseSnapshot: Stroke[] | null = null;
  private pinching = false;
  private pinch:
    | { dist: number; scale: number; cx: number; cy: number; view: ViewTransform }
    | null = null;
  private penActive = false;
  private thumbsOpen = window.innerWidth >= 900;
  private unsubs: Array<() => void> = [];

  private root: HTMLElement;
  private db: FreenotesDB;
  private notebookId: string;
  private goHome: () => void;

  constructor(
    root: HTMLElement,
    db: FreenotesDB,
    notebookId: string,
    goHome: () => void,
  ) {
    this.root = root;
    this.db = db;
    this.notebookId = notebookId;
    this.goHome = goHome;
  }

  async mount(): Promise<void> {
    const notebook = await getNotebook(this.db, this.notebookId);
    if (!notebook) {
      showToast("找不到這本筆記。", "error");
      this.goHome();
      return;
    }
    this.notebook = notebook;
    this.pages = await listPages(this.db, this.notebookId);
    if (!this.pages.length) {
      showToast("這本筆記沒有頁面。", "error");
      this.goHome();
      return;
    }
    this.buildShell();
    await this.loadPage(0, true);
    this.bind();
  }

  private get page(): Page {
    return this.pages[this.pageIndex];
  }

  private get widths(): readonly number[] {
    if (this.tool === "eraser") return ERASER_RADII;
    return this.tool === "highlighter" ? HIGHLIGHTER_WIDTHS : PEN_WIDTHS;
  }

  private get width(): number {
    if (this.tool === "eraser") return this.eraserRadius;
    return this.tool === "highlighter" ? this.highlighterWidth : this.penWidth;
  }

  private buildShell(): void {
    this.root.className = "app editor-app";
    this.root.innerHTML = `
      <header class="editor-top">
        <button type="button" class="icon-btn" data-act="home" aria-label="返回書庫">${icon("back")}</button>
        <button type="button" class="editor-title" data-act="rename" title="重新命名">${escapeHtml(this.notebook.name)}</button>
        <div class="tool-group tools-main">
          ${toolButton("pen", "原子筆")}
          ${toolButton("highlighter", "螢光筆")}
          ${toolButton("eraser", "橡皮擦")}
        </div>
        <div class="tool-group colors" data-role="colors"></div>
        <label class="custom-color" title="自訂顏色">
          <input type="color" value="${this.color}" aria-label="自訂顏色" />
        </label>
        <div class="tool-group widths" data-role="widths"></div>
        <div class="tool-group">
          <button type="button" class="icon-btn" data-act="undo" aria-label="復原" disabled>${icon("undo")}</button>
          <button type="button" class="icon-btn" data-act="redo" aria-label="重做" disabled>${icon("redo")}</button>
        </div>
        <div class="top-end">
          <button type="button" class="icon-btn" data-act="thumbs" aria-label="頁面">${icon("pages")}</button>
          <button type="button" class="icon-btn" data-act="export" aria-label="匯出">${icon("export")}</button>
          <button type="button" class="icon-btn" data-act="more" aria-label="更多">${icon("more")}</button>
        </div>
      </header>

      <div class="editor-body">
        <aside class="thumbs ${this.thumbsOpen ? "open" : ""}" data-role="thumbs"></aside>
        <div class="stage-wrap">
          <div class="viewport" data-role="viewport">
            <div class="stage" data-role="stage">
              <div class="page-bg" data-role="bg"></div>
              <canvas class="ink-canvas" data-role="ink"></canvas>
              <canvas class="draft-canvas" data-role="draft"></canvas>
            </div>
          </div>
          <div class="page-nav">
            <button type="button" class="icon-btn" data-act="prev" aria-label="上一頁">${icon("chevronL")}</button>
            <span class="page-indicator" data-role="indicator"></span>
            <button type="button" class="icon-btn" data-act="next" aria-label="下一頁">${icon("chevronR")}</button>
            <button type="button" class="btn ghost compact" data-act="add-page">${icon("plus")}新增頁</button>
          </div>
        </div>
      </div>

      <nav class="editor-dock">
        <button type="button" class="dock-btn" data-tool="pen" aria-label="原子筆">${icon("pen")}<span>筆</span></button>
        <button type="button" class="dock-btn" data-tool="highlighter" aria-label="螢光筆">${icon("highlighter")}<span>螢光</span></button>
        <button type="button" class="dock-btn" data-tool="eraser" aria-label="橡皮擦">${icon("eraser")}<span>擦去</span></button>
        <button type="button" class="dock-btn" data-act="palette" data-role="palette-btn" aria-label="顏色"><span class="dock-glyph"><span class="dock-color" data-role="dock-color"></span><span class="dock-size" data-role="dock-size" data-size="10" hidden><svg data-size="6" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="3.25" fill="none" stroke="currentColor" stroke-width="1.5"/></svg><svg data-size="10" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5.25" fill="none" stroke="currentColor" stroke-width="1.5"/></svg><svg data-size="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8.25" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span></span><span data-role="palette-label">顏色</span></button>
        <button type="button" class="dock-btn" data-act="undo" aria-label="復原">${icon("undo")}<span>復原</span></button>
        <button type="button" class="dock-btn" data-act="redo" aria-label="重做">${icon("redo")}<span>重做</span></button>
        <button type="button" class="dock-btn" data-act="export" aria-label="匯出">${icon("export")}<span>匯出</span></button>
      </nav>
      <div class="palette-pop" data-role="palette-pop" hidden></div>
    `;
    this.renderColors();
    this.renderWidths();
    this.syncToolButtons();
  }

  private qs<T extends HTMLElement>(sel: string): T {
    const node = this.root.querySelector(sel);
    if (!node) throw new Error(`缺少介面元件：${sel}`);
    return node as T;
  }

  private bind(): void {
    const viewport = this.qs("[data-role=viewport]");
    const forward = (type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel") => {
      const handler = (e: PointerEvent) => this.onPointer(type, e);
      viewport.addEventListener(type, handler as EventListener, { passive: false });
      this.unsubs.push(() => viewport.removeEventListener(type, handler as EventListener));
    };
    forward("pointerdown");
    forward("pointermove");
    forward("pointerup");
    forward("pointercancel");

    const wheel = (e: WheelEvent) => this.onWheel(e);
    viewport.addEventListener("wheel", wheel, { passive: false });
    this.unsubs.push(() => viewport.removeEventListener("wheel", wheel));

    const touchGuard = (e: TouchEvent) => {
      if (viewport.contains(e.target as Node)) e.preventDefault();
    };
    viewport.addEventListener("touchstart", touchGuard, { passive: false });
    viewport.addEventListener("touchmove", touchGuard, { passive: false });
    this.unsubs.push(() => {
      viewport.removeEventListener("touchstart", touchGuard);
      viewport.removeEventListener("touchmove", touchGuard);
    });

    this.root.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-act],[data-tool],[data-color],[data-width]");
      if (!btn) return;
      void this.onAction(btn);
    });

    this.root.querySelector("input[type=color]")?.addEventListener("input", (e) => {
      this.color = (e.target as HTMLInputElement).value;
      this.renderColors();
      this.syncToolButtons();
    });

    const onResize = () => {
      this.fitAndRedraw();
    };
    window.addEventListener("resize", onResize);
    this.unsubs.push(() => window.removeEventListener("resize", onResize));

    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) void this.redo();
        else void this.undo();
      }
    };
    window.addEventListener("keydown", onKey);
    this.unsubs.push(() => window.removeEventListener("keydown", onKey));

    const noMenu = (e: Event) => e.preventDefault();
    viewport.addEventListener("contextmenu", noMenu);
    this.unsubs.push(() => viewport.removeEventListener("contextmenu", noMenu));

    const leave = (e: PointerEvent) => this.pointerLeave(e);
    viewport.addEventListener("pointerleave", leave);
    this.unsubs.push(() => viewport.removeEventListener("pointerleave", leave));
  }

  private async onAction(btn: HTMLElement): Promise<void> {
    const tool = btn.dataset.tool as Tool | undefined;
    if (tool) {
      const previous = this.tool;
      this.tool = tool;
      if (tool !== "eraser") this.clearEraserPreview();
      this.syncToolButtons();
      this.renderWidths();
      if (tool === "eraser" && previous !== "eraser") this.updateEraserHover();
      return;
    }
    if (btn.dataset.color) {
      this.color = btn.dataset.color;
      const colorInput = this.root.querySelector("input[type=color]") as HTMLInputElement | null;
      if (colorInput) colorInput.value = this.color;
      this.renderColors();
      this.syncToolButtons();
      this.closePalette();
      return;
    }
    if (btn.dataset.width) {
      const w = Number(btn.dataset.width);
      if (this.tool === "eraser") {
        if ((ERASER_RADII as readonly number[]).includes(w)) {
          this.eraserRadius = w;
          writeEraserRadius(w);
          this.syncPaletteButton();
          this.renderWidths();
          if (this.eraserPreview) this.renderDraft();
        }
        return;
      }
      if (this.tool === "highlighter") this.highlighterWidth = w;
      else this.penWidth = w;
      this.renderWidths();
      return;
    }
    const act = btn.dataset.act;
    if (act === "home") this.goHome();
    if (act === "rename") await this.rename();
    if (act === "undo") await this.undo();
    if (act === "redo") await this.redo();
    if (act === "prev") await this.goPage(this.pageIndex - 1);
    if (act === "next") await this.goPage(this.pageIndex + 1);
    if (act === "add-page") await this.addPage();
    if (act === "thumbs") this.toggleThumbs();
    if (act === "export") await this.exportMenu();
    if (act === "more") await this.moreMenu();
    if (act === "palette") this.togglePalette();
    if (act === "goto") {
      const i = Number(btn.dataset.index);
      if (Number.isFinite(i)) await this.goPage(i);
    }
    if (act === "page-up") {
      const i = Number(btn.dataset.index);
      if (Number.isFinite(i)) await this.movePage(i, i - 1);
    }
    if (act === "page-down") {
      const i = Number(btn.dataset.index);
      if (Number.isFinite(i)) await this.movePage(i, i + 1);
    }
  }

  private async rename(): Promise<void> {
    const name = await promptDialog({
      title: "重新命名筆記本",
      value: this.notebook.name,
    });
    if (!name || name === this.notebook.name) return;
    this.notebook.name = name;
    this.notebook.updatedAt = Date.now();
    await putNotebook(this.db, this.notebook);
    const title = this.root.querySelector(".editor-title");
    if (title) title.textContent = name;
  }

  private async loadPage(index: number, fit: boolean): Promise<void> {
    this.pageIndex = Math.max(0, Math.min(this.pages.length - 1, index));
    const page = this.page;
    this.strokes = await listStrokes(this.db, page.id);
    this.background = await getBackground(this.db, page.id);
    if (this.backgroundUrl) {
      URL.revokeObjectURL(this.backgroundUrl);
      this.backgroundUrl = null;
    }
    const stage = this.qs("[data-role=stage]");
    stage.style.width = `${page.width}px`;
    stage.style.height = `${page.height}px`;
    const bg = this.qs("[data-role=bg]");
    bg.className = "page-bg";
    bg.innerHTML = "";
    bg.style.backgroundImage = "";
    if (page.backgroundKind === "template") {
      bg.classList.add("paper", page.paperTemplate ?? "blank");
    } else if (this.background?.kind === "image" && this.background.data instanceof Blob) {
      this.backgroundUrl = URL.createObjectURL(this.background.data);
      const img = document.createElement("img");
      img.src = this.backgroundUrl;
      img.alt = "";
      img.draggable = false;
      bg.append(img);
    } else if (this.background?.kind === "html" && typeof this.background.data === "string") {
      bg.classList.add("html");
      bg.innerHTML = this.background.data;
    }
    if (fit) this.fitView();
    else this.applyView();
    this.redrawInk();
    this.updateIndicator();
    this.renderThumbs();
    this.syncHistoryButtons();
  }

  private fitView(): void {
    const viewport = this.qs("[data-role=viewport]");
    const rect = viewport.getBoundingClientRect();
    this.view = fitTransform(this.page.width, this.page.height, rect.width, rect.height, 18);
    this.applyView();
  }

  private fitAndRedraw(): void {
    this.fitView();
    this.redrawInk();
    this.updateEraserHover();
  }

  private applyView(): void {
    applyCssTransform(this.qs("[data-role=stage]"), this.view);
  }

  private quality(): number {
    return Math.max(1, Math.min(2.25, this.view.scale));
  }

  private redrawInk(): void {
    const ink = this.qs<HTMLCanvasElement>("[data-role=ink]");
    const draft = this.qs<HTMLCanvasElement>("[data-role=draft]");
    const { width, height } = this.page;
    const q = this.quality();
    const ctx = resizeCanvas(ink, width, height, q);
    ctx.clearRect(0, 0, width, height);
    renderStrokes(ctx, this.strokes);
    resizeCanvas(draft, width, height, q);
    this.renderDraft();
  }

  private renderDraft(): void {
    const draft = this.root.querySelector<HTMLCanvasElement>("[data-role=draft]");
    if (!draft || !this.pages.length) return;
    const ctx = resizeCanvas(draft, this.page.width, this.page.height, this.quality());
    ctx.clearRect(0, 0, this.page.width, this.page.height);
    if (this.currentStroke) drawStroke(ctx, this.currentStroke);
    this.paintEraserPreview(ctx);
  }

  private paintEraserPreview(ctx: CanvasRenderingContext2D): void {
    if (this.tool !== "eraser" || this.pinching || !this.eraserPreview) return;
    const { x, y } = this.eraserPreview;
    ctx.save();
    ctx.globalAlpha = this.eraserPreviewAlpha;
    ctx.beginPath();
    ctx.arc(x, y, this.eraserRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(36, 31, 26, 0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(36, 31, 26, 0.55)";
    // 1.5 page px at 1:1, tweaked so the ring stays about 1–2 CSS px as zoom changes.
    ctx.lineWidth = 1.5 / Math.max(this.view.scale, 0.25);
    ctx.stroke();
    ctx.restore();
  }

  private updateIndicator(): void {
    const label = this.page.label ? ` · ${this.page.label}` : "";
    this.qs("[data-role=indicator]").textContent =
      `${this.pageIndex + 1} / ${this.pages.length}${label}`;
    const prev = this.root.querySelector('[data-act="prev"]') as HTMLButtonElement;
    const next = this.root.querySelector('[data-act="next"]') as HTMLButtonElement;
    prev.disabled = this.pageIndex <= 0;
    next.disabled = this.pageIndex >= this.pages.length - 1;
  }

  private renderColors(): void {
    const host = this.root.querySelector("[data-role=colors]");
    if (!host) return;
    const custom = PRESET_COLORS.includes(this.color as (typeof PRESET_COLORS)[number])
      ? ""
      : this.color;
    const colors = custom ? [...PRESET_COLORS, custom] : [...PRESET_COLORS];
    host.innerHTML = colors
      .map((c) => {
        const on = c.toLowerCase() === this.color.toLowerCase();
        return `<button type="button" class="swatch ${on ? "active" : ""}" data-color="${c}" style="--swatch:${c}" aria-label="顏色 ${c}" aria-pressed="${on}"></button>`;
      })
      .join("");
    const dock = this.root.querySelector("[data-role=dock-color]") as HTMLElement | null;
    if (dock) dock.style.background = this.color;
    this.refreshOpenPalette();
  }

  private widthChips(): string {
    const labels = ["細", "中", "粗"];
    return `<div class="widths">${this.widths
      .map((w, i) => {
        const on = w === this.width;
        const aria =
          this.tool === "eraser" ? ` aria-label="擦除範圍：${labels[i]}"` : "";
        return `<button type="button" class="width-chip ${on ? "active" : ""}" data-width="${w}" aria-pressed="${on}"${aria}>${labels[i]}</button>`;
      })
      .join("")}</div>`;
  }

  private renderWidths(): void {
    const host = this.root.querySelector("[data-role=widths]");
    if (host) host.innerHTML = this.widthChips();
    this.refreshOpenPalette();
  }

  private paletteMarkup(): string {
    if (this.tool === "eraser") return this.widthChips();
    const colors = this.root.querySelector("[data-role=colors]")?.innerHTML ?? "";
    return `${colors}${this.widthChips()}`;
  }

  private refreshOpenPalette(): void {
    const pop = this.root.querySelector("[data-role=palette-pop]");
    if (!pop || pop.hasAttribute("hidden")) return;
    pop.innerHTML = this.paletteMarkup();
  }

  private syncPaletteButton(): void {
    const eraser = this.tool === "eraser";
    const btn = this.root.querySelector<HTMLElement>("[data-role=palette-btn]");
    const label = this.root.querySelector<HTMLElement>("[data-role=palette-label]");
    const colorDot = this.root.querySelector<HTMLElement>("[data-role=dock-color]");
    const sizeDot = this.root.querySelector<HTMLElement>("[data-role=dock-size]");
    if (btn) btn.setAttribute("aria-label", eraser ? "擦除大小" : "顏色");
    if (label) label.textContent = eraser ? "大小" : "顏色";
    if (colorDot) colorDot.hidden = eraser;
    if (sizeDot) {
      sizeDot.hidden = !eraser;
      sizeDot.dataset.size = String(this.eraserRadius);
    }
  }

  private syncToolButtons(): void {
    this.root.querySelectorAll<HTMLElement>("[data-tool]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === this.tool);
      btn.setAttribute("aria-pressed", String(btn.dataset.tool === this.tool));
    });
    this.root.classList.toggle("tool-eraser", this.tool === "eraser");
    this.syncPaletteButton();
    this.renderColors();
  }

  private syncHistoryButtons(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-act="undo"]').forEach((b) => {
      b.disabled = !this.history.canUndo;
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-act="redo"]').forEach((b) => {
      b.disabled = !this.history.canRedo;
    });
  }

  private toggleThumbs(): void {
    this.thumbsOpen = !this.thumbsOpen;
    this.qs("[data-role=thumbs]").classList.toggle("open", this.thumbsOpen);
    requestAnimationFrame(() => this.fitAndRedraw());
  }

  private togglePalette(): void {
    const pop = this.qs("[data-role=palette-pop]");
    if (pop.hasAttribute("hidden")) {
      pop.innerHTML = this.paletteMarkup();
      pop.removeAttribute("hidden");
    } else {
      pop.setAttribute("hidden", "");
    }
  }

  private closePalette(): void {
    this.root.querySelector("[data-role=palette-pop]")?.setAttribute("hidden", "");
  }

  private renderThumbs(): void {
    const host = this.qs("[data-role=thumbs]");
    host.innerHTML = `
      <div class="thumbs-head">
        <strong>頁面</strong>
        <button type="button" class="btn ghost compact" data-act="add-page">${icon("plus")}新增</button>
      </div>
      <ol class="thumb-list">
        ${this.pages
          .map((page, i) => {
            const current = i === this.pageIndex ? "current" : "";
            return `<li class="${current}">
              <button type="button" class="thumb" data-act="goto" data-index="${i}">
                <span class="thumb-frame ${page.backgroundKind === "template" ? `paper ${page.paperTemplate}` : ""}"></span>
                <span class="thumb-label">${i + 1}${page.label && page.label !== `第 ${i + 1} 頁` ? ` · ${escapeHtml(page.label)}` : ""}</span>
              </button>
              <span class="thumb-move">
                <button type="button" class="icon-btn tiny" data-act="page-up" data-index="${i}" aria-label="上移" ${i === 0 ? "disabled" : ""}>${icon("chevronL")}</button>
                <button type="button" class="icon-btn tiny" data-act="page-down" data-index="${i}" aria-label="下移" ${i === this.pages.length - 1 ? "disabled" : ""}>${icon("chevronR")}</button>
              </span>
            </li>`;
          })
          .join("")}
      </ol>
    `;
  }

  private onPointer(type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel", e: PointerEvent): void {
    if (type === "pointerdown") this.pointerDown(e);
    else if (type === "pointermove") this.pointerMove(e);
    else this.pointerUp(e);
  }

  private pointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    const viewport = this.qs("[data-role=viewport]");
    viewport.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

    if (e.pointerType === "pen") {
      this.penActive = true;
      for (const [id, p] of this.pointers) {
        if (p.type !== "pen") this.ignoreUntilUp.add(id);
      }
      if (this.pinching) this.endPinch();
      this.beginStroke(e);
      return;
    }

    if (this.penActive && e.pointerType === "touch") {
      this.ignoreUntilUp.add(e.pointerId);
      return;
    }

    const live = this.livePointers();
    if (live.length >= 2) {
      this.clearEraserPreview();
      this.cancelStroke();
      this.beginPinch();
      return;
    }
    this.beginStroke(e);
  }

  private pointerMove(e: PointerEvent): void {
    if (e.pointerType === "mouse") {
      this.mouseInView = true;
      this.mouseClient = { x: e.clientX, y: e.clientY };
    }
    if (!this.pointers.has(e.pointerId)) {
      if (e.pointerType === "mouse") this.updateEraserHover();
      return;
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (this.ignoreUntilUp.has(e.pointerId)) return;
    if (this.pinching) {
      e.preventDefault();
      this.clearEraserPreview();
      this.updatePinch();
      return;
    }
    if (this.drawingId === e.pointerId) {
      e.preventDefault();
      const events =
        typeof e.getCoalescedEvents === "function" && e.getCoalescedEvents().length
          ? e.getCoalescedEvents()
          : [e];
      if (this.tool === "eraser") {
        for (let i = 0; i < events.length; i++) {
          this.pushEraserPoint(this.eventToPage(events[i]), i === events.length - 1);
        }
        const tip = this.eraserPath[this.eraserPath.length - 1];
        if (tip) this.showEraserPreview(tip.x, tip.y);
        this.applyEraser();
      } else {
        for (const ev of events) this.appendPoint(ev);
      }
      this.renderDraft();
    }
  }

  private pointerUp(e: PointerEvent): void {
    const wasPinching = this.pinching;
    const wasDrawing = this.drawingId === e.pointerId;
    this.pointers.delete(e.pointerId);
    this.ignoreUntilUp.delete(e.pointerId);
    if (e.pointerType === "pen" && ![...this.pointers.values()].some((p) => p.type === "pen")) {
      this.penActive = false;
    }
    if (wasDrawing && this.eraseSnapshot && !wasPinching) {
      this.pushEraserPoint(this.eventToPage(e), true);
    }
    if (wasDrawing) {
      void this.endStroke();
    }
    if (this.pinching && this.livePointers().length < 2) {
      this.endPinch();
      for (const [id] of this.pointers) this.ignoreUntilUp.add(id);
      this.redrawInk();
    }
    if (wasDrawing && !wasPinching && this.tool === "eraser") {
      this.finishEraserGesture(e);
    }
  }

  private pointerLeave(e: PointerEvent): void {
    if (e.pointerType !== "mouse") return;
    this.mouseInView = false;
    this.mouseClient = null;
    if (this.drawingId !== null || this.pinching) return;
    this.clearEraserPreview();
  }

  private livePointers(): [number, { x: number; y: number; type: string }][] {
    return [...this.pointers.entries()].filter(([id]) => !this.ignoreUntilUp.has(id));
  }

  private beginPinch(): void {
    const pts = this.livePointers().map(([, p]) => p);
    if (pts.length < 2) return;
    this.pinching = true;
    this.clearEraserPreview();
    this.pinch = {
      dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
      scale: this.view.scale,
      cx: (pts[0].x + pts[1].x) / 2,
      cy: (pts[0].y + pts[1].y) / 2,
      view: { ...this.view },
    };
  }

  private updatePinch(): void {
    if (!this.pinch) return;
    const pts = this.livePointers().map(([, p]) => p);
    if (pts.length < 2) return;
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    const cx = (pts[0].x + pts[1].x) / 2;
    const cy = (pts[0].y + pts[1].y) / 2;
    const rect = this.qs("[data-role=viewport]").getBoundingClientRect();
    const start = this.pinch;
    const nextScale = start.scale * (dist / start.dist);
    const originX = start.cx - rect.left;
    const originY = start.cy - rect.top;
    this.view = zoomAt(start.view, originX, originY, nextScale);
    this.view.x += cx - start.cx;
    this.view.y += cy - start.cy;
    this.applyView();
  }

  private endPinch(): void {
    this.pinching = false;
    this.pinch = null;
  }

  private beginStroke(e: PointerEvent): void {
    if (this.pinching) return;
    this.drawingId = e.pointerId;
    const point = this.eventToPage(e);
    if (this.tool === "eraser") {
      this.eraseSnapshot = this.strokes.slice();
      this.eraserPath = [point];
      this.showEraserPreview(point.x, point.y);
      this.applyEraser();
      this.renderDraft();
      return;
    }
    this.currentStroke = {
      id: uid(),
      pageId: this.page.id,
      tool: this.tool,
      color: this.color,
      width: this.width,
      points: [point],
    };
    this.renderDraft();
  }

  private appendPoint(e: PointerEvent): void {
    const point = this.eventToPage(e);
    if (!this.currentStroke) return;
    const last = this.currentStroke.points[this.currentStroke.points.length - 1];
    if (last && Math.hypot(last.x - point.x, last.y - point.y) < 0.35) return;
    this.currentStroke.points.push(point);
  }

  private pushEraserPoint(point: Point, force: boolean): void {
    const last = this.eraserPath[this.eraserPath.length - 1];
    if (!last) {
      this.eraserPath.push(point);
      return;
    }
    const distance = Math.hypot(last.x - point.x, last.y - point.y);
    if (distance < 1e-4) return;
    if (!force && distance < 0.35) return;
    this.eraserPath.push(point);
  }

  private applyEraser(): void {
    if (!this.eraseSnapshot) return;
    const result = eraseStrokes(this.eraseSnapshot, this.eraserPath, this.eraserRadius, uid);
    if (sameStrokeRefs(result.strokes, this.strokes)) return;
    this.strokes = result.strokes;
    this.redrawInk();
  }

  private cancelStroke(): void {
    if (this.eraseSnapshot) {
      this.strokes = this.eraseSnapshot;
      this.eraseSnapshot = null;
      this.redrawInk();
    }
    this.currentStroke = null;
    this.eraserPath = [];
    this.drawingId = null;
    this.renderDraft();
  }

  private async endStroke(): Promise<void> {
    const drawing = this.currentStroke;
    const snapshot = this.eraseSnapshot;
    const path = this.eraserPath.slice();
    const radius = this.eraserRadius;
    this.currentStroke = null;
    this.eraserPath = [];
    this.eraseSnapshot = null;
    this.drawingId = null;

    if (snapshot) {
      const result = eraseStrokes(snapshot, path, radius, uid);
      this.strokes = result.strokes;
      this.redrawInk();
      if (result.removed.length === 0) return;
      const action: HistoryAction = {
        type: "replace",
        pageId: this.page.id,
        removed: result.removed,
        added: result.added,
        at: result.at,
        counts: result.counts,
      };
      this.history.push(action);
      await deleteStrokes(
        this.db,
        result.removed.map((stroke) => stroke.id),
      );
      for (const stroke of result.added) await putStroke(this.db, stroke);
      await touchNotebook(this.db, this.notebookId);
      this.syncHistoryButtons();
      return;
    }

    if (!drawing || drawing.points.length === 0) {
      this.renderDraft();
      return;
    }
    drawing.points = simplifyPoints(drawing.points);
    this.strokes.push(drawing);
    this.history.push({ type: "add", pageId: this.page.id, stroke: drawing });
    this.redrawInk();
    await putStroke(this.db, drawing);
    await touchNotebook(this.db, this.notebookId);
    this.syncHistoryButtons();
  }

  private eventToPage(e: PointerEvent): Point {
    const rect = this.qs("[data-role=viewport]").getBoundingClientRect();
    const pagePt = screenToPage(this.view, e.clientX - rect.left, e.clientY - rect.top);
    let pressure = 0.55;
    if (e.pointerType === "pen") {
      pressure = e.pressure > 0 ? e.pressure : 0.55;
    }
    return { x: pagePt.x, y: pagePt.y, p: pressure, t: e.timeStamp || Date.now() };
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.qs("[data-role=viewport]").getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.01);
      this.view = zoomAt(
        this.view,
        e.clientX - rect.left,
        e.clientY - rect.top,
        this.view.scale * factor,
      );
    } else {
      this.view.x -= e.deltaX;
      this.view.y -= e.deltaY;
    }
    this.applyView();
    this.updateEraserHover();
  }

  private showEraserPreview(x: number, y: number): void {
    this.cancelEraserFade();
    this.eraserPreview = { x, y };
    this.eraserPreviewAlpha = 1;
  }

  private updateEraserHover(): void {
    if (this.tool !== "eraser" || this.pinching || this.drawingId !== null) return;
    if (!this.mouseInView || !this.mouseClient) return;
    const pagePt = this.clientToPage(this.mouseClient.x, this.mouseClient.y);
    this.showEraserPreview(pagePt.x, pagePt.y);
    this.renderDraft();
  }

  private finishEraserGesture(e: PointerEvent): void {
    if (e.pointerType === "mouse") {
      const rect = this.qs("[data-role=viewport]").getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (inside) {
        this.mouseInView = true;
        this.mouseClient = { x: e.clientX, y: e.clientY };
        const point = this.eventToPage(e);
        this.showEraserPreview(point.x, point.y);
        this.renderDraft();
        return;
      }
      this.mouseInView = false;
      this.mouseClient = null;
      this.clearEraserPreview();
      return;
    }
    if (this.mouseInView && this.mouseClient) {
      const pagePt = this.clientToPage(this.mouseClient.x, this.mouseClient.y);
      this.showEraserPreview(pagePt.x, pagePt.y);
      this.renderDraft();
      return;
    }
    this.fadeEraserPreview();
  }

  private fadeEraserPreview(): void {
    this.cancelEraserFade();
    if (!this.eraserPreview) return;
    const start = performance.now();
    const duration = 150;
    const step = (now: number) => {
      if (!this.root.isConnected) return;
      const t = Math.min(1, (now - start) / duration);
      this.eraserPreviewAlpha = 1 - t;
      this.renderDraft();
      if (t < 1) {
        this.eraserFadeRaf = requestAnimationFrame(step);
      } else {
        this.eraserFadeRaf = 0;
        this.eraserPreview = null;
        this.eraserPreviewAlpha = 1;
        this.renderDraft();
      }
    };
    this.eraserFadeRaf = requestAnimationFrame(step);
  }

  private cancelEraserFade(): void {
    if (!this.eraserFadeRaf) return;
    cancelAnimationFrame(this.eraserFadeRaf);
    this.eraserFadeRaf = 0;
  }

  private clearEraserPreview(): void {
    this.cancelEraserFade();
    if (!this.eraserPreview && this.eraserPreviewAlpha === 1) return;
    this.eraserPreview = null;
    this.eraserPreviewAlpha = 1;
    this.renderDraft();
  }

  private clientToPage(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.qs("[data-role=viewport]").getBoundingClientRect();
    return screenToPage(this.view, clientX - rect.left, clientY - rect.top);
  }

  private async goPage(index: number): Promise<void> {
    if (index < 0 || index >= this.pages.length || index === this.pageIndex) return;
    await this.loadPage(index, true);
  }

  private async addPage(): Promise<void> {
    const page: Page = {
      id: uid(),
      notebookId: this.notebookId,
      index: this.pageIndex + 1,
      width: this.page.width || A4_WIDTH,
      height: A4_HEIGHT,
      backgroundKind: "template",
      paperTemplate: this.notebook.paperTemplate,
      label: `第 ${this.pages.length + 1} 頁`,
    };
    this.pages.splice(this.pageIndex + 1, 0, page);
    this.reindexPages();
    await putPages(this.db, this.pages);
    await touchNotebook(this.db, this.notebookId);
    await this.loadPage(this.pageIndex + 1, true);
  }

  private async deleteCurrentPage(): Promise<void> {
    if (this.pages.length <= 1) {
      showToast("至少要保留一頁。");
      return;
    }
    const ok = await confirmDialog({
      title: "刪除此頁？",
      message: "此頁的背景與筆跡都會移除。",
      confirmLabel: "刪除",
      danger: true,
    });
    if (!ok) return;
    const removing = this.page;
    await deletePageCascade(this.db, removing);
    this.pages = this.pages.filter((p) => p.id !== removing.id);
    this.reindexPages();
    await putPages(this.db, this.pages);
    await touchNotebook(this.db, this.notebookId);
    const next = Math.min(this.pageIndex, this.pages.length - 1);
    await this.loadPage(next, true);
  }

  private async movePage(from: number, to: number): Promise<void> {
    if (to < 0 || to >= this.pages.length || from === to) return;
    const [item] = this.pages.splice(from, 1);
    this.pages.splice(to, 0, item);
    this.reindexPages();
    await putPages(this.db, this.pages);
    await touchNotebook(this.db, this.notebookId);
    this.pageIndex = to;
    this.updateIndicator();
    this.renderThumbs();
  }

  private reindexPages(): void {
    this.pages.forEach((p, i) => {
      p.index = i;
      if (!p.label || /^第 \d+ 頁$/.test(p.label)) p.label = `第 ${i + 1} 頁`;
    });
  }

  private async exportMenu(): Promise<void> {
    const { exportPagePng, exportPagesPdf, safeFilename } = await import("../export/download");
    const act = await actionSheet("匯出", [
      { id: "png-page", label: "匯出本頁為 PNG" },
      { id: "pdf-page", label: "匯出本頁為 PDF" },
      { id: "pdf-all", label: "匯出整本為 PDF" },
    ]);
    if (!act) return;
    const base = safeFilename(this.notebook.name);
    try {
      if (act === "png-page") {
        await exportPagePng(
          this.page,
          this.strokes,
          this.background,
          `${base}-第${this.pageIndex + 1}頁.png`,
        );
        return;
      }
      const progress = progressDialog("正在匯出 PDF");
      try {
        if (act === "pdf-page") {
          progress.set("正在產生本頁…");
          await exportPagesPdf(
            [{ page: this.page, strokes: this.strokes, background: this.background }],
            `${base}-第${this.pageIndex + 1}頁.pdf`,
          );
        } else {
          const bundle = [];
          for (let i = 0; i < this.pages.length; i++) {
            progress.set(`正在產生第 ${i + 1} / ${this.pages.length} 頁…`);
            const page = this.pages[i];
            const strokes =
              page.id === this.page.id ? this.strokes : await listStrokes(this.db, page.id);
            const background =
              page.id === this.page.id ? this.background : await getBackground(this.db, page.id);
            bundle.push({ page, strokes, background });
          }
          await exportPagesPdf(bundle, `${base}.pdf`, (cur, total) => {
            progress.set(`正在寫入 PDF（${cur}/${total}）…`);
          });
        }
      } finally {
        progress.close();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "匯出失敗。";
      showToast(message, "error");
    }
  }

  private async moreMenu(): Promise<void> {
    const act = await actionSheet(this.notebook.name, [
      { id: "add", label: "在後面新增一頁" },
      { id: "clear", label: "清除本頁筆跡" },
      { id: "delete", label: "刪除此頁", danger: true },
      { id: "fit", label: "符合頁面大小" },
    ]);
    if (act === "add") await this.addPage();
    if (act === "clear") await this.clearPage();
    if (act === "delete") await this.deleteCurrentPage();
    if (act === "fit") this.fitAndRedraw();
  }

  private async clearPage(): Promise<void> {
    if (!this.strokes.length) return;
    const ok = await confirmDialog({
      title: "清除本頁筆跡？",
      message: "此頁上的手寫會被清除，可用復原來撤銷。",
      confirmLabel: "清除",
      danger: true,
    });
    if (!ok) return;
    const removed = this.strokes.slice();
    this.strokes = [];
    this.history.push({ type: "remove", pageId: this.page.id, strokes: removed });
    this.redrawInk();
    await deleteStrokes(this.db, removed.map((s) => s.id));
    await touchNotebook(this.db, this.notebookId);
    this.syncHistoryButtons();
  }

  private async undo(): Promise<void> {
    const peek = this.history.peekUndo();
    if (!peek) return;
    if (peek.pageId !== this.page.id) {
      const idx = this.pages.findIndex((p) => p.id === peek.pageId);
      if (idx >= 0) await this.loadPage(idx, true);
    }
    const action = this.history.undo(this.strokes);
    if (!action) return;
    await this.persistHistory(action, "undo");
    this.redrawInk();
    this.syncHistoryButtons();
  }

  private async redo(): Promise<void> {
    const peek = this.history.peekRedo();
    if (!peek) return;
    if (peek.pageId !== this.page.id) {
      const idx = this.pages.findIndex((p) => p.id === peek.pageId);
      if (idx >= 0) await this.loadPage(idx, true);
    }
    const action = this.history.redo(this.strokes);
    if (!action) return;
    await this.persistHistory(action, "redo");
    this.redrawInk();
    this.syncHistoryButtons();
  }

  private async persistHistory(action: HistoryAction, dir: "undo" | "redo"): Promise<void> {
    if (action.type === "add") {
      if (dir === "undo") await deleteStrokes(this.db, [action.stroke.id]);
      else await putStroke(this.db, action.stroke);
    } else if (action.type === "remove") {
      if (dir === "undo") {
        for (const stroke of action.strokes) await putStroke(this.db, stroke);
      } else {
        await deleteStrokes(
          this.db,
          action.strokes.map((stroke) => stroke.id),
        );
      }
    } else if (dir === "undo") {
      await deleteStrokes(
        this.db,
        action.added.map((stroke) => stroke.id),
      );
      for (const stroke of action.removed) await putStroke(this.db, stroke);
    } else {
      await deleteStrokes(
        this.db,
        action.removed.map((stroke) => stroke.id),
      );
      for (const stroke of action.added) await putStroke(this.db, stroke);
    }
    await touchNotebook(this.db, this.notebookId);
  }
}

function sameStrokeRefs(next: Stroke[], current: Stroke[]): boolean {
  if (next.length !== current.length) return false;
  for (let i = 0; i < next.length; i++) {
    if (next[i] !== current[i]) return false;
  }
  return true;
}

const ERASER_RADIUS_STORAGE_KEY = "freenotes-eraser-radius";

function readEraserRadius(): number {
  try {
    return eraserRadiusFromStorage(localStorage.getItem(ERASER_RADIUS_STORAGE_KEY));
  } catch {
    return ERASER_RADII[1];
  }
}

function writeEraserRadius(radius: number): void {
  try {
    localStorage.setItem(ERASER_RADIUS_STORAGE_KEY, String(radius));
  } catch {
    /* private mode or a full quota: the in-memory radius still applies */
  }
}

function toolButton(tool: Tool, label: string): string {
  const name = tool === "highlighter" ? "highlighter" : tool;
  return `<button type="button" class="tool-btn" data-tool="${tool}" aria-label="${label}">${icon(name as "pen" | "highlighter" | "eraser")}<span class="tool-label">${label}</span></button>`;
}
