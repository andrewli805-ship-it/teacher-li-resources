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
import { StrokeHistory } from "../ink/history";
import { simplifyPoints, strokeHitsPath } from "../ink/geometry";
import { drawStroke, renderStrokes, resizeCanvas } from "../ink/render";
import {
  A4_HEIGHT,
  A4_WIDTH,
  HIGHLIGHTER_WIDTHS,
  PEN_WIDTHS,
  PRESET_COLORS,
  type BackgroundRecord,
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
  private view: ViewTransform = { x: 0, y: 0, scale: 1 };
  private pointers = new Map<number, { x: number; y: number; type: string }>();
  private ignoreUntilUp = new Set<number>();
  private drawingId: number | null = null;
  private currentStroke: Stroke | null = null;
  private eraserPath: Point[] = [];
  private erased: Stroke[] = [];
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
    return this.tool === "highlighter" ? HIGHLIGHTER_WIDTHS : PEN_WIDTHS;
  }

  private get width(): number {
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
        <button type="button" class="dock-btn" data-act="palette" aria-label="顏色"><span class="dock-color" data-role="dock-color"></span><span>顏色</span></button>
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
  }

  private async onAction(btn: HTMLElement): Promise<void> {
    const tool = btn.dataset.tool as Tool | undefined;
    if (tool) {
      this.tool = tool;
      this.syncToolButtons();
      this.renderWidths();
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
    const dctx = resizeCanvas(draft, width, height, q);
    dctx.clearRect(0, 0, width, height);
  }

  private renderDraft(): void {
    const draft = this.qs<HTMLCanvasElement>("[data-role=draft]");
    const ctx = draft.getContext("2d");
    if (!ctx) return;
    const q = this.quality();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    ctx.setTransform(dpr * q, 0, 0, dpr * q, 0, 0);
    ctx.clearRect(0, 0, this.page.width, this.page.height);
    if (this.currentStroke) drawStroke(ctx, this.currentStroke);
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
    const pop = this.root.querySelector("[data-role=palette-pop]");
    if (pop && !pop.hasAttribute("hidden")) {
      pop.innerHTML = host.innerHTML + this.widthChips();
    }
    const dock = this.root.querySelector("[data-role=dock-color]") as HTMLElement | null;
    if (dock) dock.style.background = this.color;
  }

  private widthChips(): string {
    return `<div class="widths">${this.widths
      .map((w, i) => {
        const labels = ["細", "中", "粗"];
        const on = w === this.width;
        return `<button type="button" class="width-chip ${on ? "active" : ""}" data-width="${w}" aria-pressed="${on}">${labels[i]}</button>`;
      })
      .join("")}</div>`;
  }

  private renderWidths(): void {
    const host = this.root.querySelector("[data-role=widths]");
    if (host) host.innerHTML = this.widthChips();
  }

  private syncToolButtons(): void {
    this.root.querySelectorAll<HTMLElement>("[data-tool]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === this.tool);
      btn.setAttribute("aria-pressed", String(btn.dataset.tool === this.tool));
    });
    this.root.classList.toggle("tool-eraser", this.tool === "eraser");
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
      pop.innerHTML = `${this.qs("[data-role=colors]").innerHTML}${this.widthChips()}`;
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
      this.cancelStroke();
      this.beginPinch();
      return;
    }
    this.beginStroke(e);
  }

  private pointerMove(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (this.ignoreUntilUp.has(e.pointerId)) return;
    if (this.pinching) {
      e.preventDefault();
      this.updatePinch();
      return;
    }
    if (this.drawingId === e.pointerId) {
      e.preventDefault();
      const events =
        typeof e.getCoalescedEvents === "function" && e.getCoalescedEvents().length
          ? e.getCoalescedEvents()
          : [e];
      for (const ev of events) this.appendPoint(ev);
      if (this.tool === "eraser") this.applyEraser();
      else this.renderDraft();
    }
  }

  private pointerUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    this.ignoreUntilUp.delete(e.pointerId);
    if (e.pointerType === "pen" && ![...this.pointers.values()].some((p) => p.type === "pen")) {
      this.penActive = false;
    }
    if (this.drawingId === e.pointerId) {
      void this.endStroke();
    }
    if (this.pinching && this.livePointers().length < 2) {
      this.endPinch();
      for (const [id] of this.pointers) this.ignoreUntilUp.add(id);
      this.redrawInk();
    }
  }

  private livePointers(): [number, { x: number; y: number; type: string }][] {
    return [...this.pointers.entries()].filter(([id]) => !this.ignoreUntilUp.has(id));
  }

  private beginPinch(): void {
    const pts = this.livePointers().map(([, p]) => p);
    if (pts.length < 2) return;
    this.pinching = true;
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
      this.eraserPath = [point];
      this.erased = [];
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
    if (this.tool === "eraser") {
      this.eraserPath.push(point);
      return;
    }
    if (!this.currentStroke) return;
    const last = this.currentStroke.points[this.currentStroke.points.length - 1];
    if (last && Math.hypot(last.x - point.x, last.y - point.y) < 0.35) return;
    this.currentStroke.points.push(point);
  }

  private applyEraser(): void {
    const hit = this.strokes.filter((s) => strokeHitsPath(s, this.eraserPath, 10));
    if (!hit.length) return;
    const ids = new Set(hit.map((s) => s.id));
    this.strokes = this.strokes.filter((s) => !ids.has(s.id));
    this.erased.push(...hit);
    this.eraserPath = this.eraserPath.slice(-2);
    this.redrawInk();
  }

  private cancelStroke(): void {
    if (this.erased.length) {
      this.strokes.push(...this.erased);
      this.erased = [];
      this.redrawInk();
    }
    this.currentStroke = null;
    this.eraserPath = [];
    this.drawingId = null;
    this.renderDraft();
  }

  private async endStroke(): Promise<void> {
    const drawing = this.currentStroke;
    const erased = this.erased.slice();
    this.currentStroke = null;
    this.eraserPath = [];
    this.erased = [];
    this.drawingId = null;

    if (this.tool === "eraser") {
      this.renderDraft();
      if (!erased.length) return;
      this.history.push({ type: "remove", pageId: this.page.id, strokes: erased });
      await deleteStrokes(this.db, erased.map((s) => s.id));
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

  private async persistHistory(
    action: import("../types").HistoryAction,
    dir: "undo" | "redo",
  ): Promise<void> {
    if (action.type === "add") {
      if (dir === "undo") await deleteStrokes(this.db, [action.stroke.id]);
      else await putStroke(this.db, action.stroke);
    } else if (dir === "undo") {
      for (const stroke of action.strokes) await putStroke(this.db, stroke);
    } else {
      await deleteStrokes(this.db, action.strokes.map((s) => s.id));
    }
    await touchNotebook(this.db, this.notebookId);
  }
}

function toolButton(tool: Tool, label: string): string {
  const name = tool === "highlighter" ? "highlighter" : tool;
  return `<button type="button" class="tool-btn" data-tool="${tool}" aria-label="${label}">${icon(name as "pen" | "highlighter" | "eraser")}<span class="tool-label">${label}</span></button>`;
}
