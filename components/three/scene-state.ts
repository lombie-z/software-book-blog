import { Vector3 } from 'three';

// Shared between every view on the shared canvas, written once per frame by <SunController />.
export const sceneState = {
  /** Unit vector pointing from the scene toward the sun. */
  sunDirection: new Vector3(-0.6, 0.7, 1).normalize(),
  /** Viewer's eye in viewport pixels (y down) plus distance from the screen. */
  eye: { x: 0, y: 0, distance: 1000 },
  reducedMotion: false,
};
