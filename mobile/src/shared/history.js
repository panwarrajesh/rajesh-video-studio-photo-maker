// Undo/redo by snapshots. Rapid edits with the same key (slider drag, clip drag) merge into one undo step.
export function createHistory(limit = 100, now = () => Date.now()) {
  let past = [], future = [], lastKey = null, lastAt = 0;
  return {
    record(snapshot, key) {
      const t = now();
      if (!key || key !== lastKey || t - lastAt > 700) { past.push(snapshot); if (past.length > limit) past.shift(); future = []; }
      lastKey = key || null; lastAt = t;
    },
    undo(current) { if (!past.length) return null; future.push(current); lastKey = null; return past.pop(); },
    redo(current) { if (!future.length) return null; past.push(current); lastKey = null; return future.pop(); },
    canUndo: () => past.length > 0, canRedo: () => future.length > 0, clear() { past = []; future = []; lastKey = null; },
  };
}
