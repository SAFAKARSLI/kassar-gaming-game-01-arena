import { useEffect, useRef } from 'react';
import { DEFAULT_MOUSE_SENS, PITCH_MIN, PITCH_MAX } from '@arena/shared';

const MAX_POINTER_DELTA = 100;

/**
 * First-person input: Pointer Lock mouse-look (yaw/pitch) plus WASD, jump, dash,
 * block and weapon use. Movement booleans are raw; the game loop converts them
 * into a world-space vector using the look yaw.
 */
export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  /** Look yaw (radians, accumulates with mouse X). */
  yaw: number;
  /** Camera pitch (radians, clamped). */
  pitch: number;
  block: boolean;
  /** Pointer is currently locked (actively playing). */
  locked: boolean;
  /** LMB currently held (for bow charge). */
  using: boolean;
  // edge-triggered one-shots, consumed by the loop
  jumpQueued: boolean;
  dashQueued: boolean;
  useStartQueued: boolean;
  useEndQueued: boolean;
}

function emptyInput(): InputState {
  return {
    forward: false,
    back: false,
    left: false,
    right: false,
    yaw: 0,
    pitch: 0,
    block: false,
    locked: false,
    using: false,
    jumpQueued: false,
    dashQueued: false,
    useStartQueued: false,
    useEndQueued: false,
  };
}

export interface UseInputResult {
  inputRef: React.MutableRefObject<InputState>;
  requestPointerLock: () => void;
}

export function useInput(enabledRef: { current: boolean }): UseInputResult {
  const inputRef = useRef<InputState>(emptyInput());
  const elementRef = useRef<HTMLElement | null>(null);

  const requestPointerLock = (): void => {
    const el = elementRef.current ?? document.body;
    void el.requestPointerLock?.();
  };

  useEffect(() => {
    elementRef.current = document.body;
    const s = inputRef.current;
    let skipNextMouseMove = false;

    function onKeyDown(e: KeyboardEvent): void {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') s.forward = true;
      else if (k === 's' || k === 'arrowdown') s.back = true;
      else if (k === 'a' || k === 'arrowleft') s.left = true;
      else if (k === 'd' || k === 'arrowright') s.right = true;
      else if (k === ' ' && !e.repeat) s.jumpQueued = true;
      else if (k === 'shift' && !e.repeat) s.dashQueued = true;
    }

    function onKeyUp(e: KeyboardEvent): void {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') s.forward = false;
      else if (k === 's' || k === 'arrowdown') s.back = false;
      else if (k === 'a' || k === 'arrowleft') s.left = false;
      else if (k === 'd' || k === 'arrowright') s.right = false;
    }

    function onMouseMove(e: MouseEvent): void {
      if (!s.locked) return;
      if (skipNextMouseMove) {
        skipNextMouseMove = false;
        return;
      }
      const dx = clamp(e.movementX, -MAX_POINTER_DELTA, MAX_POINTER_DELTA);
      const dy = clamp(e.movementY, -MAX_POINTER_DELTA, MAX_POINTER_DELTA);
      s.yaw += dx * DEFAULT_MOUSE_SENS;
      s.pitch -= dy * DEFAULT_MOUSE_SENS;
      if (s.pitch < PITCH_MIN) s.pitch = PITCH_MIN;
      if (s.pitch > PITCH_MAX) s.pitch = PITCH_MAX;
    }

    function onMouseDown(e: MouseEvent): void {
      if (!s.locked || !enabledRef.current) return;
      if (e.button === 0) {
        s.using = true;
        s.useStartQueued = true;
      } else if (e.button === 2) {
        s.block = true;
      }
    }

    function onMouseUp(e: MouseEvent): void {
      if (e.button === 0) {
        if (s.using) s.useEndQueued = true;
        s.using = false;
      } else if (e.button === 2) {
        s.block = false;
      }
    }

    function onContextMenu(e: MouseEvent): void {
      e.preventDefault();
    }

    function onLockChange(): void {
      s.locked = document.pointerLockElement != null;
      skipNextMouseMove = s.locked;
      if (!s.locked) {
        // Dropped lock (ESC) — release held controls.
        s.forward = s.back = s.left = s.right = false;
        s.block = false;
        s.using = false;
      }
    }

    function onBlur(): void {
      Object.assign(inputRef.current, emptyInput(), { yaw: s.yaw, pitch: s.pitch });
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('pointerlockchange', onLockChange);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerlockchange', onLockChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [enabledRef]);

  return { inputRef, requestPointerLock };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
