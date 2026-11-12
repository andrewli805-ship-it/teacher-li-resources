import { describe, expect, it } from "vitest";
import type { Stroke } from "../types";
import { StrokeHistory } from "./history";

function makeStroke(id: string): Stroke {
  return {
    id,
    pageId: "page",
    tool: "pen",
    color: "#1c1917",
    width: 2.5,
    points: [{ x: 1, y: 1, p: 0.5, t: 0 }],
  };
}

describe("StrokeHistory", () => {
  it("undoes and redoes an added stroke", () => {
    const strokes: Stroke[] = [];
    const history = new StrokeHistory();
    const added = makeStroke("a");
    strokes.push(added);
    history.push({ type: "add", pageId: "page", stroke: added });

    history.undo(strokes);
    expect(strokes).toHaveLength(0);
    expect(history.canRedo).toBe(true);

    history.redo(strokes);
    expect(strokes).toHaveLength(1);
    expect(strokes[0].id).toBe("a");
  });

  it("restores removed strokes on undo", () => {
    const a = makeStroke("a");
    const b = makeStroke("b");
    const strokes = [a, b];
    const history = new StrokeHistory();
    strokes.splice(1, 1);
    history.push({ type: "remove", pageId: "page", strokes: [b] });

    history.undo(strokes);
    expect(strokes.map((s) => s.id).sort()).toEqual(["a", "b"]);
    history.redo(strokes);
    expect(strokes.map((s) => s.id)).toEqual(["a"]);
  });

  it("clears redo after a new action", () => {
    const strokes: Stroke[] = [];
    const history = new StrokeHistory();
    const a = makeStroke("a");
    strokes.push(a);
    history.push({ type: "add", pageId: "page", stroke: a });
    history.undo(strokes);
    const b = makeStroke("b");
    strokes.push(b);
    history.push({ type: "add", pageId: "page", stroke: b });
    expect(history.canRedo).toBe(false);
    history.undo(strokes);
    expect(strokes.map((s) => s.id)).toEqual([]);
  });
});
