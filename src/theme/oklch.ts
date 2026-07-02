/**
 * OKLCH → sRGB conversion.
 *
 * The MIZAN design system defines every color in OKLCH (matching
 * firm-guide-app 1:1). React Native's color parser does not understand
 * `oklch()`, so we keep the OKLCH triples as the source of truth and convert to
 * `#RRGGBB` (or `rgba()` when an alpha is present) at runtime. Math follows the
 * standard OKLab → linear sRGB → gamma pipeline (Björn Ottosson / culori).
 */

/** [L (0..1), C (chroma), H (degrees), alpha (0..1, optional)] */
export type Oklch = readonly [l: number, c: number, h: number, alpha?: number];

function srgbGamma(x: number): number {
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function toByte(x: number): number {
  return Math.round(clamp01(x) * 255);
}

function hex2(n: number): string {
  return n.toString(16).padStart(2, '0');
}

export function oklchToColor([l, c, h, alpha = 1]: Oklch): string {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const lc = l_ * l_ * l_;
  const mc = m_ * m_ * m_;
  const sc = s_ * s_ * s_;

  const r = srgbGamma(4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc);
  const g = srgbGamma(-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc);
  const bl = srgbGamma(-0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc);

  const R = toByte(r);
  const G = toByte(g);
  const B = toByte(bl);

  if (alpha >= 1) return `#${hex2(R)}${hex2(G)}${hex2(B)}`;
  return `rgba(${R}, ${G}, ${B}, ${Number(alpha.toFixed(3))})`;
}
