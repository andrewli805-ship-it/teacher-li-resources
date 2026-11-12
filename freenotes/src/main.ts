import { registerSW } from "virtual:pwa-register";
import { openNotesDb } from "./db";
import "./styles.css";
import { mountApp } from "./ui/app";
import { bindA2hsInstallEvents } from "./ui/a2hs";

bindA2hsInstallEvents();
registerSW({ immediate: true });

async function boot(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) throw new Error("找不到應用程式根節點。");
  try {
    const db = await openNotesDb();
    mountApp(root, db);
  } catch (err) {
    const message = err instanceof Error ? err.message : "應用程式無法啟動。";
    root.innerHTML = `
      <div class="boot-error">
        <h1>Freenotes 無法開啟</h1>
        <p>${message}</p>
      </div>`;
  }
}

void boot();
