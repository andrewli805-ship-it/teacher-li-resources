import { getNotebook, type FreenotesDB } from "../db";
import { renderEditor } from "./editor";
import { renderLibrary } from "./library";

export function mountApp(root: HTMLElement, db: FreenotesDB): void {
  const goHome = () => {
    history.pushState({ view: "library" }, "", "#/");
    void renderLibrary(root, db, openNotebook);
  };

  const openNotebook = (id: string) => {
    history.pushState({ view: "editor", id }, "", `#/n/${encodeURIComponent(id)}`);
    void renderEditor(root, db, id, goHome);
  };

  window.addEventListener("popstate", () => {
    void route();
  });

  async function route(): Promise<void> {
    const match = location.hash.match(/^#\/n\/([^/]+)/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      const notebook = await getNotebook(db, id);
      if (notebook) {
        await renderEditor(root, db, id, goHome);
        return;
      }
    }
    await renderLibrary(root, db, openNotebook);
  }

  void route();
}
