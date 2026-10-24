// A feed and its dialogs can unmount in either order when the route changes.
// Restore the original page style only after the final owner releases its lock.
let owners = 0;
let original = "";

export function lockBodyScroll(): () => void {
  if (owners === 0) {
    original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  owners += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    owners -= 1;
    if (owners === 0) document.body.style.overflow = original;
  };
}
