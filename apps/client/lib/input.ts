import { useEffect, useRef } from 'react';

/**
 * Mutable input snapshot read every frame by the game loop. Movement axes and
 * `block` are level-triggered (held); `jumpQueued`, `dashQueued` and
 * `attackQueued` are edge-triggered one-shots consumed by the loop.
 */
export interface InputState {
  moveX: number;
  moveZ: number;
  block: boolean;
  facing: number;
  jumpQueued: boolean;
  dashQueued: boolean;
  attackQueued: boolean;
}

function emptyInput(): InputState {
  return {
    moveX: 0,
    moveZ: 0,
    block: false,
    facing: 1,
    jumpQueued: false,
    dashQueued: false,
    attackQueued: false,
  };
}

/**
 * Attach global keyboard/mouse listeners and expose a stable ref with the
 * current input. `enabled` is read live so spectators stop steering.
 */
export function useInput(enabledRef: { current: boolean }): React.MutableRefObject<InputState> {
  const inputRef = useRef<InputState>(emptyInput());
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    function recompute(): void {
      const s = inputRef.current;
      const left = keys.current['a'] || keys.current['arrowleft'] ? 1 : 0;
      const right = keys.current['d'] || keys.current['arrowright'] ? 1 : 0;
      const up = keys.current['w'] || keys.current['arrowup'] ? 1 : 0;
      const down = keys.current['s'] || keys.current['arrowdown'] ? 1 : 0;
      s.moveX = right - left;
      s.moveZ = down - up; // forward (away from camera) is +Z here, but kept subtle
      if (s.moveX > 0) s.facing = 1;
      else if (s.moveX < 0) s.facing = -1;
    }

    function onKeyDown(e: KeyboardEvent): void {
      if (!enabledRef.current) return;
      const key = e.key.toLowerCase();
      if (e.repeat) {
        if (key !== ' ' && key !== 'shift') keys.current[key] = true;
        return;
      }
      keys.current[key] = true;
      if (key === ' ') inputRef.current.jumpQueued = true;
      if (key === 'shift') inputRef.current.dashQueued = true;
      recompute();
    }

    function onKeyUp(e: KeyboardEvent): void {
      const key = e.key.toLowerCase();
      keys.current[key] = false;
      recompute();
    }

    function onMouseDown(e: MouseEvent): void {
      if (!enabledRef.current) return;
      if (e.button === 0) inputRef.current.attackQueued = true;
      if (e.button === 2) inputRef.current.block = true;
    }

    function onMouseUp(e: MouseEvent): void {
      if (e.button === 2) inputRef.current.block = false;
    }

    function onContextMenu(e: MouseEvent): void {
      e.preventDefault();
    }

    function onBlur(): void {
      keys.current = {};
      inputRef.current = emptyInput();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', onBlur);
    };
  }, [enabledRef]);

  return inputRef;
}
