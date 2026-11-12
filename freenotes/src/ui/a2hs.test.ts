import { describe, expect, it } from "vitest";
import {
  a2hsButtonModel,
  a2hsDialogHtml,
  classifyA2hs,
  isStandaloneApp,
  runInstallPrompt,
  shouldWarnOpenInSafari,
  tutorialCopyHtml,
  tutorialForFailedInstall,
  type A2hsSignals,
  type InstallPromptEvent,
} from "./a2hs";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.108 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function signals(partial: Partial<A2hsSignals> & Pick<A2hsSignals, "ua">): A2hsSignals {
  return {
    maxTouchPoints: 0,
    standalone: false,
    installable: false,
    installed: false,
    ...partial,
  };
}

describe("classifyA2hs", () => {
  it("hides the entry when the app is already standalone or installed", () => {
    expect(classifyA2hs(signals({ ua: IPHONE, standalone: true, installable: true }))).toBe("hidden");
    expect(classifyA2hs(signals({ ua: ANDROID, installed: true }))).toBe("hidden");
  });

  it("uses the system prompt on Android and desktop only after beforeinstallprompt", () => {
    expect(classifyA2hs(signals({ ua: ANDROID, installable: true }))).toBe("installable");
    expect(classifyA2hs(signals({ ua: DESKTOP, installable: true }))).toBe("installable");
    expect(classifyA2hs(signals({ ua: IPHONE, installable: true }))).toBe("iphone");
    expect(classifyA2hs(signals({ ua: IPAD, installable: true }))).toBe("ipad");
  });

  it("treats iPhone, iPad, and touch Macintoshes as the matching tutorial", () => {
    expect(classifyA2hs(signals({ ua: IPHONE }))).toBe("iphone");
    expect(classifyA2hs(signals({ ua: IPHONE_CHROME }))).toBe("iphone");
    expect(classifyA2hs(signals({ ua: IPAD, maxTouchPoints: 5 }))).toBe("ipad");
    expect(classifyA2hs(signals({ ua: IPAD_DESKTOP, maxTouchPoints: 5 }))).toBe("ipad");
    expect(classifyA2hs(signals({ ua: IPAD_DESKTOP, maxTouchPoints: 0 }))).toBe("desktop");
  });

  it("prefers the in-app browser dialog over Safari or Chrome diagrams", () => {
    expect(classifyA2hs(signals({ ua: `${IPHONE} Instagram 300.0.0` }))).toBe("inapp");
    expect(classifyA2hs(signals({ ua: `${IPHONE} WhatsApp/2.24.1` }))).toBe("inapp");
    expect(classifyA2hs(signals({ ua: `${IPHONE} Line/14.0.0` }))).toBe("inapp");
    expect(classifyA2hs(signals({ ua: `${IPHONE} [FBAN/FBIOS;FBAV/400.0.0;]` }))).toBe("inapp");
    expect(classifyA2hs(signals({ ua: `${ANDROID} MicroMessenger/8.0.0` }))).toBe("inapp");
    expect(classifyA2hs(signals({ ua: `${ANDROID}; wv) AppleWebKit` }))).toBe("inapp");
  });

  it("keeps a manual tutorial when no install prompt is available", () => {
    expect(classifyA2hs(signals({ ua: ANDROID }))).toBe("android");
    expect(classifyA2hs(signals({ ua: DESKTOP }))).toBe("desktop");
  });
});

describe("a2hsButtonModel", () => {
  it("uses the spec labels and hints", () => {
    expect(a2hsButtonModel("iphone")).toEqual({
      hidden: false,
      label: "如何加到主畫面",
      hint: "此按鈕只顯示步驟，不會直接安裝。請在 Safari 選單完成。",
      opensDialog: true,
    });
    expect(a2hsButtonModel("ipad").hint).toBe(a2hsButtonModel("iphone").hint);
    expect(a2hsButtonModel("installable")).toEqual({
      hidden: false,
      label: "加到主畫面",
      hint: "會開啟系統安裝提示。",
      opensDialog: false,
    });
    expect(a2hsButtonModel("android").hint).toBe("此按鈕只顯示步驟；請在瀏覽器選單完成安裝。");
    expect(a2hsButtonModel("desktop").label).toBe("如何加到主畫面");
    expect(a2hsButtonModel("inapp").hint).toBe("請先用 Safari 或 Chrome 開啟本頁，此按鈕無法在這裡安裝。");
    expect(a2hsButtonModel("hidden").hidden).toBe(true);
  });
});

