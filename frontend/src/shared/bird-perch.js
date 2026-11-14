export const BIRD_IDLE_DELAY_MS = 4000;
export const PARROT_FEET = { x: 116, y: 184 };

// The square SVG has a centered 280 x 290 viewBox starting at (-16, -20).
export function buttonBirdPerch(box, { width, height, size }) {
  if (box.width < 50 || box.height < 24 || box.left < 0 || box.right > width || box.bottom > height) return null;
  const y = box.top - size * (PARROT_FEET.y + 20) / 290;
  if (y < 4 || y + size > height - 4) return null;
  const inset = Math.min(24, box.width / 3);
  const sides = box.left + box.width / 2 < width / 2 ? [true, false] : [false, true];
  for (const facingRight of sides) {
    const footX = (5 + 16 + PARROT_FEET.x) / 290;
    const offset = size * (facingRight ? 1 - footX : footX);
    const minAnchor = Math.max(box.left + inset, 4 + offset);
    const maxAnchor = Math.min(box.right - inset, width - size - 4 + offset);
    if (minAnchor > maxAnchor) continue;
    const anchorX = facingRight ? minAnchor : maxAnchor;
    return { x: anchorX - offset, y, facingRight, anchorX };
  }
  return null;
}
