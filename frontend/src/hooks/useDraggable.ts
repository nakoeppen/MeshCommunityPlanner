/**
 * useDraggable Hook
 * Provides drag-by-header functionality for modal panels.
 * Returns position state, a mouseDown handler for the drag handle,
 * and a reset function to clear position on reopen.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

interface DragPos {
  x: number;
  y: number;
}

interface UseDraggableReturn {
  /** Current position override, or null for CSS default */
  dragPos: DragPos | null;
  /** Attach to the drag handle's onMouseDown */
  handleDragStart: (e: React.MouseEvent) => void;
  /** Ref to attach to the modal element (needed for initial bounding box) */
  modalRef: React.RefObject<HTMLDivElement | null>;
  /** Call on open/close to reset position */
  resetDrag: () => void;
  /** Style object to spread onto the modal div */
  dragStyle: React.CSSProperties | undefined;
}

export function useDraggable(): UseDraggableReturn {
  const [dragPos, setDragPos] = useState<DragPos | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // left button only
    const modal = modalRef.current;
    if (!modal) return;
    const rect = modal.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
    };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setDragPos({
        x: d.origX + (e.clientX - d.startX),
        y: d.origY + (e.clientY - d.startY),
      });
    };
    const onMouseUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const resetDrag = useCallback(() => {
    setDragPos(null);
    dragRef.current = null;
  }, []);

  const dragStyle: React.CSSProperties | undefined = dragPos
    ? { position: 'fixed', top: dragPos.y, left: dragPos.x, right: 'auto' }
    : undefined;

  return { dragPos, handleDragStart, modalRef, resetDrag, dragStyle };
}