describe("tutorial copy", () => {
  it("shows the new iPhone tab bar and never the old share-button step", () => {
    const html = a2hsDialogHtml("iphone");
    const tab = html.slice(html.indexOf('data-art="iphone-tabbar"'), html.indexOf('data-art="iphone-menu"'));
    expect(tab).toContain("rewli805-ship-it.github.io");
    expect(tab).not.toContain("andrewli805");
    expect(tab).toContain("點這裡「⋯」");
    expect(tab).toContain("a2hs-dotbtn");
    expect(tab).not.toContain("vertical");
    expect(tab).not.toContain("a2hs-share");
    expect(html).toContain("右下角的「⋯」");
    expect(html).toContain("底欄沒有獨立的分享圖示");
    expect(html).toContain("必須從主畫面圖示進入，才會全螢幕");
    expect(html).toContain("data-art=\"iphone-menu\"");
    expect(html).toContain("建議這步");
    expect(html).toContain("有就直接點");
    expect(html).not.toContain("點分享按鈕");
    expect(html).not.toContain("請先用 Safari 開啟本頁，再依圖操作。");
    expect(html).toContain(">知道了<");
    expect(html).not.toContain("已安裝");
    expect(html).not.toContain("完成安裝");
  });

  it("tells iOS Chrome to open Safari before following the iPhone diagram", () => {
    expect(shouldWarnOpenInSafari(IPHONE)).toBe(false);
    expect(shouldWarnOpenInSafari(IPHONE_CHROME)).toBe(true);
    const html = tutorialCopyHtml("iphone", { iosNonSafari: true });
    expect(html).toContain("請先用 Safari 開啟本頁，再依圖操作。");
  });

  it("puts iPad share on the top toolbar and keeps the compact-layout note", () => {
    const html = tutorialCopyHtml("ipad");
    expect(html).toContain("data-art=\"ipad-toolbar\"");
    expect(html).not.toContain("data-art=\"iphone-tabbar\"");
    expect(html).toContain("a2hs-share");
    expect(html).toContain("點「分享」");
    expect(html).toContain("頂部工具列");
    expect(html).toContain("若頂部沒有分享按鈕（精簡佈局），改點工具列的「⋯」，再選「分享」或「加到主畫面」。");
    expect(html).toContain("rewli805-ship-it.github.io");
  });

  it("shows the Android overflow menu without pretending the app is installed", () => {
    const html = a2hsDialogHtml("android");
    expect(html).toContain("data-art=\"android-menu\"");
    expect(html).toContain("a2hs-dotbtn vertical");
    expect(html).toContain("安裝應用程式");
    expect(html).toContain("點 Chrome 右上角「⋮」（三個直向點）。");
    expect(html).not.toContain("a2hs-share");
    expect(html).not.toContain("rewli805-ship-it.github.io");
    expect(html).not.toContain("已安裝");
  });

  it("does not show the Safari tab bar inside an in-app browser", () => {
    const html = tutorialCopyHtml("inapp");
    expect(html).not.toContain("data-art=");
    expect(html).toContain("請先離開此預覽，改用瀏覽器開啟。");
    expect(html).toContain("WhatsApp、Instagram");
  });

  it("sends desktop browsers to a phone or tablet", () => {
    const html = tutorialCopyHtml("desktop");
    expect(html).toContain("電腦瀏覽器可用來測試書寫，但加到主畫面請改用手機或平板。");
    expect(html).not.toContain("data-art=");
  });
});

describe("install prompt", () => {
  it("reports acceptance, dismissal, and a blocked prompt", async () => {
    const accepted: InstallPromptEvent = {
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: "accepted" }),
    };
    const dismissed: InstallPromptEvent = {
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    };
    const blocked: InstallPromptEvent = {
      prompt: () => Promise.reject(new Error("blocked")),
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    };
    expect(await runInstallPrompt(accepted)).toBe("accepted");
    expect(await runInstallPrompt(dismissed)).toBe("dismissed");
    expect(await runInstallPrompt(blocked)).toBe("failed");
    expect(await runInstallPrompt(null)).toBe("failed");
    expect(tutorialForFailedInstall()).toBe("android");
  });
});

describe("isStandaloneApp", () => {
  it("treats standalone, fullscreen, and navigator.standalone as an installed app", () => {
    const fake = (standalone: boolean, fullscreen: boolean, nav: boolean) =>
      isStandaloneApp({
        matchMedia: (query: string) => ({
          matches: query.includes("fullscreen") ? fullscreen : standalone,
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
        }),
        navigator: { standalone: nav } as Navigator & { standalone?: boolean },
      });
    expect(fake(true, false, false)).toBe(true);
    expect(fake(false, true, false)).toBe(true);
    expect(fake(false, false, true)).toBe(true);
    expect(fake(false, false, false)).toBe(false);
  });
});
