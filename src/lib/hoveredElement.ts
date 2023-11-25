import { signal } from "@preact/signals-react";
import {
  MutableRefObject,
  RefObject,
  createContext,
  useCallback,
  useEffect,
} from "react";

const hoveredElement = signal<null | { elem: HTMLElement; tooltip: string }>(
  null,
);

export function useTooltipWatch(elem: RefObject<HTMLElement>, tooltip: string) {
  const handler = useCallback(
    function (this: HTMLElement) {
      setTooltip(this, tooltip);
    },
    [tooltip],
  );

  useEffect(() => {
    const e = elem.current;
    if (e) {
      e.addEventListener("click", handler);
      e.addEventListener("mouseenter", handler);
      e.addEventListener("mouseleave", handler);
      return () => {
        e.removeEventListener("click", handler);
        e.removeEventListener("mouseenter", handler);
        e.removeEventListener("mouseleave", handler);
      };
    }
  }, [elem, handler]);
}

export function useHoveredElement() {
    const value = hoveredElement.value;
  return value;
}

function setTooltip(elem: HTMLElement, tooltip: string) {
  const isHovered = elem.matches(":hover");
  const isAlreadyTooltip =
    hoveredElement.value?.elem === elem &&
    hoveredElement.value.tooltip === tooltip;
  if (isHovered && !isAlreadyTooltip) {
    hoveredElement.value = { elem, tooltip };
  } else if (!isHovered && isAlreadyTooltip) {
    hoveredElement.value = null;
  }
}
