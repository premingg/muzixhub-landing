import { useRef, useCallback, useEffect } from "react";

export function useDraggableSlider(onChange: (pct: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const rafId = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const rectRef = useRef<DOMRect | null>(null);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const getPercent = useCallback((clientX: number) => {
    const rect = rectRef.current;
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    rectRef.current = ref.current?.getBoundingClientRect() ?? null;
    dragging.current = true;
    ref.current?.setPointerCapture(e.pointerId);
    onChangeRef.current(getPercent(e.clientX));
  }, [getPercent]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        onChangeRef.current(getPercent(e.clientX));
        rafId.current = null;
      });
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      rectRef.current = null;
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [getPercent]);

  return { ref, onPointerDown };
}
