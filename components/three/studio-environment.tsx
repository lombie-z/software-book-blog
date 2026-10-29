'use client';

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { type Material, type Object3D, PMREMGenerator, type Texture, type WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// One map per renderer. The home page's canvas (and its WebGL context) is torn down when you leave, and a map
// rendered on the old context is empty on the new one, so the model would come back without its reflections.
const cached = new WeakMap<WebGLRenderer, Texture>();

function studioEnvMap(gl: WebGLRenderer) {
  let map = cached.get(gl);
  if (!map) {
    // Procedural softbox room, so nothing is downloaded.
    const pmrem = new PMREMGenerator(gl);
    map = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    cached.set(gl, map);
  }
  return map;
}

/**
 * Gives a model's own materials glossy studio reflections. Set per material rather than on the scene,
 * so the plaster around it never picks up extra light.
 */
export function useStudioReflections(root: Object3D, intensity = 1) {
  const gl = useThree((s) => s.gl);
  const envMap = useMemo(() => studioEnvMap(gl), [gl]);
  useEffect(() => {
    root.traverse((child) => {
      const material = (child as Object3D & { material?: Material & { envMap?: Texture | null; envMapIntensity?: number } }).material;
      if (material && 'envMapIntensity' in material) {
        material.envMap = envMap;
        material.envMapIntensity = intensity;
        material.needsUpdate = true;
      }
    });
  }, [root, envMap, intensity]);
}
