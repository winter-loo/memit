export function calculatePosition(rect: DOMRect): { left: number; top: number } {
  // Place near the end of selection (bottom-right of the rect)
  // Offset slightly to not cover text
  const left = rect.right + 5 + window.scrollX;
  const top = rect.bottom + 5 + window.scrollY;
  return { left, top };
}