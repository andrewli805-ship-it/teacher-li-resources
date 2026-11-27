import type { HistoryAction, Stroke } from "../types";

export class StrokeHistory {
  private undoStack: HistoryAction[] = [];
  private redoStack: HistoryAction[] = [];
  readonly limit: number;

  constructor(limit = 80) {
    this.limit = limit;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  push(action: HistoryAction): void {
    this.undoStack.push(action);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo(strokes: Stroke[]): HistoryAction | undefined {
    const action = this.undoStack.pop();
    if (!action) return undefined;
    StrokeHistory.applyInverse(action, strokes);
    this.redoStack.push(action);
    return action;
  }

  redo(strokes: Stroke[]): HistoryAction | undefined {
    const action = this.redoStack.pop();
    if (!action) return undefined;
    StrokeHistory.applyForward(action, strokes);
    this.undoStack.push(action);
    return action;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  peekUndo(): HistoryAction | undefined {
    return this.undoStack[this.undoStack.length - 1];
  }

  peekRedo(): HistoryAction | undefined {
    return this.redoStack[this.redoStack.length - 1];
  }

  static applyForward(action: HistoryAction, strokes: Stroke[]): void {
    applyForward(action, strokes);
  }

  static applyInverse(action: HistoryAction, strokes: Stroke[]): void {
    applyInverse(action, strokes);
  }
}

function applyForward(action: HistoryAction, strokes: Stroke[]): void {
  if (action.type === "add") {
    if (!strokes.some((s) => s.id === action.stroke.id)) strokes.push(action.stroke);
    return;
  }
  if (action.type === "remove") {
    const ids = new Set(action.strokes.map((s) => s.id));
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (ids.has(strokes[i].id)) strokes.splice(i, 1);
    }
    return;
  }
  let cursor = 0;
  for (let i = 0; i < action.removed.length; i++) {
    const count = action.counts[i] ?? 0;
    const chunk = action.added.slice(cursor, cursor + count);
    cursor += count;
    const index = strokes.findIndex((s) => s.id === action.removed[i].id);
    if (index >= 0) strokes.splice(index, 1, ...chunk);
  }
}

function applyInverse(action: HistoryAction, strokes: Stroke[]): void {
  if (action.type === "add") {
    const index = strokes.findIndex((s) => s.id === action.stroke.id);
    if (index >= 0) strokes.splice(index, 1);
    return;
  }
  if (action.type === "remove") {
    for (const stroke of action.strokes) {
      if (!strokes.some((s) => s.id === stroke.id)) strokes.push(stroke);
    }
    return;
  }
  const addedIds = new Set(action.added.map((s) => s.id));
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (addedIds.has(strokes[i].id)) strokes.splice(i, 1);
  }
  const restoring = action.removed.map((stroke, i) => ({
    stroke,
    index: action.at[i] ?? strokes.length,
  }));
  restoring.sort((a, b) => a.index - b.index);
  for (const { stroke, index } of restoring) {
    if (strokes.some((s) => s.id === stroke.id)) continue;
    const insertAt = Math.min(Math.max(0, index), strokes.length);
    strokes.splice(insertAt, 0, stroke);
  }
}
