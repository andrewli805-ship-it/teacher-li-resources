export type PaperTemplate = "blank" | "lined" | "grid";
export type SourceType = "blank" | "pdf" | "word" | "excel";
export type Tool = "pen" | "highlighter" | "eraser";
export type BackgroundKind = "template" | "image" | "html";

export interface Notebook {
  id: string;
  name: string;
  coverColor: string;
  createdAt: number;
  updatedAt: number;
  paperTemplate: PaperTemplate;
  sourceType: SourceType;
  sourceName?: string;
}

export interface Page {
  id: string;
  notebookId: string;
  index: number;
  width: number;
  height: number;
  backgroundKind: BackgroundKind;
  paperTemplate?: PaperTemplate;
  label?: string;
}

export interface Point {
  x: number;
  y: number;
  p: number;
  t: number;
}

export interface Stroke {
  id: string;
  pageId: string;
  tool: "pen" | "highlighter";
  color: string;
  width: number;
  points: Point[];
}

export type HistoryAction =
  | { type: "add"; pageId: string; stroke: Stroke }
  | { type: "remove"; pageId: string; strokes: Stroke[] };

export interface BackgroundRecord {
  pageId: string;
  kind: "image" | "html";
  mime?: string;
  data: Blob | string;
}

export const COVER_COLORS = [
  "#2f5d4a",
  "#5c4a3a",
  "#8b4b3b",
  "#2f4a62",
  "#3a5a40",
  "#9a6b3c",
  "#4a4540",
  "#6a3a3a",
] as const;

export const PRESET_COLORS = [
  "#1c1917",
  "#1d4f7a",
  "#9b1c1c",
  "#2f5d4a",
  "#9a6b3c",
  "#4a3a7a",
  "#c45c26",
  "#d4b429",
  "#7dad5c",
  "#e08aa0",
] as const;

export const A4_WIDTH = 794;
export const A4_HEIGHT = 1123;

export const PEN_WIDTHS = [1.6, 2.8, 4.8] as const;
export const HIGHLIGHTER_WIDTHS = [10, 16, 24] as const;
