import { useRef, useState, useCallback, useEffect } from 'react';
import type { MealSlot } from '@/hooks/useMealPlans';

type DropTarget = { dayStr: string; slot: MealSlot; day: Date } | null;

const LONG_PRESS_MS = 400;

export function useMealDragDrop() {
  const [draggingPlanId, setDraggingPlanId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchDragging = useRef(false);
  const slotRects = useRef<Map<string, { rect: DOMRect; dayStr: string; slot: MealSlot; day: Date }>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Register a slot element for touch hit-testing
  const registerSlot = useCallback((key: string, el: HTMLElement | null, dayStr: string, slot: MealSlot, day: Date) => {
    if (el) {
      slotRects.current.set(key, { rect: el.getBoundingClientRect(), dayStr, slot, day });
    }
  }, []);

  const refreshRects = useCallback(() => {
    // Called before touch move to update positions (scroll may have changed them)
    const entries = document.querySelectorAll<HTMLElement>('[data-drop-slot]');
    entries.forEach(el => {
      const key = el.dataset.dropSlot!;
      const dayStr = el.dataset.dropDay!;
      const slot = el.dataset.dropMealSlot as MealSlot;
      const dayIso = el.dataset.dropDayIso!;
      slotRects.current.set(key, { rect: el.getBoundingClientRect(), dayStr, slot, day: new Date(dayIso) });
    });
  }, []);

  // ─── HTML5 Drag (desktop) ───
  const handleDragStart = useCallback((planId: string) => {
    setDraggingPlanId(planId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingPlanId(null);
    setDragOverTarget(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, dayStr: string, slot: MealSlot) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(`${dayStr}-${slot}`);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null);
  }, []);

  // ─── Touch (mobile) ───
  const handleTouchStart = useCallback((e: React.TouchEvent, planId: string) => {
    longPressTimer.current = setTimeout(() => {
      touchDragging.current = true;
      setDraggingPlanId(planId);
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(30);
    }, LONG_PRESS_MS);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Cancel long-press if finger moves before timer fires
    if (!touchDragging.current && longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      return;
    }

    if (!touchDragging.current) return;
    e.preventDefault(); // prevent scroll while dragging

    refreshRects();
    const touch = e.touches[0];
    let found = false;
    slotRects.current.forEach(({ rect, dayStr, slot }) => {
      if (
        touch.clientX >= rect.left &&
        touch.clientX <= rect.right &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom
      ) {
        setDragOverTarget(`${dayStr}-${slot}`);
        found = true;
      }
    });
    if (!found) setDragOverTarget(null);
  }, [refreshRects]);

  const handleTouchEnd = useCallback((): DropTarget => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (!touchDragging.current) {
      setDraggingPlanId(null);
      return null;
    }

    touchDragging.current = false;
    const target = dragOverTarget;
    setDraggingPlanId(null);
    setDragOverTarget(null);

    if (!target) return null;

    const entry = slotRects.current.get(target);
    if (!entry) return null;
    return { dayStr: entry.dayStr, slot: entry.slot, day: entry.day };
  }, [dragOverTarget]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  return {
    draggingPlanId,
    dragOverTarget,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    isTouchDragging: () => touchDragging.current,
  };
}
