'use client';

import { useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { SoftShadows, View } from '@react-three/drei';
import { sceneState } from './scene-state';

// Sun sweeps from upper-left to upper-right over the first ~1.5 screens of scroll.
const SUN_START = (145 * Math.PI) / 180;
const SUN_END = (60 * Math.PI) / 180;
const SUN_GRAZE = 0.75;

function SunController() {
  useFrame(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // The eye sits low and to the right of the screen, so niches show their top and left walls as in the sketch.
    sceneState.eye.x = w * 0.62;
    sceneState.eye.y = h * 0.78;
    sceneState.eye.distance = Math.max(w, h) * 1.3;

    const t = sceneState.reducedMotion ? 0.3 : Math.min(1, window.scrollY / (h * 1.5));
    const a = SUN_START + (SUN_END - SUN_START) * t;
    sceneState.sunDirection.set(Math.cos(a) * SUN_GRAZE, Math.sin(a) * SUN_GRAZE, 1).normalize();
  }, -1);
  return null;
}

export default function SceneCanvas() {
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      sceneState.reducedMotion = query.matches;
    };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return (
    <Canvas
      eventSource={document.body}
      shadows
      flat
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    >
      <SunController />
      <SoftShadows size={42} samples={24} focus={0.35} />
      <View.Port />
    </Canvas>
  );
}
