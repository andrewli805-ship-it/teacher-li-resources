import type { BackgroundKind, SourceType } from "../types";

export interface ImportedPage {
  width: number;
  height: number;
  backgroundKind: BackgroundKind;
  label?: string;
  image?: Blob;
  html?: string;
  mime?: string;
}

export interface ImportedDocument {
  sourceType: SourceType;
  sourceName: string;
  pages: ImportedPage[];
}

export type ProgressFn = (current: number, total: number, message: string) => void;
