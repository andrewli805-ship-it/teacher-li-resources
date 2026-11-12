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
    applyInverse(action, strokes);
    this.redoStack.push(action);
    return action;
  }

  redo(strokes: Stroke[]): HistoryAction | undefined {
    const action = this.redoStack.pop();
    if (!action) return undefined;
    applyForward(action, strokes);
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
}

export function applyForward(action: HistoryAction, strokes: Stroke[]): void {
  if (action.type === "add") {
    if (!strokes.some((s) => s.id === action.stroke.id)) {
      strokes.push(action.stroke);
    }
    return;
  }
  const ids = new Set(action.strokes.map((s) => s.id));
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (ids.has(strokes[i].id)) strokes.splice(i, 1);
  }
}

export function applyInverse(action: HistoryAction, strokes: Stroke[]): void {
  if (action.type === "add") {
    const i = strokes.findIndex((s) => s.id === action.stroke.id);
    if (i >= 0) strokes.splice(i, 1);
    return;
  }
  for (const stroke of action.strokes) {
    if (!strokes.some((s) => s.id === stroke.id)) strokes.push(stroke);
  }
}
