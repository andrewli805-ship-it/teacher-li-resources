import { icon } from "./icons";

export type A2hsKind = "hidden" | "installable" | "inapp" | "iphone" | "ipad" | "android" | "desktop";

export type TutorialKind = Exclude<A2hsKind, "hidden" | "installable">;

export type InstallOutcome = "accepted" | "dismissed" | "failed";

export interface InstallPromptEvent {
  prompt: () => Promise<void> | void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" } | undefined>;
}

export interface A2hsSignals {
  ua: string;
  maxTouchPoints: number;
  standalone: boolean;
  installable: boolean;
  installed: boolean;
}

export interface A2hsButtonModel {
  hidden: boolean;
  label: string;
  hint: string;
  opensDialog: boolean;
}

const IN_APP_UA =
  /Instagram|WhatsApp|(?:^|[^\w])Line\/|FBAN|FBAV|FB_IAB|MicroMessenger|musical_ly|TikTok|BytedanceWebview|Snapchat|;\s*wv\)/i;

const IOS_NON_SAFARI = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA\/|OPT\//i;

const IPHONE_HINT = "此按鈕只顯示步驟，不會直接安裝。請在 Safari 選單完成。";
const MANUAL_HINT = "此按鈕只顯示步驟；請在瀏覽器選單完成安裝。";
const INAPP_HINT = "請先用 Safari 或 Chrome 開啟本頁，此按鈕無法在這裡安裝。";
const INSTALL_HINT = "會開啟系統安裝提示。";
const HOW_TO_LABEL = "如何加到主畫面";
const INSTALL_LABEL = "加到主畫面";

const CLOSING =
  "加入後會避開瀏海與主畫面指示器。第一次成功載入後，應用程式外殼與已儲存的筆記可離線使用。";

let deferred: (Event & InstallPromptEvent) | null = null;
let installedThisSession = false;
let promptBusy = false;
let bound = false;
let closeActiveDialog: (() => void) | null = null;
let detachLibrary: (() => void) | null = null;
const subscribers = new Set<() => void>();

function emit(): void {
  subscribers.forEach((fn) => fn());
}

export function classifyA2hs(input: A2hsSignals): A2hsKind {
  if (input.standalone || input.installed) return "hidden";
  const ios = isIos(input.ua, input.maxTouchPoints);
  // iOS has no one-tap install. A stashed prompt must not change the iPhone/iPad button.
  if (input.installable && !ios) return "installable";
  // In-app browsers win over the device tutorials so an iPhone inside Instagram
  // does not get the Safari tab-bar diagram.
  if (IN_APP_UA.test(input.ua)) return "inapp";
  if (ios) return isIpad(input.ua, input.maxTouchPoints) ? "ipad" : "iphone";
  if (/Android/i.test(input.ua)) return "android";
  return "desktop";
}

export function a2hsButtonModel(kind: A2hsKind): A2hsButtonModel {
  switch (kind) {
    case "hidden":
      return { hidden: true, label: "", hint: "", opensDialog: false };
    case "installable":
      return { hidden: false, label: INSTALL_LABEL, hint: INSTALL_HINT, opensDialog: false };
    case "iphone":
    case "ipad":
      return { hidden: false, label: HOW_TO_LABEL, hint: IPHONE_HINT, opensDialog: true };
    case "inapp":
      return { hidden: false, label: HOW_TO_LABEL, hint: INAPP_HINT, opensDialog: true };
    case "android":
    case "desktop":
      return { hidden: false, label: HOW_TO_LABEL, hint: MANUAL_HINT, opensDialog: true };
  }
}

export function shouldWarnOpenInSafari(ua: string): boolean {
  return IOS_NON_SAFARI.test(ua);
}

export function isStandaloneApp(win: Pick<Window, "matchMedia" | "navigator"> = window): boolean {
  const nav = win.navigator as Navigator & { standalone?: boolean };
  return (
    win.matchMedia("(display-mode: standalone)").matches ||
    win.matchMedia("(display-mode: fullscreen)").matches ||
    nav.standalone === true
  );
}

export function currentA2hsKind(): A2hsKind {
  return classifyA2hs({
    ua: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone: isStandaloneApp(),
    installable: deferred !== null,
    installed: installedThisSession,
  });
}

export async function runInstallPrompt(event: InstallPromptEvent | null): Promise<InstallOutcome> {
  if (!event) return "failed";
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice?.outcome === "accepted") return "accepted";
    if (choice?.outcome === "dismissed") return "dismissed";
    return "failed";
  } catch {
    return "failed";
  }
}

export function tutorialForFailedInstall(): TutorialKind {
  return "android";
}

function isIos(ua: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && maxTouchPoints > 1;
}

