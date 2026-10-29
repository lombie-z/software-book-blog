'use client';

import { useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { SoftShadows, View } from '@react-three/drei';
import { eyeFor, SUN_DIRECTION } from './niche-params';
import { sceneState } from './scene-state';

function SunController() {
  useEffect(() => {
    sceneState.sunDirection.set(...SUN_DIRECTION);
  }, []);

  useFrame(() => {
    Object.assign(sceneState.eye, eyeFor(window.innerWidth, window.innerHeight));
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
