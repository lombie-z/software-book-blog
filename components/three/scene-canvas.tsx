'use client';

import { useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { SoftShadows, View } from '@react-three/drei';
import { sceneState } from './scene-state';

// Perspective-led, like walking past a real wall: the sun stays put and the viewpoint does the moving.
const SUN_ANGLE = (125 * Math.PI) / 180; // upper left
const SUN_GRAZE = 0.75;
// The eye sits low and right of the screen (the sketch's view, with top and left walls showing). Its distance from
// the screen, in screen sizes: closer means walls visibly open and close as each niche scrolls past.
const EYE_DISTANCE = 0.7;
function SunController() {
  useEffect(() => {
    sceneState.sunDirection.set(Math.cos(SUN_ANGLE) * SUN_GRAZE, Math.sin(SUN_ANGLE) * SUN_GRAZE, 1).normalize();
  }, []);

  useFrame(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    sceneState.eye.x = w * 0.62;
    sceneState.eye.y = h * 0.78;
    sceneState.eye.distance = Math.max(w, h) * EYE_DISTANCE;
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
