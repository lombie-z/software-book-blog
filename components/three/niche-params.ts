// View and lighting for the plaster niches, shared by the 3D rooms (plaster-niche.tsx, scene-canvas.tsx) and the
// SVG stand-in (niche-sketch.tsx) so the two always match. No three.js here: the stand-in loads without it.

/** Same as --plaster in styles.css: the niche is the page itself, only shadow sets it apart. */
export const PLASTER_HEX = '#f5f2ed';

// Lambert output = albedo * irradiance / π. Sun (×0.8, its tilt toward the back wall) plus sky light sum to π per
// channel on a sunlit back wall, so it renders exactly the page colour; shadow keeps only the sky (~64%). The sky is a
// little warm (bounce off the plaster) and the sun a little cool, so shadows stay warm while the sunlit sum is neutral.
// Colours are linear RGB.
export const SKY = 2.2;
export const SKY_RGB: [number, number, number] = [1, 0.965, 0.92];
/** Ground light as a fraction of the sky, so ceilings read a touch deeper than floors. */
export const GROUND_FACTOR = 0.91;
export const SUN = 1.397;
export const SUN_RGB: [number, number, number] = [0.842, 0.911, 1];

// Perspective-led, like walking past a real wall: the sun stays put and the viewpoint does the moving.
const SUN_ANGLE = (125 * Math.PI) / 180; // upper left
const SUN_GRAZE = 0.75;
/** Unit vector toward the sun (x right, y up, z out of the wall toward the viewer). */
export const SUN_DIRECTION: [number, number, number] = (() => {
  const v = [Math.cos(SUN_ANGLE) * SUN_GRAZE, Math.sin(SUN_ANGLE) * SUN_GRAZE, 1];
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
})();

/** Recess depth as a fraction of the opening's shorter side. */
export const NICHE_DEPTH = 0.6;

let probe: HTMLDivElement | null = null;
let largeHeight = 0;

/**
 * Viewport size for the eye. The height is the large viewport (100lvh), which holds still while a phone's address bar
 * slides in and out mid-scroll; window.innerHeight changes then, and the eye (so every niche's perspective) would jump.
 * Falls back to innerHeight where lvh isn't supported.
 */
export function viewportSize() {
  if (!probe) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none';
    document.body.appendChild(el);
    const measure = () => {
      largeHeight = el.offsetHeight;
    };
    measure();
    window.addEventListener('resize', measure);
    probe = el;
  }
  return { width: window.innerWidth, height: Math.max(window.innerHeight, largeHeight) };
}

/**
 * Where the viewer's eye is, in viewport pixels (y down) plus its distance from the screen. Right of centre so the
 * left walls show; above the middle so niches below eye level show their floors, turning to ceilings as they scroll
 * up past it; close enough that the walls visibly open and close as each niche goes by.
 */
export function eyeFor(width: number, height: number) {
  return { x: width * 0.62, y: height * 0.38, distance: Math.max(width, height) * 0.7 };
}
