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

  it("undoes a partial erase back to the original strokes, then redoes the remnants", () => {
    const below = makeStroke("below");
    const target = makeStroke("target");
    target.points = [
      { x: 0, y: 0, p: 0.2, t: 0 },
      { x: 100, y: 0, p: 0.9, t: 40 },
    ];
    const above = makeStroke("above");
    const left = makeStroke("left");
    const right = makeStroke("right");
    const strokes = [below, target, above];
    const history = new StrokeHistory();
    strokes.splice(1, 1, left, right);
    history.push({
      type: "replace",
      pageId: "page",
      removed: [target],
      added: [left, right],
      at: [1],
      counts: [2],
    });

    history.undo(strokes);
    expect(strokes.map((s) => s.id)).toEqual(["below", "target", "above"]);
    expect(strokes[1]).toBe(target);
    expect(strokes[1].points).toHaveLength(2);

    history.redo(strokes);
    expect(strokes.map((s) => s.id)).toEqual(["below", "left", "right", "above"]);
  });

  it("restores a fully erased stroke between two kept strokes", () => {
    const a = makeStroke("a");
    const b = makeStroke("b");
    const c = makeStroke("c");
    const d = makeStroke("d");
    const e = makeStroke("e");
    const b1 = makeStroke("b1");
    const b2 = makeStroke("b2");
    const strokes = [a, b1, b2, c, e];
    const history = new StrokeHistory();
    history.push({
      type: "replace",
      pageId: "page",
      removed: [b, d],
      added: [b1, b2],
      at: [1, 3],
      counts: [2, 0],
    });

    history.undo(strokes);
    expect(strokes.map((s) => s.id)).toEqual(["a", "b", "c", "d", "e"]);
    history.redo(strokes);
    expect(strokes.map((s) => s.id)).toEqual(["a", "b1", "b2", "c", "e"]);
  });

  it("applies replace forward without pushing remnants above later strokes", () => {
    const a = makeStroke("a");
    const b = makeStroke("b");
    const c = makeStroke("c");
    const d = makeStroke("d");
    const strokes = [a, b, c, d];
    const b1 = makeStroke("b1");
    const b2 = makeStroke("b2");
    StrokeHistory.applyForward(
      {
        type: "replace",
        pageId: "page",
        removed: [b, d],
        added: [b1, b2],
        at: [1, 3],
        counts: [2, 0],
      },
      strokes,
    );
    expect(strokes.map((s) => s.id)).toEqual(["a", "b1", "b2", "c"]);
    StrokeHistory.applyInverse(
      {
        type: "replace",
        pageId: "page",
        removed: [b, d],
        added: [b1, b2],
        at: [1, 3],
        counts: [2, 0],
      },
      strokes,
    );
    expect(strokes.map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("still caps history at 80 steps", () => {
    const history = new StrokeHistory();
    for (let i = 0; i < 81; i++) {
      history.push({
        type: "replace",
        pageId: "page",
        removed: [],
        added: [],
        at: [],
        counts: [],
      });
    }
    let steps = 0;
    const strokes: Stroke[] = [];
    while (history.undo(strokes)) steps += 1;
    expect(steps).toBe(80);
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
