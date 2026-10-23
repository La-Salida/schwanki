import { useEffect, useRef, type RefObject } from "react";

export function useDialog(onClose: () => void, returnFocus?: RefObject<HTMLElement | null>) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = returnFocus?.current ?? document.activeElement;
    const overflow = document.body.style.overflow;
    const panel = ref.current;
    const controls = () => [...(panel?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]') ?? [])].filter(element => {
      if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
      let parent = element.parentElement;
      while (parent && parent !== panel) {
        if (parent instanceof HTMLDetailsElement && !parent.open && !parent.querySelector(":scope > summary")?.contains(element)) return false;
        parent = parent.parentElement;
      }
      return true;
    });
    document.body.style.overflow = "hidden";
    (controls()[0] ?? panel)?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0]; const last = items.at(-1);
      if (!first) { event.preventDefault(); panel?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    panel?.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = overflow;
      panel?.removeEventListener("keydown", keydown);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [returnFocus]);
  return ref;
}
