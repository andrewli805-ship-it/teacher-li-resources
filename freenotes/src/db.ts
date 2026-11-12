import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { BackgroundRecord, Notebook, Page, Stroke } from "./types";

interface FreenotesSchema extends DBSchema {
  notebooks: {
    key: string;
    value: Notebook;
    indexes: { "by-updated": number };
  };
  pages: {
    key: string;
    value: Page;
    indexes: { "by-notebook": string };
  };
  strokes: {
    key: string;
    value: Stroke;
    indexes: { "by-page": string };
  };
  backgrounds: {
    key: string;
    value: BackgroundRecord;
  };
}

const DB_NAME = "freenotes";
const DB_VERSION = 1;

export type FreenotesDB = IDBPDatabase<FreenotesSchema>;

export async function openNotesDb(): Promise<FreenotesDB> {
  return openDB<FreenotesSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const notebooks = db.createObjectStore("notebooks", { keyPath: "id" });
      notebooks.createIndex("by-updated", "updatedAt");
      const pages = db.createObjectStore("pages", { keyPath: "id" });
      pages.createIndex("by-notebook", "notebookId");
      const strokes = db.createObjectStore("strokes", { keyPath: "id" });
      strokes.createIndex("by-page", "pageId");
      db.createObjectStore("backgrounds", { keyPath: "pageId" });
    },
  });
}

export async function resetDatabase(): Promise<void> {
  await deleteDB(DB_NAME);
}

export async function listNotebooks(db: FreenotesDB): Promise<Notebook[]> {
  const rows = await db.getAllFromIndex("notebooks", "by-updated");
  return rows.reverse();
}

export async function getNotebook(
  db: FreenotesDB,
  id: string,
): Promise<Notebook | undefined> {
  return db.get("notebooks", id);
}

export async function putNotebook(
  db: FreenotesDB,
  notebook: Notebook,
): Promise<void> {
  await db.put("notebooks", notebook);
}

export async function listPages(
  db: FreenotesDB,
  notebookId: string,
): Promise<Page[]> {
  const pages = await db.getAllFromIndex("pages", "by-notebook", notebookId);
  return pages.sort((a, b) => a.index - b.index);
}

export async function putPage(db: FreenotesDB, page: Page): Promise<void> {
  await db.put("pages", page);
}

export async function putPages(db: FreenotesDB, pages: Page[]): Promise<void> {
  const tx = db.transaction("pages", "readwrite");
  for (const page of pages) {
    await tx.store.put(page);
  }
  await tx.done;
}

export async function listStrokes(
  db: FreenotesDB,
  pageId: string,
): Promise<Stroke[]> {
  return db.getAllFromIndex("strokes", "by-page", pageId);
}

export async function putStroke(db: FreenotesDB, stroke: Stroke): Promise<void> {
  await db.put("strokes", stroke);
}

export async function deleteStroke(db: FreenotesDB, id: string): Promise<void> {
  await db.delete("strokes", id);
}

export async function deleteStrokes(
  db: FreenotesDB,
  ids: string[],
): Promise<void> {
  const tx = db.transaction("strokes", "readwrite");
  for (const id of ids) {
    await tx.store.delete(id);
  }
  await tx.done;
}

export async function getBackground(
  db: FreenotesDB,
  pageId: string,
): Promise<BackgroundRecord | undefined> {
  return db.get("backgrounds", pageId);
}

export async function putBackground(
  db: FreenotesDB,
  record: BackgroundRecord,
): Promise<void> {
  await db.put("backgrounds", record);
}

export async function touchNotebook(
  db: FreenotesDB,
  notebookId: string,
): Promise<void> {
  const notebook = await db.get("notebooks", notebookId);
  if (!notebook) return;
  notebook.updatedAt = Date.now();
  await db.put("notebooks", notebook);
}

export async function deletePageCascade(
  db: FreenotesDB,
  page: Page,
): Promise<void> {
  const strokes = await db.getAllFromIndex("strokes", "by-page", page.id);
  const tx = db.transaction(["pages", "strokes", "backgrounds"], "readwrite");
  await tx.objectStore("pages").delete(page.id);
  await tx.objectStore("backgrounds").delete(page.id);
  for (const stroke of strokes) {
    await tx.objectStore("strokes").delete(stroke.id);
  }
  await tx.done;
}

export async function deleteNotebookCascade(
  db: FreenotesDB,
  notebookId: string,
): Promise<void> {
  const pages = await db.getAllFromIndex("pages", "by-notebook", notebookId);
  const strokeIds: string[] = [];
  for (const page of pages) {
    const strokes = await db.getAllFromIndex("strokes", "by-page", page.id);
    for (const stroke of strokes) strokeIds.push(stroke.id);
  }
  const tx = db.transaction(
    ["notebooks", "pages", "strokes", "backgrounds"],
    "readwrite",
  );
  await tx.objectStore("notebooks").delete(notebookId);
  for (const page of pages) {
    await tx.objectStore("pages").delete(page.id);
    await tx.objectStore("backgrounds").delete(page.id);
  }
  for (const id of strokeIds) {
    await tx.objectStore("strokes").delete(id);
  }
  await tx.done;
}

export async function createBlankNotebook(
  db: FreenotesDB,
  notebook: Notebook,
  page: Page,
): Promise<void> {
  const tx = db.transaction(["notebooks", "pages"], "readwrite");
  await tx.objectStore("notebooks").put(notebook);
  await tx.objectStore("pages").put(page);
  await tx.done;
}

export async function createImportedNotebook(
  db: FreenotesDB,
  notebook: Notebook,
  pages: Page[],
  backgrounds: BackgroundRecord[],
): Promise<void> {
  const tx = db.transaction(["notebooks", "pages", "backgrounds"], "readwrite");
  await tx.objectStore("notebooks").put(notebook);
  for (const page of pages) {
    await tx.objectStore("pages").put(page);
  }
  for (const bg of backgrounds) {
    await tx.objectStore("backgrounds").put(bg);
  }
  await tx.done;
}
