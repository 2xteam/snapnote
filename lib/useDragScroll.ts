import { useCallback, useRef } from "react";

/**
 * PC에서 마우스 드래그로 수평 스크롤을 가능하게 하는 훅.
 * 조건부로 렌더링되는 요소에도 대응 (callback ref 패턴).
 */
export function useDragScroll() {
  const cleanupRef = useRef<(() => void) | null>(null);

  const callbackRef = useCallback((el: HTMLElement | null) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (!el) return;

    let isDown = false;
    let startX = 0;
    let sl = 0;
    let moved = false;
    let savedSnap = "";

    el.style.cursor = "grab";

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDown = true;
      moved = false;
      startX = e.clientX;
      sl = el.scrollLeft;
      el.style.cursor = "grabbing";
      el.style.userSelect = "none";
      savedSnap = el.style.scrollSnapType || "";
      el.style.scrollSnapType = "none";
    };

    const onMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      el.scrollLeft = sl - dx;
    };

    const onUp = () => {
      if (!isDown) return;
      isDown = false;
      el.style.cursor = "grab";
      el.style.removeProperty("user-select");
      el.style.scrollSnapType = savedSnap;
    };

    const onClick = (e: MouseEvent) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    };

    el.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    el.addEventListener("click", onClick, true);

    cleanupRef.current = () => {
      el.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      el.removeEventListener("click", onClick, true);
    };
  }, []);

  return callbackRef;
}
