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
// On desktop the eye leans a little toward the cursor (fraction of the screen), so the niches shift even at rest.
const CURSOR_LEAN = 0.18;

const pointer = { x: 0.5, y: 0.5 };
const lean = { x: 0, y: 0 };

function SunController() {
  useEffect(() => {
    sceneState.sunDirection.set(Math.cos(SUN_ANGLE) * SUN_GRAZE, Math.sin(SUN_ANGLE) * SUN_GRAZE, 1).normalize();
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pointer.x = e.clientX / window.innerWidth;
      pointer.y = e.clientY / window.innerHeight;
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);

  useFrame((_, delta) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const k = sceneState.reducedMotion ? 0 : CURSOR_LEAN;
    // Ease toward the cursor so the room settles rather than snapping.
    const ease = 1 - Math.exp(-delta * 4);
    lean.x += ((pointer.x - 0.5) * w * k - lean.x) * ease;
    lean.y += ((pointer.y - 0.5) * h * k - lean.y) * ease;
    sceneState.eye.x = w * 0.62 + lean.x;
    sceneState.eye.y = h * 0.78 + lean.y;
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
