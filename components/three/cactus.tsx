'use client';

import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import type { Mesh } from 'three';

const URL = '/models/cactus.glb';
// Self-hosted decoder (copied from three/examples) so models never depend on a CDN.
export const DRACO_PATH = '/draco/';

/** Clay cactus from art/cactus.blend, sized for a niche floor where 1 unit = the niche's height. */
export function Cactus(props: ThreeElements['group']) {
  const { scene } = useGLTF(URL, DRACO_PATH);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return (
    <group {...props}>
      {/* Model is ~0.31 units tall; this makes it a little over half the niche. */}
      <primitive object={model} scale={1.8} />
    </group>
  );
}

if (typeof window !== 'undefined') useGLTF.preload(URL, DRACO_PATH);