function isIpad(ua: string, maxTouchPoints: number): boolean {
  if (/iPad/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && maxTouchPoints > 1;
}

export function bindA2hsInstallEvents(): void {
  if (bound || typeof window === "undefined") return;
  bound = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as Event & InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installedThisSession = true;
    deferred = null;
    emit();
  });
  const onMode = () => emit();
  window.matchMedia("(display-mode: standalone)").addEventListener?.("change", onMode);
  window.matchMedia("(display-mode: fullscreen)").addEventListener?.("change", onMode);
}

function subscribe(listener: () => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

async function promptToInstall(): Promise<InstallOutcome> {
  const event = deferred;
  if (!event) return "failed";
  deferred = null;
  const result = await runInstallPrompt(event);
  if (result === "accepted") installedThisSession = true;
  emit();
  return result;
}

export function a2hsControlHtml(): string {
  const kind = currentA2hsKind();
  const model = a2hsButtonModel(kind);
  const hidden = model.hidden ? " hidden" : "";
  const popup = model.opensDialog ? ' aria-haspopup="dialog" aria-expanded="false"' : "";
  return `
    <button type="button" class="btn a2hs-btn" data-act="a2hs" data-a2hs-kind="${kind}" aria-describedby="a2hs-hint"${popup}${hidden}>
      ${icon("homePlus")}<span class="a2hs-label">${model.label}</span>
    </button>
    <p class="a2hs-hint" id="a2hs-hint"${hidden}>${model.hint}</p>`;
}

export function mountLibraryA2hs(root: HTMLElement): void {
  detachLibrary?.();
  const button = root.querySelector<HTMLButtonElement>("[data-act=a2hs]");
  const hint = root.querySelector<HTMLElement>("#a2hs-hint");
  if (!button || !hint) {
    detachLibrary = null;
    return;
  }
  const sync = () => applyA2hs(button, hint);
  sync();
  detachLibrary = subscribe(sync);
  button.addEventListener("click", () => {
    void onA2hsClick(button);
  });
}

function applyA2hs(button: HTMLButtonElement, hint: HTMLElement): void {
  if (!button.isConnected) return;
  const kind = currentA2hsKind();
  const model = a2hsButtonModel(kind);
  button.dataset.a2hsKind = kind;
  button.hidden = model.hidden;
  hint.hidden = model.hidden;
  const label = button.querySelector(".a2hs-label");
  if (label && label.textContent !== model.label) label.textContent = model.label;
  if (hint.textContent !== model.hint) hint.textContent = model.hint;
  if (model.hidden) {
    closeActiveDialog?.();
    button.removeAttribute("aria-haspopup");
    button.removeAttribute("aria-expanded");
    return;
  }
  if (model.opensDialog) {
    button.setAttribute("aria-haspopup", "dialog");
    const open = document.querySelector(".a2hs-overlay") !== null;
    button.setAttribute("aria-expanded", open ? "true" : "false");
  } else {
    button.removeAttribute("aria-haspopup");
    button.removeAttribute("aria-expanded");
  }
}

async function onA2hsClick(button: HTMLButtonElement): Promise<void> {
  const kind = currentA2hsKind();
  if (kind === "hidden" || promptBusy) return;
  if (kind === "installable") {
    promptBusy = true;
    try {
      const result = await promptToInstall();
      if (result === "failed") openA2hsDialog(tutorialForFailedInstall(), button);
    } finally {
      promptBusy = false;
    }
    return;
  }
  openA2hsDialog(kind, button, {
    iosNonSafari: kind === "iphone" && shouldWarnOpenInSafari(navigator.userAgent),
  });
}

export function tutorialCopyHtml(kind: TutorialKind, opts: { iosNonSafari?: boolean } = {}): string {
  switch (kind) {
    case "iphone":
      return [
        lead("這個按鈕不會直接安裝。請用 Safari 的選單完成下列步驟。"),
        opts.iosNonSafari ? lead("請先用 Safari 開啟本頁，再依圖操作。") : "",
        diagramIphoneTabbar(),
        diagramIphoneMenu(),
        steps([
          "點 Safari 底部列<strong>右下角的「⋯」</strong>（三個點）。底欄沒有獨立的分享圖示。",
          "在選單中點「分享」。若已經看到「加到主畫面」，可以現在就點。",
          "若先點了「分享」，請在列表向下滑，再點「加到主畫面」（有些裝置寫成「加至主畫面」）。若看不到此項，滑到列表最下面，點「編輯動作」，把它加進去。",
          "名稱確認為 Freenotes 後，點「加入」。若出現「開啟為網頁 App」，請保持開啟。",
          "回到主畫面，點 Freenotes 圖示打開。必須從主畫面圖示進入，才會全螢幕；只在 Safari 分頁使用，不會變成獨立 App。",
        ]),
        `<p>${CLOSING}</p>`,
      ].join("");
    case "ipad":
      return [
        lead("這個按鈕不會直接安裝。請用 Safari 頂部工具列完成下列步驟。"),
        diagramIpadToolbar(),
        steps([
          "點畫面<strong>頂部工具列</strong>的分享按鈕（方框向上箭嘴）。",
          "在選單中選擇「加到主畫面」（或「加至主畫面」）。",
          "名稱確認為 Freenotes 後，點「加入」。若出現「開啟為網頁 App」，請保持開啟。",
          "回到主畫面，點 Freenotes 圖示打開，才會全螢幕。",
        ]),
        note("若頂部沒有分享按鈕（精簡佈局），改點工具列的「⋯」，再選「分享」或「加到主畫面」。"),
        `<p>${CLOSING}</p>`,
      ].join("");
    case "android":
      return [
        lead("這個按鈕不會直接安裝。請用 Chrome 的選單完成下列步驟。"),
        diagramAndroidMenu(),
        steps([
          "點 Chrome 右上角「⋮」（三個直向點）。",
          "選擇「安裝應用程式」或「加到主畫面」（用詞因版本而異）。",
          "確認安裝後，從主畫面或應用程式列表打開 Freenotes，才會全螢幕。",
        ]),
        note("若選單暫時沒有安裝選項，請等頁面載入完成後再試，或重新整理後再打開此說明。請用 Chrome 開啟本頁。"),
      ].join("");
    case "inapp":
      return [
        lead("這個按鈕不會直接安裝。請先離開此預覽，改用瀏覽器開啟。"),
        steps([
          "用 iPhone 或 iPad 的 <strong>Safari</strong>，或 Android 的 <strong>Chrome</strong>，開啟本頁。",
          "若在 WhatsApp、Instagram 等 App 內開啟，請用「在瀏覽器開啟」或「在 Safari 開啟」（用詞依 App 而異）。",
          "再用該瀏覽器的選單把 Freenotes 加到主畫面。",
        ]),
      ].join("");
    case "desktop":
      return [
        lead("這個按鈕不會直接安裝。電腦瀏覽器可用來測試書寫，但加到主畫面請改用手機或平板。"),
        steps([
          "iPhone 或 iPad：用 Safari 開啟本頁，再依裝置說明，從瀏覽器選單加入。",
          "Android：用 Chrome 開啟本頁，再用選單安裝，或待系統提示出現。",
        ]),
      ].join("");
  }
}

export function a2hsDialogHtml(kind: TutorialKind, opts: { iosNonSafari?: boolean } = {}): string {
  return `
    <div class="dialog a2hs-dialog" id="a2hs-dialog" role="dialog" aria-modal="true" aria-labelledby="a2hs-title">
      <h2 id="a2hs-title">加到主畫面</h2>
      <div class="a2hs-body">
        <div class="a2hs-copy">${tutorialCopyHtml(kind, opts)}</div>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn primary" data-act="close">知道了</button>
      </div>
    </div>`;
}

export function openA2hsDialog(
  kind: TutorialKind,
  returnFocus: HTMLElement,
  opts: { iosNonSafari?: boolean } = {},
): void {
  if (isStandaloneApp() || installedThisSession) return;
  closeActiveDialog?.();
  const overlay = document.createElement("div");
  overlay.className = "overlay a2hs-overlay";
  overlay.innerHTML = a2hsDialogHtml(kind, opts);
  const closeBtn = overlay.querySelector<HTMLButtonElement>('[data-act="close"]')!;
  const close = () => {
    document.removeEventListener("keydown", onKey);
    overlay.remove();
    if (closeActiveDialog === close) closeActiveDialog = null;
    if (returnFocus.isConnected) {
      const model = a2hsButtonModel(currentA2hsKind());
      if (model.opensDialog) returnFocus.setAttribute("aria-expanded", "false");
      else returnFocus.removeAttribute("aria-expanded");
      returnFocus.focus();
    }
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      closeBtn.focus();
    }
  };
  closeActiveDialog = close;
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.append(overlay);
  if (returnFocus.isConnected) returnFocus.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => closeBtn.focus());
}

