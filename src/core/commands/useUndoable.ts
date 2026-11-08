import { useCallback, useRef, useState } from "react";
import { CommandHistory } from "./history";
/** State + delta undo/redo (Ctrl+Z/Y via isoe-undo/isoe-redo events). */
export function useUndoable<T>(initial: T | (() => T)) {
  const [state, setState] = useState<T>(initial);
  const hist = useRef<CommandHistory<T> | null>(null);
  if (!hist.current) hist.current = new CommandHistory(state);
  const [, force] = useState(0);
  const set = useCallback((next: T | ((prev: T) => T)) => {
    const value = typeof next === "function" ? (next as (p: T) => T)(hist.current!.state) : next;
    hist.current!.push(value); setState(value); force((n) => n + 1);
  }, []);
  const undo = useCallback(() => { setState(hist.current!.undo()); force((n) => n + 1); }, []);
  const redo = useCallback(() => { setState(hist.current!.redo()); force((n) => n + 1); }, []);
  return { state, set, undo, redo, canUndo: hist.current.canUndo, canRedo: hist.current.canRedo };
}
