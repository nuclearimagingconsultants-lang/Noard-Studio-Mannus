import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";

export type StudioSize = { width: number; height: number };
export const MIN_STUDIO_WIDTH = 280;
export const MIN_STUDIO_HEIGHT = 320;

/** Only minimums and finite-number safety; no application maximum. */
export function resizedStudioSize(start: StudioSize, dx: number, dy: number): StudioSize {
  const width = start.width + dx;
  const height = start.height + dy;
  return {
    width: Math.max(MIN_STUDIO_WIDTH, Math.round(Number.isFinite(width) ? width : start.width)),
    height: Math.max(MIN_STUDIO_HEIGHT, Math.round(Number.isFinite(height) ? height : start.height)),
  };
}

type Drag = {
  pointerId: number;
  element: HTMLButtonElement;
  start: StudioSize;
  startX: number;
  startPageY: number;
  startScrollLeft: number;
  x: number;
  y: number;
  moved: boolean;
};

export function useStudioResize(
  active: boolean,
  frame: RefObject<HTMLIFrameElement | null>,
  viewport: RefObject<HTMLDivElement | null>
) {
  const [size, setSize] = useState<Partial<StudioSize>>({});
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<Drag | null>(null);
  const animation = useRef<number | null>(null);

  const stop = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null;
    if (drag?.element.hasPointerCapture(drag.pointerId)) {
      drag.element.releasePointerCapture(drag.pointerId);
    }
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!active) stop();
  }, [active, stop]);
  useEffect(() => stop, [stop]);

  const measure = () => {
    const rect = frame.current?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height } : null;
  };
  const updateDrag = () => {
    const drag = dragRef.current;
    if (!drag?.moved) return;
    const next = resizedStudioSize(
      drag.start,
      drag.x - drag.startX + (viewport.current?.scrollLeft ?? 0) - drag.startScrollLeft,
      drag.y + window.scrollY - drag.startPageY
    );
    setSize(old => old.width === next.width && old.height === next.height ? old : next);
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    const start = measure();
    if (!start) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId, element: event.currentTarget, start,
      startX: event.clientX, startPageY: event.clientY + window.scrollY,
      startScrollLeft: viewport.current?.scrollLeft ?? 0,
      x: event.clientX, y: event.clientY, moved: false,
    };
    setDragging(true);
    const tick = () => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.moved) {
        const edge = 64;
        const speed = (distance: number) => Math.min(24, Math.max(0, distance) / 2);
        if (drag.y > window.innerHeight - edge) window.scrollBy(0, speed(drag.y - window.innerHeight + edge));
        else if (drag.y < edge) window.scrollBy(0, -speed(edge - drag.y));
        const area = viewport.current;
        if (area) {
          const rect = area.getBoundingClientRect();
          if (drag.x > rect.right - edge) area.scrollLeft += speed(drag.x - rect.right + edge);
          else if (drag.x < rect.left + edge) area.scrollLeft -= speed(rect.left + edge - drag.x);
        }
        updateDrag();
      }
      animation.current = requestAnimationFrame(tick);
    };
    animation.current = requestAnimationFrame(tick);
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (Math.abs(drag.x - drag.startX) + Math.abs(drag.y + window.scrollY - drag.startPageY) > 2) drag.moved = true;
    updateDrag();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") { event.preventDefault(); stop(); return; }
    if (event.key === "Home") { event.preventDefault(); stop(); setSize({}); return; }
    const start = measure();
    if (!start || !["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 50 : 10;
    setSize(resizedStudioSize(start,
      event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0,
      event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0));
  };

  return {
    size, dragging,
    isCustom: size.width !== undefined || size.height !== undefined,
    expand() {
      const start = measure();
      if (start) setSize(old => ({ ...old, height: start.height + 480 }));
    },
    fitWidth() { stop(); setSize(old => ({ height: old.height })); },
    restore() { stop(); setSize({}); },
    handle: {
      onPointerDown, onPointerMove,
      onPointerUp: () => { updateDrag(); stop(); },
      onPointerCancel: stop, onLostPointerCapture: stop, onKeyDown,
    },
  };
}