function lead(text: string): string {
  return `<p class="a2hs-lead">${text}</p>`;
}

function note(text: string): string {
  return `<p class="a2hs-note">${text}</p>`;
}

function steps(items: string[]): string {
  return `<ol>${items.map((item) => `<li>${item}</li>`).join("")}</ol>`;
}

const SHARE_ICON = `<svg class="a2hs-share" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7 11v8h10v-8"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 15V5"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m8 8 4-4 4 4"/></svg>`;

const PLUS_ICON = `<svg class="a2hs-plus" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 8v8M8 12h8"/></svg>`;

const BACK_ICON = `<svg class="a2hs-back" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M14 6 8 12l6 6"/></svg>`;

const TABS_ICON = `<svg class="a2hs-tabs" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="5" width="12" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="4" y="9" width="12" height="10" rx="2" fill="#ece7df" stroke="currentColor" stroke-width="1.8"/></svg>`;

function diagramIphoneTabbar(): string {
  return `
    <div class="a2hs-art" data-art="iphone-tabbar" aria-hidden="true">
      <p class="a2hs-art-title">iPhone Safari 底部列</p>
      <p class="a2hs-art-sub">沒有獨立分享圖示，請點右下角「⋯」</p>
      <div class="a2hs-bar a2hs-bar-pointed">
        <div class="a2hs-bar-item">${BACK_ICON}<span class="a2hs-cap">返回</span></div>
        <div class="a2hs-bar-item a2hs-url-item">
          <span class="a2hs-url">rewli805-ship-it.github.io</span>
          <span class="a2hs-cap">網址</span>
        </div>
        <div class="a2hs-bar-item">${TABS_ICON}<span class="a2hs-cap">分頁</span></div>
        <div class="a2hs-bar-item a2hs-more-item">
          <span class="a2hs-callout">點這裡「⋯」</span>
          <span class="a2hs-dotbtn"><i></i><i></i><i></i></span>
          <span class="a2hs-cap a2hs-cap-strong">⋯</span>
        </div>
      </div>
    </div>`;
}

