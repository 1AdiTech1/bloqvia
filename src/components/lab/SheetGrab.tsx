import { useEffect, useRef, useState } from "react";
import { useDragControls, type DragControls, type PanInfo } from "framer-motion";

/**
 * iOS-style drag-to-close for the phone/tablet bottom sheets. Dragging starts
 * only from the grab bar, so scrolling the sheet content still scrolls.
 */
export function useSheetDrag(onClose: () => void, enabled: boolean) {
  const controls = useDragControls();
  const ref = useRef<HTMLDivElement>(null);
  const dragProps = enabled
    ? {
        drag: "y" as const,
        dragListener: false,
        dragControls: controls,
        dragConstraints: { top: 0, bottom: 0 },
        dragElastic: { top: 0, bottom: 1 },
        onDragEnd: (_: unknown, info: PanInfo) => {
          const h = ref.current?.offsetHeight ?? 0;
          if (info.offset.y > h * 0.33 || info.velocity.y > 600) onClose();
        },
      }
    : {};
  return { ref, controls, dragProps };
}

/** The 44px grab bar with the 48×6 pill. Hidden on desktop (≥1100px). */
export function SheetGrab({ controls, onClose }: { controls: DragControls; onClose: () => void }) {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) return undefined;
    const up = () => setDragging(false);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
  }, [dragging]);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Drag down to close"
      data-dragging={dragging || undefined}
      onPointerDown={(e) => { setDragging(true); controls.start(e); }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose(); }
      }}
      className="group flex h-11 w-full shrink-0 cursor-grab touch-none select-none items-center justify-center focus-visible:outline-2 focus-visible:outline-navy data-[dragging]:cursor-grabbing dk:hidden"
    >
      <span className="h-1.5 w-12 rounded-full bg-navy/15 transition-[width,background-color] duration-150 group-hover:w-14 group-hover:bg-navy/35 group-data-[dragging]:w-14 group-data-[dragging]:bg-navy/35" />
    </div>
  );
}
