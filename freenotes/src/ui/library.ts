import {
  createBlankNotebook,
  createImportedNotebook,
  deleteNotebookCascade,
  listNotebooks,
  listPages,
  putNotebook,
  type FreenotesDB,
} from "../db";
import { formatUpdated } from "../dates";
import { uid } from "../id";
import {
  A4_HEIGHT,
  A4_WIDTH,
  COVER_COLORS,
  type Notebook,
  type PaperTemplate,
} from "../types";
import { a2hsControlHtml, mountLibraryA2hs } from "./a2hs";
import { el } from "./dom";
import { icon } from "./icons";
import {
  actionSheet,
  confirmDialog,
  escapeHtml,
  progressDialog,
  promptDialog,
  showToast,
} from "./modals";

export async function renderLibrary(
  root: HTMLElement,
  db: FreenotesDB,
  openNotebook: (id: string) => void,
): Promise<void> {
  const notebooks = await listNotebooks(db);
  root.className = "app library-app";
  root.innerHTML = `
    <div class="lib-back-row">
      <a class="lib-back" href="../index.html" aria-label="返回程式區">‹ 返回程式區</a>
    </div>
    <header class="lib-header">
      <div class="brand">
        <img class="brand-mark" src="${import.meta.env.BASE_URL}icons/icon-192.png" alt="" width="36" height="36" />
        <div class="brand-copy">
          <h1>Freenotes</h1>
          <p class="tagline">手寫筆記，也可標註文件</p>
          ${a2hsControlHtml()}
        </div>
      </div>
      <div class="lib-actions">
        <button type="button" class="btn ghost" data-act="import">${icon("import")}匯入檔案</button>
        <button type="button" class="btn primary" data-act="new">${icon("plus")}新建筆記本</button>
      </div>
    </header>
    <main class="lib-main">
      ${
        notebooks.length === 0
          ? emptyState()
          : `<ul class="notebook-grid">${notebooks.map(cardHtml).join("")}</ul>`
      }
      <p class="lib-storage-note">筆記只存在這部裝置的瀏覽器，清除網站資料會一併刪除。</p>
    </main>
    <input type="file" class="sr-only" accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword" />
  `;

  const fileInput = root.querySelector("input[type=file]") as HTMLInputElement;
  mountLibraryA2hs(root);
  root.querySelector('[data-act="new"]')?.addEventListener("click", () => {
    void createNotebookFlow(db, root, openNotebook);
  });
  root.querySelector('[data-act="import"]')?.addEventListener("click", () => fileInput.click());
  root.querySelector("[data-empty-import]")?.addEventListener("click", () => fileInput.click());
  root.querySelector("[data-empty-new]")?.addEventListener("click", () => {
    void createNotebookFlow(db, root, openNotebook);
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (file) void importFlow(db, file, root, openNotebook);
  });

  root.querySelectorAll<HTMLElement>("[data-open]").forEach((card) => {
    card.addEventListener("click", () => openNotebook(card.dataset.open!));
  });
  root.querySelectorAll<HTMLElement>("[data-menu]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.menu!;
      const notebook = notebooks.find((n) => n.id === id);
      if (notebook) void notebookMenu(db, notebook, root, openNotebook);
    });
  });
}

function emptyState(): string {
  return `
    <section class="empty-lib">
      <div class="empty-illustration" aria-hidden="true">
        <span class="page-stack"></span>
        <span class="pen-stroke"></span>
      </div>
      <h2>從一頁空白紙開始</h2>
      <p>用手寫筆或手指在筆記本上書寫，也可以匯入 PDF、Word 或 Excel 再於文件上標註。</p>
      <div class="empty-actions">
        <button type="button" class="btn primary" data-empty-new>${icon("plus")}新建筆記本</button>
        <button type="button" class="btn ghost" data-empty-import>${icon("import")}匯入檔案</button>
      </div>
    </section>`;
}

function cardHtml(notebook: Notebook): string {
  const badge = sourceBadge(notebook);
  return `
    <li>
      <button type="button" class="nb-card" data-open="${notebook.id}">
        <span class="nb-cover" style="--cover:${notebook.coverColor}">
          <span class="nb-spine"></span>
          <span class="nb-paper"></span>
        </span>
        <span class="nb-meta">
          <span class="nb-name">${escapeHtml(notebook.name)}</span>
          <span class="nb-sub">${badge}${escapeHtml(formatUpdated(notebook.updatedAt))}</span>
        </span>
      </button>
      <button type="button" class="icon-btn nb-menu" data-menu="${notebook.id}" aria-label="筆記本選項">
        ${icon("more")}
      </button>
    </li>`;
}

function sourceBadge(notebook: Notebook): string {
  const label =
    notebook.sourceType === "pdf"
      ? "PDF"
      : notebook.sourceType === "word"
        ? "Word"
        : notebook.sourceType === "excel"
          ? "Excel"
          : "空白";
  return `<span class="badge">${label}</span>`;
}