function diagramIphoneMenu(): string {
  return `
    <div class="a2hs-art" data-art="iphone-menu" aria-hidden="true">
      <p class="a2hs-art-title">點「⋯」之後</p>
      <p class="a2hs-art-sub">先找「分享」；若已看到「加到主畫面」可直接點</p>
      <div class="a2hs-menu">
        <div class="a2hs-menu-row a2hs-menu-row-primary">
          <span class="a2hs-menu-ico">${SHARE_ICON}</span>
          <span class="a2hs-menu-name">分享</span>
          <span class="a2hs-menu-tag">建議這步</span>
        </div>
        <div class="a2hs-menu-row">
          <span class="a2hs-menu-ico">${PLUS_ICON}</span>
          <span class="a2hs-menu-name">加到主畫面</span>
          <span class="a2hs-menu-tag a2hs-menu-tag-soft">有就直接點</span>
        </div>
        <p class="a2hs-art-note">選「分享」後，在列表向下滑再選「加到主畫面」</p>
        <p class="a2hs-art-note">系統可能寫成「加至主畫面」，兩者皆可</p>
      </div>
    </div>`;
}

function diagramIpadToolbar(): string {
  return `
    <div class="a2hs-art" data-art="ipad-toolbar" aria-hidden="true">
      <p class="a2hs-art-title">iPad Safari 頂部工具列</p>
      <p class="a2hs-art-sub">分享按鈕在頂部，不在底部列</p>
      <div class="a2hs-bar a2hs-bar-ipad a2hs-bar-pointed">
        <div class="a2hs-bar-item">${BACK_ICON}</div>
        <div class="a2hs-bar-item a2hs-url-item"><span class="a2hs-url">rewli805-ship-it.github.io</span></div>
        <div class="a2hs-bar-item">${TABS_ICON}</div>
        <div class="a2hs-bar-item a2hs-more-item"><span class="a2hs-callout">點「分享」</span><span class="a2hs-share-btn">${SHARE_ICON}</span></div>
      </div>
      <p class="a2hs-art-foot">之後在選單選擇「加到主畫面」，再點「加入」</p>
      <p class="a2hs-art-note">若頂部沒有分享按鈕，改點「⋯」，再選「分享」或「加到主畫面」</p>
    </div>`;
}

function diagramAndroidMenu(): string {
  return `
    <div class="a2hs-art" data-art="android-menu" aria-hidden="true">
      <p class="a2hs-art-title">Android Chrome（尚未跳出系統提示時）</p>
      <p class="a2hs-art-sub">點右上角「⋮」，再選安裝或加到主畫面</p>
      <div class="a2hs-chrome">
        <span class="a2hs-url">github.io/teacher-li-resources/…</span>
        <span class="a2hs-dotbtn vertical"><i></i><i></i><i></i></span>
      </div>
      <div class="a2hs-android-lower">
        <div class="a2hs-android-notes">
          <p class="a2hs-art-note">選單用詞可能是其中一個</p>
          <p class="a2hs-art-note">安裝後請從主畫面圖示打開，才會全螢幕</p>
        </div>
        <div class="a2hs-android-menu">
          <p class="a2hs-android-item a2hs-android-item-strong">安裝應用程式</p>
          <p class="a2hs-android-item">加到主畫面</p>
        </div>
      </div>
    </div>`;
}
