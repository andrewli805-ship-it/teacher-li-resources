import { icon } from "./icons";

export function showToast(message: string, kind: "info" | "error" = "info"): void {
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = `toast toast-${kind}`;
  toast.textContent = message;
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 280);
  }, 2800);
}

export function confirmDialog(options: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = openOverlay();
    overlay.innerHTML = `
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <h2 id="dlg-title">${escapeHtml(options.title)}</h2>
        <p>${escapeHtml(options.message)}</p>
        <div class="dialog-actions">
          <button type="button" class="btn ghost" data-act="cancel">取消</button>
          <button type="button" class="btn ${options.danger ? "danger" : "primary"}" data-act="ok">
            ${escapeHtml(options.confirmLabel ?? "確定")}
          </button>
        </div>
      </div>`;
    const finish = (value: boolean) => {
      overlay.remove();
      resolve(value);
    };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) finish(false);
    });
    overlay.querySelector('[data-act="cancel"]')?.addEventListener("click", () => finish(false));
    overlay.querySelector('[data-act="ok"]')?.addEventListener("click", () => finish(true));
  });
}

export function promptDialog(options: {
  title: string;
  label?: string;
  value?: string;
  confirmLabel?: string;
}): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = openOverlay();
    overlay.innerHTML = `
      <form class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <h2 id="dlg-title">${escapeHtml(options.title)}</h2>
        <label class="field">
          <span>${escapeHtml(options.label ?? "名稱")}</span>
          <input type="text" name="value" maxlength="80" value="${escapeHtml(options.value ?? "")}" required />
        </label>
        <div class="dialog-actions">
          <button type="button" class="btn ghost" data-act="cancel">取消</button>
          <button type="submit" class="btn primary">${escapeHtml(options.confirmLabel ?? "儲存")}</button>
        </div>
      </form>`;
    const form = overlay.querySelector("form")!;
    const input = form.querySelector("input")!;
    const finish = (value: string | null) => {
      overlay.remove();
      resolve(value);
    };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) finish(null);
    });
    form.querySelector('[data-act="cancel"]')?.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const next = input.value.trim();
      if (next) finish(next);
    });
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  });
}

export function actionSheet(
  title: string,
  actions: { id: string; label: string; danger?: boolean }[],
): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = openOverlay();
    overlay.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-handle"></div>
        <h2>${escapeHtml(title)}</h2>
        ${actions
          .map(
            (a) =>
              `<button type="button" class="sheet-item ${a.danger ? "danger" : ""}" data-id="${escapeHtml(a.id)}">${escapeHtml(a.label)}</button>`,
          )
          .join("")}
        <button type="button" class="sheet-item cancel" data-id="">取消</button>
      </div>`;
    const finish = (value: string | null) => {
      overlay.remove();
      resolve(value);
    };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) finish(null);
    });
    overlay.querySelectorAll("[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = (btn as HTMLElement).dataset.id ?? "";
        finish(id || null);
      });
    });
  });
}

export function progressDialog(title: string): {
  set: (message: string) => void;
  close: () => void;
} {
  const overlay = openOverlay();
  overlay.innerHTML = `
    <div class="dialog" role="status" aria-live="polite">
      <h2>${escapeHtml(title)}</h2>
      <p class="progress-msg">準備中…</p>
      <div class="progress-bar"><span></span></div>
    </div>`;
  const msg = overlay.querySelector(".progress-msg") as HTMLElement;
  return {
    set(message: string) {
      msg.textContent = message;
    },
    close() {
      overlay.remove();
    },
  };
}

function openOverlay(): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  document.body.append(overlay);
  return overlay;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { icon };