async function notebookMenu(
  db: FreenotesDB,
  notebook: Notebook,
  root: HTMLElement,
  openNotebook: (id: string) => void,
): Promise<void> {
  const action = await actionSheet(notebook.name, [
    { id: "open", label: "開啟" },
    { id: "rename", label: "重新命名" },
    { id: "delete", label: "刪除筆記本", danger: true },
  ]);
  if (action === "open") openNotebook(notebook.id);
  if (action === "rename") {
    const name = await promptDialog({
      title: "重新命名",
      value: notebook.name,
      confirmLabel: "儲存",
    });
    if (name && name !== notebook.name) {
      notebook.name = name;
      notebook.updatedAt = Date.now();
      await putNotebook(db, notebook);
      await renderLibrary(root, db, openNotebook);
    }
  }
  if (action === "delete") {
    const ok = await confirmDialog({
      title: "刪除筆記本？",
      message: `「${notebook.name}」及其筆跡會從這部裝置移除，而且無法復原。`,
      confirmLabel: "刪除",
      danger: true,
    });
    if (ok) {
      await deleteNotebookCascade(db, notebook.id);
      showToast("已刪除筆記本。");
      await renderLibrary(root, db, openNotebook);
    }
  }
}

async function createNotebookFlow(
  db: FreenotesDB,
  _root: HTMLElement,
  openNotebook: (id: string) => void,
): Promise<void> {
  const result = await newNotebookDialog();
  if (!result) return;
  const now = Date.now();
  const notebook: Notebook = {
    id: uid(),
    name: result.name,
    coverColor: result.color,
    createdAt: now,
    updatedAt: now,
    paperTemplate: result.paper,
    sourceType: "blank",
  };
  const page = {
    id: uid(),
    notebookId: notebook.id,
    index: 0,
    width: A4_WIDTH,
    height: A4_HEIGHT,
    backgroundKind: "template" as const,
    paperTemplate: result.paper,
    label: "第 1 頁",
  };
  await createBlankNotebook(db, notebook, page);
  openNotebook(notebook.id);
}

function newNotebookDialog(): Promise<{
  name: string;
  paper: PaperTemplate;
  color: string;
} | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `
      <form class="dialog" role="dialog" aria-modal="true">
        <h2>新建筆記本</h2>
        <label class="field">
          <span>名稱</span>
          <input type="text" name="name" maxlength="80" value="無標題筆記本" required />
        </label>
        <fieldset class="field">
          <legend>紙張</legend>
          <div class="paper-picks">
            ${paperPick("blank", "空白", true)}
            ${paperPick("lined", "橫線", false)}
            ${paperPick("grid", "方格", false)}
          </div>
        </fieldset>
        <fieldset class="field">
          <legend>封面顏色</legend>
          <div class="color-picks">
            ${COVER_COLORS.map(
              (c, i) =>
                `<label class="cover-swatch"><input type="radio" name="color" value="${c}" ${i === 0 ? "checked" : ""} /><span style="background:${c}"></span></label>`,
            ).join("")}
          </div>
        </fieldset>
        <div class="dialog-actions">
          <button type="button" class="btn ghost" data-act="cancel">取消</button>
          <button type="submit" class="btn primary">建立</button>
        </div>
      </form>`;
    document.body.append(overlay);
    const form = overlay.querySelector("form")!;
    const finish = (value: { name: string; paper: PaperTemplate; color: string } | null) => {
      overlay.remove();
      resolve(value);
    };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) finish(null);
    });
    form.querySelector('[data-act="cancel"]')?.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = String(data.get("name") ?? "").trim() || "無標題筆記本";
      const paper = (String(data.get("paper") ?? "blank") || "blank") as PaperTemplate;
      const color = String(data.get("color") ?? COVER_COLORS[0]);
      finish({ name, paper, color });
    });
    const input = form.querySelector("input[name=name]") as HTMLInputElement;
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  });
}

function paperPick(value: PaperTemplate, label: string, checked: boolean): string {
  return `
    <label class="paper-pick">
      <input type="radio" name="paper" value="${value}" ${checked ? "checked" : ""} />
      <span class="paper-preview ${value}"></span>
      <span>${label}</span>
    </label>`;
}

async function importFlow(
  db: FreenotesDB,
  file: File,
  _root: HTMLElement,
  openNotebook: (id: string) => void,
): Promise<void> {
  const progress = progressDialog("匯入檔案");
  try {
    const { importFile } = await import("../import");
    const doc = await importFile(file, (cur, total, message) => {
      progress.set(total ? `${message}（${cur}/${total}）` : message);
    });
    progress.set("正在儲存筆記本…");
    const now = Date.now();
    const name = file.name.replace(/\.[^.]+$/, "") || "匯入的筆記本";
    const notebook: Notebook = {
      id: uid(),
      name,
      coverColor: COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)],
      createdAt: now,
      updatedAt: now,
      paperTemplate: "blank",
      sourceType: doc.sourceType,
      sourceName: doc.sourceName,
    };
    const pages = doc.pages.map((p, i) => ({
      id: uid(),
      notebookId: notebook.id,
      index: i,
      width: p.width,
      height: p.height,
      backgroundKind: p.backgroundKind,
      paperTemplate: "blank" as const,
      label: p.label ?? `第 ${i + 1} 頁`,
    }));
    const backgrounds = doc.pages.map((p, i) => {
      if (p.backgroundKind === "image" && p.image) {
        return { pageId: pages[i].id, kind: "image" as const, mime: p.mime, data: p.image };
      }
      return { pageId: pages[i].id, kind: "html" as const, data: p.html ?? "" };
    });
    await createImportedNotebook(db, notebook, pages, backgrounds);
    progress.close();
    showToast(`已匯入「${name}」，共 ${pages.length} 頁。`);
    openNotebook(notebook.id);
  } catch (err) {
    progress.close();
    const message = err instanceof Error ? err.message : `無法匯入「${file.name}」。`;
    showToast(message, "error");
  }
}

export async function notebookExists(db: FreenotesDB, id: string): Promise<boolean> {
  const pages = await listPages(db, id);
  return pages.length > 0;
}

export { el };
